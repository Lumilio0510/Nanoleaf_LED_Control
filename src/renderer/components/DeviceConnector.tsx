import { useState } from 'react'
import { api } from '../api'
import { useDeviceStatus, useSavedDevices, useScan } from '../hooks/useDevices'
import type { DeviceConfig } from '../types'

export default function DeviceConnector() {
  const state = useDeviceStatus()
  const { devices, refresh } = useSavedDevices()
  const { scan, scanning, found, setFound } = useScan()
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newHost, setNewHost] = useState('')
  const [newPort, setNewPort] = useState('8080')
  const [newNote, setNewNote] = useState('')

  async function handleConnect(id: string) { await api.connect(id) }
  async function handleDisconnect() { await api.disconnect() }

  async function handleAdd() {
    const config: DeviceConfig = {
      id: crypto.randomUUID(),
      name: newName || newHost,
      host: newHost,
      port: parseInt(newPort) || 8080,
      note: newNote
    }
    await api.addDevice(config)
    refresh()
    setShowAdd(false)
    setNewName(''); setNewHost(''); setNewPort('8080'); setNewNote('')
  }

  async function handleAddFound(host: string, port: number, name?: string) {
    const config: DeviceConfig = {
      id: crypto.randomUUID(),
      name: name || host,
      host,
      port,
      note: ''
    }
    await api.addDevice(config)
    refresh()
    setFound(found.filter(f => f.host !== host))
  }

  async function handleRemove(id: string) {
    await api.removeDevice(id)
    refresh()
  }

  const statusColor = { disconnected: 'text-gray-500', connecting: 'text-yellow-400', connected: 'text-green-400', error: 'text-red-400' }

  return (
    <div className="mb-6 bg-gray-900 rounded-lg border border-gray-800 p-4">
      <h2 className="text-sm font-semibold text-gray-300 mb-3">设备连接</h2>

      <div className="flex items-center gap-3 mb-3">
        <select
          className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
          onChange={e => { if (e.target.value) handleConnect(e.target.value) }}
          value={state.config?.id || ''}
        >
          <option value="">-- 选择设备 --</option>
          {devices.map(d => <option key={d.id} value={d.id}>{d.name} ({d.host}:{d.port})</option>)}
        </select>
        <button onClick={scan} disabled={scanning} className="px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded hover:bg-gray-700 disabled:opacity-50">
          {scanning ? '扫描中...' : '🔍 扫描'}
        </button>
        <button onClick={() => setShowAdd(!showAdd)} className="px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded hover:bg-gray-700">
          ＋ 手动添加
        </button>
      </div>

      {found.length > 0 && (
        <div className="mb-3 p-2 bg-gray-800 rounded text-sm">
          <div className="text-gray-400 mb-1">发现的设备：</div>
          {found.map(f => (
            <div key={f.host} className="flex items-center justify-between py-1">
              <span>{f.name || f.host}:{f.port}</span>
              <button onClick={() => handleAddFound(f.host, f.port, f.name)} className="text-cyan-400 hover:text-cyan-300">保存</button>
            </div>
          ))}
        </div>
      )}

      {state.config && (
        <div className={`flex items-center gap-2 text-sm ${statusColor[state.status]}`}>
          <span>● {state.config.name} | {state.config.host}:{state.config.port}</span>
          <span className="text-gray-500">({state.status})</span>
          {state.status === 'connected' && (
            <button onClick={handleDisconnect} className="ml-auto text-xs px-2 py-1 bg-gray-800 rounded hover:bg-gray-700 text-gray-400">断开</button>
          )}
          {state.errorMessage && <span className="text-red-400 text-xs ml-2">{state.errorMessage}</span>}
        </div>
      )}

      {showAdd && (
        <div className="mt-3 p-3 bg-gray-800 rounded space-y-2">
          <input className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm" placeholder="设备名称" value={newName} onChange={e => setNewName(e.target.value)} />
          <div className="flex gap-2">
            <input className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm" placeholder="IP 地址" value={newHost} onChange={e => setNewHost(e.target.value)} />
            <input className="w-24 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm" placeholder="端口" value={newPort} onChange={e => setNewPort(e.target.value)} />
          </div>
          <input className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm" placeholder="备注（可选）" value={newNote} onChange={e => setNewNote(e.target.value)} />
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={!newHost} className="px-4 py-1.5 text-sm bg-cyan-600 rounded hover:bg-cyan-500 disabled:opacity-50">保存设备</button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-1.5 text-sm bg-gray-700 rounded hover:bg-gray-600">取消</button>
          </div>
        </div>
      )}

      {devices.length > 0 && (
        <div className="mt-3 text-xs text-gray-500">
          {devices.map(d => (
            <div key={d.id} className="flex items-center justify-between py-0.5">
              <span>{d.name} — {d.host}:{d.port}</span>
              <button onClick={() => handleRemove(d.id)} className="text-red-400 hover:text-red-300">删除</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
