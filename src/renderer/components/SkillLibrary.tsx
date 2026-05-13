import { useState } from 'react'
import { useSkills } from '../hooks/useSkills'
import SkillCard from './SkillCard'
import SkillEditor from './SkillEditor'
import type { Skill } from '../types'

export default function SkillLibrary() {
  const { skills, saveSkill, deleteSkill, execute } = useSkills()
  const [search, setSearch] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null)
  const [executeParams, setExecuteParams] = useState<Record<string, Record<string, unknown>>>({})

  const filtered = skills.filter(s => {
    if (!search) return true
    const q = search.toLowerCase()
    return s.meta.name.toLowerCase().includes(q) ||
      s.meta.tags.some(t => t.toLowerCase().includes(q))
  })

  async function handleExecute(skill: Skill) {
    const params = executeParams[skill.meta.id] || {}
    await execute(skill.meta.id, params)
  }

  function handleEdit(skill: Skill) { setEditingSkill(skill); setEditorOpen(true) }
  function handleNew() { setEditingSkill(null); setEditorOpen(true) }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Skill 库</h2>
        <div className="flex gap-2">
          <input
            className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm w-64"
            placeholder="搜索名称或标签..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button onClick={handleNew} className="px-4 py-2 text-sm bg-cyan-600 rounded hover:bg-cyan-500">＋ 新建</button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-gray-500 text-sm py-12 text-center">
          {skills.length === 0 ? '还没有 Skill，点击"新建"创建或去 AI 助手生成' : '没有匹配的 Skill'}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map(skill => (
            <SkillCard key={skill.meta.id} skill={skill} onExecute={handleExecute} onEdit={handleEdit} onDelete={deleteSkill} />
          ))}
        </div>
      )}

      {editorOpen && (
        <SkillEditor
          skill={editingSkill}
          onSave={async (s) => { await saveSkill(s); setEditorOpen(false) }}
          onClose={() => setEditorOpen(false)}
        />
      )}
    </div>
  )
}
