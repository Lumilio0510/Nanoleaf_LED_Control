import { useState, useEffect } from 'react'
import { api } from '../api'
import type { QuickCommand } from '../types'

interface Props {
  onExecute: (prompt: string) => void
}

export default function QuickCommands({ onExecute }: Props) {
  const [commands, setCommands] = useState<QuickCommand[]>([])

  useEffect(() => {
    api.listCommands().then(setCommands)
  }, [])

  return (
    <div className="flex gap-2 flex-wrap mb-3">
      {commands.map(cmd => (
        <button
          key={cmd.id}
          onClick={() => onExecute(cmd.prompt)}
          className="px-3 py-1.5 text-xs bg-gray-800 border border-gray-700 rounded-full hover:bg-gray-700 hover:border-gray-600 transition-colors"
        >
          {cmd.label}
        </button>
      ))}
    </div>
  )
}
