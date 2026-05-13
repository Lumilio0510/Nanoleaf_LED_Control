import type { LLMAdapter } from './types'
import type { LLMConfig } from '../../shared/types'
import { openaiAdapter } from './openai.adapter'
import { ollamaAdapter } from './ollama.adapter'

export type { LLMAdapter, ChatMessage } from './types'

export function getAdapter(config: LLMConfig): LLMAdapter {
  switch (config.provider) {
    case 'openai': return openaiAdapter
    case 'ollama': return ollamaAdapter
    default: throw new Error(`不支持的 LLM 类型: ${config.provider}`)
  }
}
