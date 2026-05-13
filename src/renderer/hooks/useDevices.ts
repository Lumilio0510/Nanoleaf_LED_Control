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

export function useEffects() {
  const [effects, setEffects] = useState<EffectInfo[]>([])

  useEffect(() => {
    api.getEffectList().then(setEffects).catch(() => setEffects([]))
  }, [])

  return effects
}
