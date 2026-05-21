import { readJSON, writeJSON } from './storage'
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import electron from 'electron'
const { app } = electron
import { randomUUID } from 'crypto'
import type { LLMConfig, ChatMessage, ChatSession, QuickCommand, ToolCallRecord } from '../shared/types'
import { getAdapter, type ChatMessage as LLMMessage } from './llm'
import { allToolDefs, executeTool } from './tools'
import { getDeviceStatus } from './device.service'

const MAX_TOOL_ROUNDS = 5

function getLlmConfig(): LLMConfig {
  return readJSON<LLMConfig>('llm.json', { provider: 'openai', apiKey: '', baseUrl: '', model: '' })
}

function getApiDoc(): string {
  if (!app.isPackaged) {
    const projectDoc = join(app.getAppPath(), 'docs', 'Nanoleaf OpenAPI.md')
    if (existsSync(projectDoc)) return readFileSync(projectDoc, 'utf-8')
  }

  const dataDir = join(app.getPath('userData'), 'data')
  const docPath = join(dataDir, 'api-doc.md')

  if (!existsSync(docPath)) {
    mkdirSync(dataDir, { recursive: true })
    writeFileSync(docPath, DEFAULT_API_DOC, 'utf-8')
    return DEFAULT_API_DOC
  }

  const content = readFileSync(docPath, 'utf-8')
  return content || DEFAULT_API_DOC
}

function buildDeviceContext(): string {
  const { config, status } = getDeviceStatus()
  if (!config || status !== 'connected') {
    return '当前未连接设备。提示用户先连接设备。'
  }
  return `当前连接: ${config.name} | ${config.host}:${config.port} | 在线`
}

function buildSystemPrompt(): string {
  const apiDoc = getApiDoc()
  const deviceContext = buildDeviceContext()

  return `你是 Nanoleaf LED 智能灯板控制助手。你可以直接操控设备、查询状态、管理特效、生成灯效方案。

## 当前设备
${deviceContext}

## 工作方式
根据用户意图，选择最合适的工具（function）来完成任务：
- 简单控制指令（开关/调亮度/改颜色）→ 直接调用对应工具
- 查询状态 → 调用查询工具获取实时数据
- 特效管理 → 调用特效管理工具
- 创建灯效 → 调用 createEffect 工具
- 不知道当前状态时先查询再操作

## createEffect 规则（重要）
生成灯效时，优先使用 plugin 类型（动态特效）：
- 选择最匹配的 pluginUuid（flow=流动渐变, wheel=旋转渐变, explode=爆炸扩散, fade=同步渐变, random=随机变化, highlight=高亮）
- palette 指定 2-6 个 HSB 颜色（hue:0-360, saturation:0-100, brightness:0-100）
- pluginOptions 设置合理参数值（transTime: 过渡时间 1-600 单位0.1秒, loop: 是否循环, linDirection: 方向等）
- animName 用中文描述性名称
- 版本字段 version 固定为 "2.0"
- colorType 固定为 "HSB"

## API 参考文档
${apiDoc}`
}

// ====== 非流式 Tool Calling 核心循环 ======

async function runWithTools(messages: LLMMessage[]): Promise<{ content: string; toolCalls: ToolCallRecord[] }> {
  const config = getLlmConfig()
  const adapter = getAdapter(config)
  const toolCallRecords: ToolCallRecord[] = []

  let round = 0
  while (round < MAX_TOOL_ROUNDS) {
    round++
    const response = await adapter.chatWithTools(messages, allToolDefs, config)

    if (response.finishReason === 'stop') {
      return { content: response.content || '', toolCalls: toolCallRecords }
    }

    for (const tc of response.toolCalls) {
      const record: ToolCallRecord = { id: tc.id, name: tc.name, arguments: tc.arguments }
      try {
        record.result = await executeTool(tc.name, tc.arguments)
      } catch (err) {
        record.error = err instanceof Error ? err.message : String(err)
      }
      toolCallRecords.push(record)
      messages.push({ role: 'assistant', content: '' })
      messages.push({ role: 'tool', content: JSON.stringify(record.error ? { error: record.error } : record.result), tool_call_id: tc.id })
    }
  }

  return { content: '（已达到最大操作轮数，如有需要请继续指示）', toolCalls: toolCallRecords }
}

// ====== 流式 Tool Calling ======

async function runWithToolsStream(
  messages: LLMMessage[],
  onChunk: (chunk: string) => void
): Promise<{ content: string; toolCalls: ToolCallRecord[] }> {
  const config = getLlmConfig()
  const adapter = getAdapter(config)
  const toolCallRecords: ToolCallRecord[] = []

  let round = 0
  while (round < MAX_TOOL_ROUNDS) {
    round++
    const response = await adapter.chatWithTools(messages, allToolDefs, config)

    if (response.finishReason === 'stop') {
      const text = response.content || ''
      for (let i = 0; i < text.length; i++) {
        onChunk(text[i])
        await sleep(10)
      }
      return { content: text, toolCalls: toolCallRecords }
    }

    for (const tc of response.toolCalls) {
      onChunk(`__TOOL_START__${JSON.stringify({ id: tc.id, name: tc.name, args: tc.arguments })}`)
    }

    for (const tc of response.toolCalls) {
      const record: ToolCallRecord = { id: tc.id, name: tc.name, arguments: tc.arguments }
      try {
        record.result = await executeTool(tc.name, tc.arguments)
        onChunk(`__TOOL_DONE__${JSON.stringify({ id: tc.id, name: tc.name, result: record.result })}`)
      } catch (err) {
        record.error = err instanceof Error ? err.message : String(err)
        onChunk(`__TOOL_ERROR__${JSON.stringify({ id: tc.id, name: tc.name, error: record.error })}`)
      }
      toolCallRecords.push(record)
      messages.push({ role: 'assistant', content: '' })
      messages.push({ role: 'tool', content: JSON.stringify(record.error ? { error: record.error } : record.result), tool_call_id: tc.id })
    }
  }

  onChunk('（已达到最大操作轮数，如有需要请继续指示）')
  return { content: '（已达到最大操作轮数，如有需要请继续指示）', toolCalls: toolCallRecords }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ====== 公开 API ======

export async function chat(sessionId: string, userMessage: string): Promise<ChatMessage> {
  const session = loadSession(sessionId)

  const userMsg: ChatMessage = {
    id: randomUUID(),
    role: 'user',
    content: userMessage,
    timestamp: new Date().toISOString()
  }
  session.messages.push(userMsg)

  const llmMessages: LLMMessage[] = [
    { role: 'system', content: buildSystemPrompt() },
    ...session.messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' as const : 'user' as const, content: m.content }))
  ]

  const { content, toolCalls } = await runWithTools(llmMessages)

  const assistantMsg: ChatMessage = {
    id: randomUUID(),
    role: 'assistant',
    content,
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    timestamp: new Date().toISOString()
  }

  session.messages.push(assistantMsg)
  session.updatedAt = new Date().toISOString()
  saveSession(session)

  return assistantMsg
}

export async function chatStream(
  sessionId: string, userMessage: string,
  onChunk: (chunk: string) => void,
  onComplete: (msg: ChatMessage) => void
): Promise<void> {
  const session = loadSession(sessionId)

  const userMsg: ChatMessage = {
    id: randomUUID(),
    role: 'user',
    content: userMessage,
    timestamp: new Date().toISOString()
  }
  session.messages.push(userMsg)

  const llmMessages: LLMMessage[] = [
    { role: 'system', content: buildSystemPrompt() },
    ...session.messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' as const : 'user' as const, content: m.content }))
  ]

  const { content, toolCalls } = await runWithToolsStream(llmMessages, onChunk)

  const assistantMsg: ChatMessage = {
    id: randomUUID(),
    role: 'assistant',
    content,
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    timestamp: new Date().toISOString()
  }

  session.messages.push(assistantMsg)
  session.updatedAt = new Date().toISOString()
  saveSession(session)

  onComplete(assistantMsg)
}

// ====== 会话管理 ======

function loadSession(sessionId: string): ChatSession {
  const sessions = readJSON<ChatSession[]>('chat_sessions.json', [])
  let session = sessions.find(s => s.id === sessionId)
  if (!session) {
    session = {
      id: sessionId,
      title: '新会话',
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    sessions.push(session)
    writeJSON('chat_sessions.json', sessions)
  }
  return session
}

function saveSession(session: ChatSession): void {
  let sessions = readJSON<ChatSession[]>('chat_sessions.json', [])
  const idx = sessions.findIndex(s => s.id === session.id)
  if (idx >= 0) {
    sessions[idx] = session
  } else {
    sessions.push(session)
  }
  if (session.messages.length === 1) {
    session.title = session.messages[0].content.slice(0, 30)
  }
  writeJSON('chat_sessions.json', sessions)
}

export function getSessions(): ChatSession[] {
  return readJSON<ChatSession[]>('chat_sessions.json', [])
}

export function getSession(id: string): ChatSession | null {
  const sessions = readJSON<ChatSession[]>('chat_sessions.json', [])
  return sessions.find(s => s.id === id) || null
}

export function createSession(): ChatSession {
  const session: ChatSession = {
    id: randomUUID(),
    title: '新会话',
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  const sessions = readJSON<ChatSession[]>('chat_sessions.json', [])
  sessions.push(session)
  writeJSON('chat_sessions.json', sessions)
  return session
}

export function deleteSession(id: string): void {
  let sessions = readJSON<ChatSession[]>('chat_sessions.json', [])
  sessions = sessions.filter(s => s.id !== id)
  writeJSON('chat_sessions.json', sessions)
}

const DEFAULT_API_DOC = `# Nanoleaf Light Panels Open API

## 基本信息
- 端口：16021
- 协议：HTTP REST
- 认证：auth_token（POST /api/v1/new）

## 端点
- GET / → 设备完整信息
- PUT /state → 设置状态 { "on": {"value": true}, "brightness": {"value": 80}, "hue": {"value": 240}, "sat": {"value": 100}, "ct": {"value": 4000} }
- PUT /effects → 特效命令 { "write": { "command": "add|display|delete|rename|request|requestAll" } }
- GET /effects/effectsList → 列出特效
- POST /identify → 闪烁识别

## 插件 UUID
- Flow: 027842e4-e1d6-4a4c-a731-be74a1ebd4cf
- Wheel: 6970681a-20b5-4c5e-8813-bdaebc4ee4fa
- Explode: 713518c1-d560-47db-8991-de780af71d1e
- Fade: b3fd723a-aae8-4c99-bf2b-087159e0ef53
- Random: ba632d3e-9c2b-4413-a965-510c839b3f71
- Highlight: 70b7c636-6bf8-491f-89c1-f4103508d642
`

const defaultCommands: QuickCommand[] = [
  { id: 'random', label: '🎨 随机灯效', prompt: '生成一个随机色彩流动的灯效' },
  { id: 'off', label: '💡 关灯', prompt: '关闭灯光' },
  { id: 'bright', label: '☀️ 最亮', prompt: '将亮度调到最高' },
  { id: 'night', label: '🌙 夜间模式', prompt: '设置一个适合夜间的低亮度暖色温灯效，色温约2700K' },
  { id: 'party', label: '🎉 派对模式', prompt: '创建一个多彩快速切换的派对灯效，使用flow或wheel插件' },
]

export function getQuickCommands(): QuickCommand[] {
  return readJSON<QuickCommand[]>('quick_commands.json', defaultCommands)
}
