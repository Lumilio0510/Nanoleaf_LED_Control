import { useState, useEffect } from 'react'
import { api } from '../api'
import type { DeviceState } from '../types'

export default function StatusBar() {
  const [device, setDevice] = useState<DeviceState>({ config: null, status: 'disconnected' })

  useEffect(() => {
    api.getDeviceStatus().then(setDevice)
    return api.onDeviceStatusChange(setDevice)
  }, [])

  const statusDot = {
    disconnected: '⚫',
    connecting: '🟡',
    connected: '🟢',
    error: '🔴',
  }[device.status]

  return (
    <footer className="h-7 border-t border-gray-800 bg-gray-900 flex items-center px-4 text-xs text-gray-500">
      <span className="mr-2">{statusDot}</span>
      <span>{device.config ? `${device.config.name} | ${device.config.host}:${device.config.port}` : '未连接'}</span>
      <span className="ml-auto">v1.0</span>
    </footer>
  )
}
