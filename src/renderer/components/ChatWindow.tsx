import { useState } from 'react'
import { api } from '../api'
import type { ChatMessage } from '../types'

function SkillInlinePreview({ skill }: { skill: { meta: { id: string; name: string }; params: unknown[] } }) {
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    await api.saveSkill(skill as never)
    setSaved(true)
  }

  if (saved) {
    return (
      <div className="mt-2 pt-2 border-t border-gray-700">
        <div className="flex items-center gap-2 text-xs text-green-400">
          <span>✓ 已保存到 Skill 库</span>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-2 pt-2 border-t border-gray-700">
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400">📦 {skill.meta.name}</span>
        <button onClick={handleSave} className="px-2 py-0.5 text-xs bg-cyan-500 rounded hover:bg-cyan-400">
          💾 保存到 Skill 库
        </button>
      </div>
    </div>
  )
}

export default function ChatWindow({ messages, streaming }: { messages: ChatMessage[]; streaming: string }) {
  return (
    <div className="flex-1 overflow-auto space-y-4 mb-4 bg-gray-950 rounded-lg p-4 border border-gray-800">
      {messages.map(msg => (
        <div key={msg.id}>
          <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${
              msg.role === 'user'
                ? 'bg-cyan-600 text-white'
                : 'bg-gray-800 text-gray-100'
            }`}>
              <div className="whitespace-pre-wrap">{msg.content}</div>
              {msg.skill && <SkillInlinePreview skill={msg.skill} />}
            </div>
          </div>
        </div>
      ))}
      {streaming && (
        <div className="flex justify-start">
          <div className="max-w-[80%] rounded-lg px-4 py-2 text-sm bg-gray-800 text-gray-100">
            <div className="whitespace-pre-wrap">{streaming}<span className="animate-pulse">▌</span></div>
          </div>
        </div>
      )}
    </div>
  )
}
