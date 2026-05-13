import { useSavedDevices } from '../hooks/useDevices'
import { api } from '../api'

export default function DeviceSettings() {
  const { devices, refresh } = useSavedDevices()

  async function handleRemove(id: string) {
    await api.removeDevice(id)
    refresh()
  }

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">已保存设备</h3>
      {devices.length === 0 ? (
        <div className="text-sm text-gray-500">暂无设备，请到控制面板添加</div>
      ) : (
        <div className="space-y-2">
          {devices.map(d => (
            <div key={d.id} className="flex items-center justify-between bg-gray-800 rounded p-3">
              <div>
                <div className="text-sm">{d.name}</div>
                <div className="text-xs text-gray-500">{d.host}:{d.port} {d.note && `— ${d.note}`}</div>
              </div>
              <button onClick={() => handleRemove(d.id)} className="text-xs px-3 py-1 bg-gray-700 rounded hover:bg-red-600 text-gray-400 hover:text-white">删除</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
