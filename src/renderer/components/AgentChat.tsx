import { useChat } from '../hooks/useChat'
import ChatWindow from './ChatWindow'
import ChatInput from './ChatInput'
import QuickCommands from './QuickCommands'
import SessionManager from './SessionManager'

export default function AgentChat() {
  const chat = useChat()

  return (
    <div className="flex flex-col h-full">
      <SessionManager
        sessions={chat.sessions}
        currentId={chat.currentSessionId}
        onSwitch={chat.switchSession}
        onNew={chat.createNewSession}
        onDelete={chat.deleteSession}
      />
      <QuickCommands onExecute={(prompt) => chat.sendStream(prompt)} />
      <ChatWindow messages={chat.messages} streaming={chat.streaming} />
      <ChatInput onSend={chat.sendStream} disabled={chat.isStreaming} />
    </div>
  )
}
