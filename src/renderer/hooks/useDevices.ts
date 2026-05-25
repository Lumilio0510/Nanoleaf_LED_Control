import { useState, useEffect, useCallback } from 'react'
import { api } from '../api'
import type { DeviceConfig, DeviceState, DiscoveredDevice, EffectInfo } from '../types'

export function useDeviceStatus() {
  const [state, setState] = useState<DeviceState>({ config: null, status: 'disconnected' })

  useEffect(() => {
    api.getDeviceStatus().then(setState)
    return api.onDeviceStatusChange(setState)
  }, [])

  return state
}

export function useSavedDevices() {
  const [devices, setDevices] = useState<DeviceConfig[]>([])

  const refresh = useCallback(async () => {
    setDevices(await api.getDevices())
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return { devices, refresh }
}

export function useScan() {
  const [scanning, setScanning] = useState(false)
  const [found, setFound] = useState<DiscoveredDevice[]>([])

  const scan = useCallback(async () => {
    setScanning(true)
    try { setFound(await api.scanNetwork()) }
    finally { setScanning(false) }
  }, [])

  return { scan, scanning, found, setFound }
}

export function useOnlineStatus(): Record<string, boolean> {
  const [status, setStatus] = useState<Record<string, boolean>>({})

  useEffect(() => {
    api.getOnlineStatus().then(setStatus)
    return api.onOnlineChange(({ deviceId, online }) => {
      setStatus(prev => ({ ...prev, [deviceId]: online }))
    })
  }, [])

  return status
}

export function useEffects() {
  const [effects, setEffects] = useState<EffectInfo[]>([])
  const device = useDeviceStatus()

  useEffect(() => {
    if (device.status === 'connected') {
      Promise.all([
        api.getEffectList(),
        api.getEffectDetails().catch(() => [] as EffectInfo[])
      ]).then(([list, details]) => {
        const detailMap = new Map(details.map(d => [d.name, d]))
        setEffects(list.map(e => {
          const detail = detailMap.get(e.name)
          return detail ? { ...e, palette: detail.palette, description: detail.description || e.description } : e
        }))
      }).catch(() => setEffects([]))
    } else {
      setEffects([])
    }
  }, [device.status])

  return effects
}
