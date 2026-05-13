import type { LLMAdapter, ChatMessage } from './types'
import type { LLMConfig } from '../../shared/types'

export const ollamaAdapter: LLMAdapter = {
  async chat(messages: ChatMessage[], config: LLMConfig): Promise<string> {
    const url = `${config.baseUrl || 'http://localhost:11434'}/api/chat`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: config.model || 'llama3', messages, stream: false })
    })
    if (!res.ok) throw new Error(`Ollama API 错误: ${res.status}`)
    const data = await res.json() as { message: { content: string } }
    return data.message.content
  },

  async chatStream(messages: ChatMessage[], config: LLMConfig, onChunk: (chunk: string) => void): Promise<string> {
    const url = `${config.baseUrl || 'http://localhost:11434'}/api/chat`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: config.model || 'llama3', messages, stream: true })
    })
    if (!res.ok) throw new Error(`Ollama API 错误: ${res.status}`)
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let full = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const text = decoder.decode(value, { stream: true })
      for (const line of text.split('\n')) {
        try {
          const json = JSON.parse(line)
          const content = json.message?.content || ''
          if (content) { full += content; onChunk(content) }
        } catch {}
      }
    }
    return full
  }
}
