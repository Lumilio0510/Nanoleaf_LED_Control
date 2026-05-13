import type { ChatSession } from '../types'

interface Props {
  sessions: ChatSession[]
  currentId: string
  onSwitch: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
}

export default function SessionManager({ sessions, currentId, onSwitch, onNew, onDelete }: Props) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <button onClick={onNew} className="px-3 py-1.5 text-xs bg-cyan-600 rounded hover:bg-cyan-500">＋ 新建会话</button>
      <div className="flex gap-1 overflow-x-auto flex-1">
        {sessions.map(s => (
          <div key={s.id} className={`flex items-center gap-1 px-2 py-1 rounded text-xs whitespace-nowrap cursor-pointer ${
            s.id === currentId ? 'bg-gray-700 text-cyan-400' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`} onClick={() => onSwitch(s.id)}>
            <span>{s.title || '新会话'}</span>
            <button onClick={e => { e.stopPropagation(); onDelete(s.id) }} className="text-gray-600 hover:text-red-400 ml-1">✕</button>
          </div>
        ))}
      </div>
    </div>
  )
}
