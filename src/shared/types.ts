// ============ IPC 通道名 ============
export const IPC = {
  // 设备
  DEVICE_SCAN: 'device:scan',
  DEVICE_CONNECT: 'device:connect',
  DEVICE_DISCONNECT: 'device:disconnect',
  DEVICE_LIST: 'device:list',
  DEVICE_ADD: 'device:add',
  DEVICE_REMOVE: 'device:remove',
  DEVICE_RENAME: 'device:rename',
  DEVICE_STATUS: 'device:status',
  DEVICE_ON_STATUS_CHANGE: 'device:onStatusChange',
  DEVICE_AUTHENTICATE: 'device:authenticate',
  DEVICE_IDENTIFY: 'device:identify',
  DEVICE_GET_LOCAL_IP: 'device:getLocalIP',
  DEVICE_PING_ALL: 'device:pingAll',
  DEVICE_ONLINE_STATUS: 'device:onlineStatus',
  DEVICE_ON_ONLINE_CHANGE: 'device:onOnlineChange',

  // 控制
  CONTROL_SWITCH: 'control:switch',
  CONTROL_BRIGHTNESS: 'control:brightness',
  CONTROL_COLOR: 'control:color',
  CONTROL_CT: 'control:ct',
  CONTROL_APPLY_EFFECT: 'control:applyEffect',
  CONTROL_WRITE_EFFECT: 'control:writeEffect',
  CONTROL_EFFECT_LIST: 'control:effectList',
  CONTROL_EFFECT_DETAILS: 'control:effectDetails',

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
  AGENT_ON_TOOL_STATUS: 'agent:onToolStatus',

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
  authToken?: string
}

export type DeviceStatus = 'disconnected' | 'connecting' | 'connected' | 'auth_required' | 'error'

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

// ============ 颜色 ============
export interface ColorHSB {
  h: number
  s: number
  b: number
}

// ============ Nanoleaf 设备信息 ============
export interface NanoleafDeviceInfo {
  name: string
  serialNo: string
  manufacturer: string
  firmwareVersion: string
  model: string
  state: {
    on: { value: boolean }
    brightness: { value: number; max: number; min: number }
    hue: { value: number; max: number; min: number }
    sat: { value: number; max: number; min: number }
    ct: { value: number; max: number; min: number }
    colorMode: string
  }
}

// ============ 灯效控制 ============
export interface EffectPaletteColor {
  r: number
  g: number
  b: number
}

export interface EffectInfo {
  id: string
  name: string
  description: string
  params: EffectParamDef[]
  palette?: EffectPaletteColor[]
}

export interface EffectDetail extends EffectInfo {
  palette: EffectPaletteColor[]
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

// ============ Agent Tool Calling ============
export interface ToolCallRecord {
  id: string
  name: string
  arguments: Record<string, unknown>
  result?: unknown
  error?: string
}

// ============ 聊天 ============
export type MessageRole = 'user' | 'assistant' | 'system'

export interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  skill?: Skill
  toolCalls?: ToolCallRecord[]
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
