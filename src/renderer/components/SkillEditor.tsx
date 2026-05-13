import { useState, useEffect } from 'react'
import type { Skill } from '../types'

interface Props {
  skill?: Skill | null
  onSave: (skill: Skill) => void
  onClose: () => void
}

function emptySkill(): Skill {
  return {
    meta: { id: crypto.randomUUID(), name: '', description: '', tags: [], version: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    params: [],
    mapping: { endpoint: '', bodyTemplate: {} }
  }
}

export default function SkillEditor({ skill: initial, onSave, onClose }: Props) {
  const [skill, setSkill] = useState<Skill>(initial || emptySkill())

  useEffect(() => { if (initial) setSkill(initial) }, [initial])

  function updateMeta(field: string, value: unknown) {
    setSkill(prev => ({ ...prev, meta: { ...prev.meta, [field]: value, updatedAt: new Date().toISOString() } }))
  }

  function updateParam(index: number, field: string, value: unknown) {
    setSkill(prev => {
      const params = [...prev.params]
      params[index] = { ...params[index], [field]: value }
      return { ...prev, params }
    })
  }

  function addParam() {
    setSkill(prev => ({
      ...prev,
      params: [...prev.params, { key: '', label: '', type: 'text' as const, default: '' }]
    }))
  }

  function removeParam(index: number) {
    setSkill(prev => ({ ...prev, params: prev.params.filter((_, i) => i !== index) }))
  }

  function handleSave() { onSave(skill) }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-lg w-[640px] max-h-[80vh] overflow-auto p-6">
        <h2 className="text-lg font-semibold mb-4">{initial ? '编辑 Skill' : '新建 Skill'}</h2>

        <div className="space-y-3">
          <input className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm" placeholder="名称" value={skill.meta.name} onChange={e => updateMeta('name', e.target.value)} />
          <input className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm" placeholder="描述" value={skill.meta.description} onChange={e => updateMeta('description', e.target.value)} />
          <input className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm" placeholder="标签（逗号分隔）" value={skill.meta.tags.join(',')} onChange={e => updateMeta('tags', e.target.value.split(',').map(t => t.trim()).filter(Boolean))} />
          <input className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm font-mono" placeholder="Endpoint（如 POST /effect/breathe）" value={skill.mapping.endpoint} onChange={e => setSkill(prev => ({ ...prev, mapping: { ...prev.mapping, endpoint: e.target.value } }))} />
          <div>
            <label className="text-xs text-gray-500">Body Template (JSON)</label>
            <textarea
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm font-mono mt-1"
              rows={6}
              value={JSON.stringify(skill.mapping.bodyTemplate, null, 2)}
              onChange={e => { try { setSkill(prev => ({ ...prev, mapping: { ...prev.mapping, bodyTemplate: JSON.parse(e.target.value) } })) } catch {} }}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-gray-500">参数列表</label>
              <button onClick={addParam} className="px-2 py-1 text-xs bg-gray-700 rounded hover:bg-gray-600">＋ 添加参数</button>
            </div>
            {skill.params.map((p, i) => (
              <div key={i} className="flex gap-2 mb-2 items-center">
                <input className="w-28 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs" placeholder="参数名" value={p.key} onChange={e => updateParam(i, 'key', e.target.value)} />
                <input className="w-28 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs" placeholder="显示名" value={p.label} onChange={e => updateParam(i, 'label', e.target.value)} />
                <select className="w-24 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs" value={p.type} onChange={e => updateParam(i, 'type', e.target.value)}>
                  <option value="range">range</option>
                  <option value="color">color</option>
                  <option value="select">select</option>
                  <option value="number">number</option>
                  <option value="text">text</option>
                </select>
                <input className="w-28 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs" placeholder="默认值" value={String(p.default)} onChange={e => updateParam(i, 'default', e.target.value)} />
                <button onClick={() => removeParam(i)} className="text-red-400 text-xs hover:text-red-300">✕</button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button onClick={handleSave} className="px-4 py-2 text-sm bg-cyan-600 rounded hover:bg-cyan-500">保存</button>
          <button onClick={onClose} className="px-4 py-2 text-sm bg-gray-700 rounded hover:bg-gray-600">取消</button>
        </div>
      </div>
    </div>
  )
}
