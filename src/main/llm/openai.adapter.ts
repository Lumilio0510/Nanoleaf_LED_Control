import type { LLMAdapter, ChatMessage, ToolDef, ToolCallResponse } from './types'
import type { LLMConfig } from '../../shared/types'

export const openaiAdapter: LLMAdapter = {
  async chat(messages: ChatMessage[], config: LLMConfig): Promise<string> {
    const url = `${config.baseUrl || 'https://api.openai.com/v1'}/chat/completions`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
      body: JSON.stringify({ model: config.model || 'gpt-4o', messages, temperature: 0.7 })
    })
    if (!res.ok) throw new Error(`OpenAI API 错误: ${res.status} ${await res.text()}`)
    const data = await res.json() as { choices: { message: { content: string } }[] }
    return data.choices[0].message.content
  },

  async chatStream(messages: ChatMessage[], config: LLMConfig, onChunk: (chunk: string) => void): Promise<string> {
    const url = `${config.baseUrl || 'https://api.openai.com/v1'}/chat/completions`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
      body: JSON.stringify({ model: config.model || 'gpt-4o', messages, temperature: 0.7, stream: true })
    })
    if (!res.ok) throw new Error(`OpenAI API 错误: ${res.status}`)
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let full = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const text = decoder.decode(value, { stream: true })
      for (const line of text.split('\n')) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          try {
            const json = JSON.parse(line.slice(6))
            const content = json.choices?.[0]?.delta?.content || ''
            if (content) { full += content; onChunk(content) }
          } catch {}
        }
      }
    }
    return full
  },

  async chatWithTools(messages: ChatMessage[], tools: ToolDef[], config: LLMConfig): Promise<ToolCallResponse> {
    const url = `${config.baseUrl || 'https://api.openai.com/v1'}/chat/completions`
    const body: Record<string, unknown> = {
      model: config.model || 'gpt-4o',
      messages,
      temperature: 0.7,
      tools: tools.map(t => ({ type: 'function', function: t })),
      tool_choice: 'auto'
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
      body: JSON.stringify(body)
    })
    if (!res.ok) throw new Error(`OpenAI API 错误: ${res.status} ${await res.text()}`)
    const data = await res.json() as {
      choices: { finish_reason: string; message: { content: string | null; reasoning_content?: string; tool_calls?: { id: string; function: { name: string; arguments: string } }[] } }[]
    }
    const choice = data.choices[0]
    if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls) {
      return {
        finishReason: 'tool_calls',
        content: choice.message.content,
        toolCalls: choice.message.tool_calls.map(tc => ({
          id: tc.id,
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments)
        })),
        reasoningContent: choice.message.reasoning_content
      }
    }
    return { finishReason: 'stop', content: choice.message.content || '', toolCalls: [], reasoningContent: choice.message.reasoning_content }
  }
}
