// ============ IPC 通道名 ============
export const IPC = {
  // 设备
  DEVICE_SCAN: 'device:scan',
  DEVICE_CONNECT: 'device:connect',
  DEVICE_DISCONNECT: 'device:disconnect',
  DEVICE_LIST: 'device:list',
  DEVICE_ADD: 'device:add',
  DEVICE_REMOVE: 'device:remove',
  DEVICE_STATUS: 'device:status',
  DEVICE_ON_STATUS_CHANGE: 'device:onStatusChange',

  // 控制
  CONTROL_SWITCH: 'control:switch',
  CONTROL_BRIGHTNESS: 'control:brightness',
  CONTROL_COLOR: 'control:color',
  CONTROL_APPLY_EFFECT: 'control:applyEffect',
  CONTROL_EFFECT_LIST: 'control:effectList',

  // Skill
  SKILL_LIST: 'skill:list',
  SKILL_GET: 'skill:get',
  SKILL_SAVE: 'skill:save',
  SKILL_DELETE: 'skill:delete',
  SKILL_EXECUTE: 'skill:execute',
  SKILL_EXPORT: 'skill:export',

  // Agent
  AGENT_CHAT: 'agent:chat',
  AGENT_CHAT_STREAM: 'agent:chatStream',
  AGENT_QUICK_COMMAND: 'agent:quickCommand',
  AGENT_LIST_COMMANDS: 'agent:listCommands',
  AGENT_ON_STREAM_CHUNK: 'agent:onStreamChunk',

  // 聊天历史
  CHAT_SESSION_LIST: 'chat:sessionList',
  CHAT_SESSION_GET: 'chat:sessionGet',
  CHAT_SESSION_CREATE: 'chat:sessionCreate',
  CHAT_SESSION_DELETE: 'chat:sessionDelete',

  // 设置
  SETTINGS_GET: 'settings:get',
  SETTINGS_SAVE: 'settings:save',
  SETTINGS_GET_LLM: 'settings:getLlm',
  SETTINGS_SAVE_LLM: 'settings:saveLlm',
} as const

// ============ 设备 ============
export interface DeviceConfig {
  id: string
  name: string
  host: string
  port: number
  note: string
}

export type DeviceStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface DeviceState {
  config: DeviceConfig | null
  status: DeviceStatus
  errorMessage?: string
}

export interface DiscoveredDevice {
  host: string
  port: number
  name?: string
}

// ============ 灯效控制 ============
export interface EffectInfo {
  id: string
  name: string
  description: string
  params: EffectParamDef[]
}

export interface EffectParamDef {
  key: string
  label: string
  type: 'range' | 'color' | 'select' | 'number' | 'text'
  min?: number
  max?: number
  options?: { label: string; value: string }[]
  default: unknown
}

// ============ Skill ============
export interface SkillMeta {
  id: string
  name: string
  description: string
  tags: string[]
  version: number
  createdAt: string
  updatedAt: string
}

export interface SkillParam {
  key: string
  label: string
  type: 'range' | 'color' | 'select' | 'number' | 'text'
  min?: number
  max?: number
  options?: { label: string; value: string }[]
  default: unknown
}

export interface SkillMapping {
  endpoint: string
  bodyTemplate: Record<string, unknown>
}

export interface Skill {
  meta: SkillMeta
  params: SkillParam[]
  mapping: SkillMapping
}

// ============ 聊天 ============
export type MessageRole = 'user' | 'assistant' | 'system'

export interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  skill?: Skill
  timestamp: string
}

export interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: string
  updatedAt: string
}

// ============ Agent ============
export interface QuickCommand {
  id: string
  label: string
  prompt: string
}

// ============ LLM 配置 ============
export type LLMProvider = 'openai' | 'ollama'

export interface LLMConfig {
  provider: LLMProvider
  apiKey: string
  baseUrl: string
  model: string
}
