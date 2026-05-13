import type { LLMConfig } from '../../shared/types'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LLMAdapter {
  chat(messages: ChatMessage[], config: LLMConfig): Promise<string>
  chatStream(messages: ChatMessage[], config: LLMConfig, onChunk: (chunk: string) => void): Promise<string>
}
