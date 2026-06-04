import type { LLMConfig } from '../../shared/types'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_call_id?: string
  tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[]
  reasoning_content?: string
}

export interface ToolDef {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

export interface ToolCallResponse {
  finishReason: 'stop' | 'tool_calls'
  content: string | null
  toolCalls: ToolCall[]
  reasoningContent?: string
}

export interface LLMAdapter {
  chat(messages: ChatMessage[], config: LLMConfig): Promise<string>
  chatStream(messages: ChatMessage[], config: LLMConfig, onChunk: (chunk: string) => void): Promise<string>
  chatWithTools(messages: ChatMessage[], tools: ToolDef[], config: LLMConfig): Promise<ToolCallResponse>
  chatWithToolsStream(messages: ChatMessage[], tools: ToolDef[], config: LLMConfig, onChunk: (chunk: string) => void): Promise<ToolCallResponse>
}
