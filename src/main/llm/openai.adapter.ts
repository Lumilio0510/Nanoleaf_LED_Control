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
  },

  async chatWithToolsStream(
    messages: ChatMessage[],
    tools: ToolDef[],
    config: LLMConfig,
    onChunk: (chunk: string) => void,
  ): Promise<ToolCallResponse> {
    const url = `${config.baseUrl || 'https://api.openai.com/v1'}/chat/completions`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: config.model || 'gpt-4o',
        messages,
        temperature: 0.7,
        tools: tools.map(t => ({ type: 'function', function: t })),
        tool_choice: 'auto',
        stream: true,
      }),
    })
    if (!res.ok) throw new Error(`OpenAI API 错误: ${res.status}`)

    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let finishReason: 'stop' | 'tool_calls' = 'stop'
    let content = ''
    const toolCallsAcc = new Map<number, { id: string; name: string; args: string }>()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const text = decoder.decode(value, { stream: true })
      for (const line of text.split('\n')) {
        if (!line.startsWith('data: ') || line === 'data: [DONE]') continue
        try {
          const json = JSON.parse(line.slice(6))
          const choice = json.choices?.[0]
          if (!choice) continue

          const delta = choice.delta
          if (delta?.content) {
            content += delta.content
            onChunk(delta.content)
          }
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0
              const entry = toolCallsAcc.get(idx) || { id: '', name: '', args: '' }
              if (tc.id) entry.id = tc.id
              if (tc.function?.name) entry.name += tc.function.name
              if (tc.function?.arguments) entry.args += tc.function.arguments
              toolCallsAcc.set(idx, entry)
            }
          }
          if (choice.finish_reason === 'tool_calls') finishReason = 'tool_calls'
        } catch { /* skip malformed lines */ }
      }
    }

    if (finishReason === 'tool_calls') {
      // 尝试解析流式累积的参数，失败时回退到非流式请求获取完整参数
      const validCalls = Array.from(toolCallsAcc.values())
        .filter(tc => {
          if (!tc.id || !tc.name) return false
          try { JSON.parse(tc.args || '{}'); return true } catch { return false }
        })

      // 如果有任意一个工具调用的参数不完整，重新发非流式请求获取完整参数
      if (validCalls.length !== toolCallsAcc.size) {
        try {
          const fallbackRes = await fetch(url.replace('stream:true', '').replace(',stream:true', ''), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
            body: JSON.stringify({
              model: config.model || 'gpt-4o',
              messages,
              temperature: 0.7,
              tools: tools.map(t => ({ type: 'function', function: t })),
              tool_choice: 'auto',
              stream: false,
            }),
          })
          if (fallbackRes.ok) {
            const data = await fallbackRes.json() as {
              choices: { finish_reason: string; message: { content: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[] } }[]
            }
            const choice = data.choices[0]
            if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls) {
              return {
                finishReason: 'tool_calls',
                content: choice.message.content,
                toolCalls: choice.message.tool_calls.map(tc => ({
                  id: tc.id,
                  name: tc.function.name,
                  arguments: JSON.parse(tc.function.arguments),
                })),
              }
            }
          }
        } catch { /* fallback 失败则继续用流式结果 */ }
      }

      return {
        finishReason: 'tool_calls',
        content: content || null,
        toolCalls: validCalls.length > 0 ? validCalls.map(tc => ({
          id: tc.id,
          name: tc.name,
          arguments: JSON.parse(tc.args || '{}'),
        })) : [],
      }
    }
    return { finishReason: 'stop', content: content || '', toolCalls: [] }
  }
}
