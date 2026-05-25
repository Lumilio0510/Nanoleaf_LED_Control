import { networkInterfaces } from 'os'
import { DeviceConfig, DeviceState, DiscoveredDevice } from '../shared/types'
import { readJSON, writeJSON } from './storage'
import { authenticate } from './nanoleaf-auth.service'
import { discoverDevices } from './discovery.service'
import * as nanoleafApi from './nanoleaf-api.service'

let currentState: DeviceState = { config: null, status: 'disconnected' }
let heartbeatTimer: ReturnType<typeof setInterval> | null = null
let failCount = 0
const MAX_FAIL = 3
const HEARTBEAT_INTERVAL = 10000

// Online status per device (ephemeral, not persisted)
const onlineStatus = new Map<string, boolean>()
type OnlineStatusCallback = (deviceId: string, online: boolean) => void
let onlineCallbacks: OnlineStatusCallback[] = []

type StatusCallback = (state: DeviceState) => void
let statusCallbacks: StatusCallback[] = []

export function onStatusChange(cb: StatusCallback): () => void {
  statusCallbacks.push(cb)
  return () => { statusCallbacks = statusCallbacks.filter(c => c !== cb) }
}

function emitStatus() {
  statusCallbacks.forEach(cb => cb({ ...currentState }))
}

export function onOnlineChange(cb: OnlineStatusCallback): () => void {
  onlineCallbacks.push(cb)
  return () => { onlineCallbacks = onlineCallbacks.filter(c => c !== cb) }
}

function emitOnline(deviceId: string, online: boolean) {
  const prev = onlineStatus.get(deviceId)
  if (prev === online) return // avoid noisy updates
  onlineStatus.set(deviceId, online)
  onlineCallbacks.forEach(cb => cb(deviceId, online))
}

export function getOnlineStatus(): Record<string, boolean> {
  return Object.fromEntries(onlineStatus)
}

function dedupByIdAndName(list: DeviceConfig[]): DeviceConfig[] {
  const seen = new Set<string>()
  return list.filter(d => {
    const key = d.id
    if (seen.has(key)) return false
    seen.add(key)
    // Also mark name as seen to prevent same-name duplicates
    if (d.name) seen.add(`name:${d.name}`)
    return true
  })
}

export function getDevices(): DeviceConfig[] {
  return dedupByIdAndName(readJSON<DeviceConfig[]>('devices.json', []))
}

export function addDevice(config: DeviceConfig): DeviceConfig[] {
  const devices = getDevices()
  const existing = devices.find(d => d.id === config.id) || devices.find(d => d.name === config.name)
  if (existing) {
    existing.host = config.host
    existing.port = config.port
    if (config.note) existing.note = config.note
    if (config.authToken) existing.authToken = config.authToken
  } else {
    devices.push(config)
  }
  writeJSON('devices.json', devices)
  return devices
}

export function renameDevice(id: string, newName: string): DeviceConfig[] {
  let devices = getDevices()
  const target = devices.find(d => d.id === id)
  if (target) {
    target.name = newName
    writeJSON('devices.json', devices)
  }
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
  if (config.authToken) {
    try {
      const url = `http://${config.host}:${config.port}/api/v1/${config.authToken}`
      const res = await fetch(url, { method: 'GET' })
      if (res.ok) return true
    } catch { /* fall through to fallback */ }
  }
  // Fallback: probe /api/v1/new (403 or 200 = device online)
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 3000)
    const res = await fetch(`http://${config.host}:${config.port}/api/v1/new`, {
      method: 'POST',
      signal: ctrl.signal
    })
    clearTimeout(t)
    return res.status === 403 || res.status === 200
  } catch {
    return false
  }
}

export async function connect(deviceId: string): Promise<DeviceState> {
  const devices = getDevices()
  const config = devices.find(d => d.id === deviceId)
  if (!config) return { config: null, status: 'error', errorMessage: '设备不存在' }

  if (!config.authToken) {
    currentState = { config, status: 'auth_required', errorMessage: '需要认证：请长按设备电源键 5-7 秒后点击认证' }
    emitStatus()
    return { ...currentState }
  }

  currentState = { config, status: 'connecting' }
  emitStatus()

  const ok = await pingDevice(config)
  emitOnline(config.id, ok)

  if (!ok) {
    // Token might be expired — allow re-auth
    currentState = { config, status: 'error', errorMessage: '无法连接到设备，请尝试重新认证' }
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

export async function authenticateDevice(deviceId: string): Promise<string> {
  const devices = getDevices()
  const config = devices.find(d => d.id === deviceId)
  if (!config) throw new Error('设备不存在')

  const token = await authenticate(config.host, config.port)

  // Persist token
  const updated = devices.map(d =>
    d.id === deviceId ? { ...d, authToken: token } : d
  )
  writeJSON('devices.json', updated)

  // Update current config if it's the active device
  if (currentState.config?.id === deviceId) {
    currentState.config.authToken = token
  }

  return token
}

export async function identifyDevice(): Promise<void> {
  await nanoleafApi.identify()
}

function startHeartbeat() {
  stopHeartbeat()
  heartbeatTimer = setInterval(async () => {
    if (!currentState.config) return
    const ok = await pingDevice(currentState.config)
    emitOnline(currentState.config.id, ok)
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
  return discoverDevices()
}

export async function crossReferenceScan(found: DiscoveredDevice[]): Promise<DiscoveredDevice[]> {
  const devices = getDevices()
  const matched = new Set<string>()

  for (const f of found) {
    // Match by host:port first, then by device name
    const saved = devices.find(d =>
      (d.host === f.host && d.port === f.port) ||
      (f.name && d.name === f.name)
    )
    if (saved) {
      emitOnline(saved.id, true)
      // Update host/port if the device IP changed (match by name but different host)
      if (saved.host !== f.host || saved.port !== f.port) {
        const all = getDevices()
        const idx = all.findIndex(d => d.id === saved.id)
        if (idx >= 0) {
          all[idx].host = f.host
          all[idx].port = f.port
          writeJSON('devices.json', all)
        }
      }
      // Auto-connect if no device is currently connected and saved has authToken
      if (currentState.config === null && saved.authToken) {
        connect(saved.id)
      }
      matched.add(`${f.host}:${f.port}`)
    }
  }

  // Also dedup remaining results by name before returning
  const remaining = found.filter(f => !matched.has(`${f.host}:${f.port}`))
  return dedupScanResultsByName(remaining, devices)
}

function dedupScanResultsByName(found: DiscoveredDevice[], saved: DeviceConfig[]): DiscoveredDevice[] {
  const seen = new Set<string>()
  // Mark all saved device names as seen
  for (const d of saved) seen.add(d.name)
  return found.filter(f => {
    const key = f.name && !f.name.startsWith('Nanoleaf-') ? f.name : `${f.host}:${f.port}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function getLocalIP(): string {
  const ifaces = networkInterfaces()
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address
      }
    }
  }
  return '127.0.0.1'
}

export async function pingAllDevices(): Promise<Record<string, boolean>> {
  const devices = getDevices()
  for (const d of devices) {
    const online = await pingDevice(d)
    emitOnline(d.id, online)
  }
  return getOnlineStatus()
}
