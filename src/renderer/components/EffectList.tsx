import { useState } from 'react'
import { useEffects } from '../hooks/useDevices'
import { api } from '../api'
import type { EffectInfo } from '../types'

export default function EffectList() {
  const effects = useEffects()
  const [params, setParams] = useState<Record<string, unknown>>({})

  if (effects.length === 0) return null

  async function apply(effect: EffectInfo) {
    await api.applyEffect(effect.id, params)
  }

  function renderParamControl(effect: EffectInfo) {
    return effect.params.map(p => {
      if (p.type === 'range') {
        return (
          <div key={p.key} className="flex items-center gap-2 mb-2">
            <span className="text-xs text-gray-500 w-12">{p.label}</span>
            <input
              type="range" min={p.min ?? 0} max={p.max ?? 100}
              defaultValue={p.default as number}
              onChange={e => setParams(prev => ({ ...prev, [p.key]: Number(e.target.value) }))}
              className="w-24 accent-cyan-500"
            />
            <span className="text-xs text-gray-400">{String(params[p.key] ?? p.default)}</span>
          </div>
        )
      }
      if (p.type === 'select' && p.options) {
        return (
          <div key={p.key} className="flex items-center gap-2 mb-2">
            <span className="text-xs text-gray-500 w-12">{p.label}</span>
            <select
              onChange={e => setParams(prev => ({ ...prev, [p.key]: e.target.value }))}
              className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs"
            >
              {p.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        )
      }
      if (p.type === 'color') {
        return (
          <div key={p.key} className="flex items-center gap-2 mb-2">
            <span className="text-xs text-gray-500 w-12">{p.label}</span>
            <input
              type="color" defaultValue={p.default as string}
              onChange={e => setParams(prev => ({ ...prev, [p.key]: e.target.value }))}
              className="w-6 h-6 rounded cursor-pointer bg-transparent"
            />
          </div>
        )
      }
      return null
    })
  }

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
      <h2 className="text-sm font-semibold text-gray-300 mb-3">灯效列表</h2>
      <div className="grid grid-cols-2 gap-2">
        {effects.map(effect => (
          <div key={effect.id} className="bg-gray-800 rounded p-3 border border-gray-700">
            <div className="flex items-start justify-between mb-1">
              <div>
                <div className="text-sm font-medium">{effect.name}</div>
                <div className="text-xs text-gray-500">{effect.description}</div>
              </div>
              <button onClick={() => apply(effect)} className="px-3 py-1 text-xs bg-cyan-600 rounded hover:bg-cyan-500">应用</button>
            </div>
            {effect.params.length > 0 && (
              <div className="mt-2 pt-2 border-t border-gray-700">
                {renderParamControl(effect)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
