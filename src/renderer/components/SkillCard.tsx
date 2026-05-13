import type { Skill } from '../types'

interface Props {
  skill: Skill
  onExecute: (skill: Skill) => void
  onEdit: (skill: Skill) => void
  onDelete: (id: string) => void
}

export default function SkillCard({ skill, onExecute, onEdit, onDelete }: Props) {
  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-3 hover:border-gray-600 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="text-sm font-medium">{skill.meta.name}</div>
          <div className="text-xs text-gray-500 mt-0.5">{skill.meta.description}</div>
        </div>
      </div>
      {skill.meta.tags.length > 0 && (
        <div className="flex gap-1 mb-2 flex-wrap">
          {skill.meta.tags.map(tag => (
            <span key={tag} className="px-1.5 py-0.5 text-xs bg-gray-700 text-gray-400 rounded">{tag}</span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 mt-3 pt-2 border-t border-gray-700">
        <button onClick={() => onExecute(skill)} className="px-3 py-1 text-xs bg-cyan-600 rounded hover:bg-cyan-500">执行</button>
        <button onClick={() => onEdit(skill)} className="px-3 py-1 text-xs bg-gray-700 rounded hover:bg-gray-600">编辑</button>
        <button onClick={() => onDelete(skill.meta.id)} className="px-3 py-1 text-xs bg-gray-700 rounded hover:bg-red-600 text-gray-400 hover:text-white ml-auto">删除</button>
      </div>
    </div>
  )
}
