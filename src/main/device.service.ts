import { networkInterfaces } from 'os'
import { DeviceConfig, DeviceState, DeviceStatus, DiscoveredDevice } from '../shared/types'
import { readJSON, writeJSON } from './storage'

let currentState: DeviceState = { config: null, status: 'disconnected' }
let heartbeatTimer: ReturnType<typeof setInterval> | null = null
let failCount = 0
const MAX_FAIL = 3
const HEARTBEAT_INTERVAL = 10000

type StatusCallback = (state: DeviceState) => void
let statusCallbacks: StatusCallback[] = []

export function onStatusChange(cb: StatusCallback): () => void {
  statusCallbacks.push(cb)
  return () => { statusCallbacks = statusCallbacks.filter(c => c !== cb) }
}

function emitStatus() {
  statusCallbacks.forEach(cb => cb({ ...currentState }))
}

export function getDevices(): DeviceConfig[] {
  return readJSON<DeviceConfig[]>('devices.json', [])
}

export function addDevice(config: DeviceConfig): DeviceConfig[] {
  const devices = getDevices()
  devices.push(config)
  writeJSON('devices.json', devices)
  return devices
}

export function removeDevice(id: string): DeviceConfig[] {
  let devices = getDevices()
  devices = devices.filter(d => d.id !== id)
  writeJSON('devices.json', devices)
  return devices
}

export function getDeviceStatus(): DeviceState {
  return { ...currentState }
}

async function pingDevice(config: DeviceConfig): Promise<boolean> {
  try {
    const url = `http://${config.host}:${config.port}/ping`
    const res = await fetch(url, { method: 'GET' })
    return res.ok
  } catch {
    return false
  }
}

export async function connect(deviceId: string): Promise<DeviceState> {
  const devices = getDevices()
  const config = devices.find(d => d.id === deviceId)
  if (!config) return { config: null, status: 'error', errorMessage: '设备不存在' }

  currentState = { config, status: 'connecting' }
  emitStatus()

  const ok = await pingDevice(config)
  if (!ok) {
    currentState = { config, status: 'error', errorMessage: '无法连接到设备' }
    emitStatus()
    return { ...currentState }
  }

  currentState = { config, status: 'connected' }
  failCount = 0
  startHeartbeat()
  emitStatus()
  return { ...currentState }
}

export async function disconnect(): Promise<DeviceState> {
  stopHeartbeat()
  currentState = { config: null, status: 'disconnected' }
  emitStatus()
  return { ...currentState }
}

function startHeartbeat() {
  stopHeartbeat()
  heartbeatTimer = setInterval(async () => {
    if (!currentState.config) return
    const ok = await pingDevice(currentState.config)
    if (!ok) {
      failCount++
      if (failCount >= MAX_FAIL) {
        currentState = { config: currentState.config, status: 'error', errorMessage: '设备连接中断' }
        emitStatus()
      }
    } else {
      failCount = 0
    }
  }, HEARTBEAT_INTERVAL)
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
}

export async function scanNetwork(): Promise<DiscoveredDevice[]> {
  const results: DiscoveredDevice[] = []
  const baseIp = getLocalBaseIP()
  if (!baseIp) return results

  const promises: Promise<void>[] = []
  for (let i = 1; i <= 254; i++) {
    const host = `${baseIp}.${i}`
    promises.push(
      (async () => {
        try {
          const controller = new AbortController()
          const timeout = setTimeout(() => controller.abort(), 2000)
          const res = await fetch(`http://${host}:8080/ping`, {
            method: 'GET',
            signal: controller.signal
          })
          clearTimeout(timeout)
          if (res.ok) results.push({ host, port: 8080, name: `LED-${host}` })
        } catch { /* 不可达 */ }
      })()
    )
  }
  await Promise.allSettled(promises)
  return results
}

function getLocalBaseIP(): string | null {
  const ifaces = networkInterfaces()
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        const parts = iface.address.split('.')
        return `${parts[0]}.${parts[1]}.${parts[2]}`
      }
    }
  }
  return null
}
