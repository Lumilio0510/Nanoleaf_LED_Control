import { useState, useRef } from 'react'

interface Props {
  onSend: (text: string) => void
  disabled: boolean
}

export default function ChatInput({ onSend, disabled }: Props) {
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function handleSend() {
    if (!text.trim() || disabled) return
    onSend(text.trim())
    setText('')
    inputRef.current?.focus()
  }

  return (
    <div className="flex gap-2">
      <input
        ref={inputRef}
        className="flex-1 bg-gray-800 border border-gray-700 rounded px-4 py-2.5 text-sm"
        placeholder="描述你想要的灯效..."
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleSend()}
        disabled={disabled}
      />
      <button onClick={handleSend} disabled={disabled || !text.trim()} className="px-5 py-2.5 bg-cyan-600 rounded text-sm hover:bg-cyan-500 disabled:opacity-50">
        发送
      </button>
    </div>
  )
}
