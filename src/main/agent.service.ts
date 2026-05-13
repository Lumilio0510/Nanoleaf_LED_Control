import { readJSON, writeJSON } from './storage'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import type { LLMConfig, ChatMessage, ChatSession, Skill, QuickCommand } from '../shared/types'
import { getAdapter, type ChatMessage as LLMMessage } from './llm'

function getLlmConfig(): LLMConfig {
  return readJSON<LLMConfig>('llm.json', { provider: 'openai', apiKey: '', baseUrl: '', model: '' })
}

function getApiDoc(): string {
  const docPath = join(app.getPath('userData'), 'data', 'api-doc.md')
  if (!existsSync(docPath)) return ''
  return readFileSync(docPath, 'utf-8')
}

function buildSystemPrompt(): string {
  const apiDoc = getApiDoc()
  return `你是一个 LED 灯效控制助手。根据以下 LED 设备 API 文档，理解用户想要什么灯效，生成对应的 Skill JSON。

## Skill JSON 格式
\`\`\`json
{
  "meta": { "id": "生成的UUID", "name": "灯效名称", "description": "简短描述", "tags": ["标签1"], "version": 1, "createdAt": "ISO时间", "updatedAt": "ISO时间" },
  "params": [ { "key": "参数名", "label": "显示名", "type": "range|color|select|number|text", "min": 1, "max": 10, "default": 默认值 } ],
  "mapping": { "endpoint": "METHOD /path", "bodyTemplate": { "key": "{{params.参数名}}" } }
}
\`\`\`

## API 文档
${apiDoc || '（未提供 API 文档，请等待用户提供）'}

## 规则
1. 根据 API 文档填写正确的 endpoint 和 bodyTemplate
2. params 中的参数用于 bodyTemplate 中的 {{params.xxx}} 模板替换
3. 直接返回 JSON，不要包含额外解释文字
4. 如果用户不是请求生成灯效，正常回复即可`
}

export async function chat(sessionId: string, userMessage: string): Promise<ChatMessage> {
  const config = getLlmConfig()
  const adapter = getAdapter(config)
  const session = loadSession(sessionId)

  const userMsg: ChatMessage = {
    id: uuidv4(),
    role: 'user',
    content: userMessage,
    timestamp: new Date().toISOString()
  }
  session.messages.push(userMsg)

  const llmMessages: LLMMessage[] = [
    { role: 'system', content: buildSystemPrompt() },
    ...session.messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' as const : 'user' as const, content: m.content }))
  ]

  const response = await adapter.chat(llmMessages, config)

  const assistantMsg: ChatMessage = {
    id: uuidv4(),
    role: 'assistant',
    content: response,
    timestamp: new Date().toISOString()
  }

  const skill = tryExtractSkill(response)
  if (skill) {
    assistantMsg.skill = skill
    assistantMsg.content = `已生成灯效方案：**${skill.meta.name}**`
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
  const config = getLlmConfig()
  const adapter = getAdapter(config)
  const session = loadSession(sessionId)

  const userMsg: ChatMessage = {
    id: uuidv4(),
    role: 'user',
    content: userMessage,
    timestamp: new Date().toISOString()
  }
  session.messages.push(userMsg)

  const llmMessages: LLMMessage[] = [
    { role: 'system', content: buildSystemPrompt() },
    ...session.messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' as const : 'user' as const, content: m.content }))
  ]

  const fullResponse = await adapter.chatStream(llmMessages, config, onChunk)

  const assistantMsg: ChatMessage = {
    id: uuidv4(),
    role: 'assistant',
    content: fullResponse,
    timestamp: new Date().toISOString()
  }

  const skill = tryExtractSkill(fullResponse)
  if (skill) {
    assistantMsg.skill = skill
    assistantMsg.content = `已生成灯效方案：**${skill.meta.name}**`
  }

  session.messages.push(assistantMsg)
  session.updatedAt = new Date().toISOString()
  saveSession(session)

  onComplete(assistantMsg)
}

function tryExtractSkill(text: string): Skill | null {
  try {
    const match = text.match(/\{[\s\S]*"meta"[\s\S]*"mapping"[\s\S]*\}/)
    if (!match) return null
    const skill = JSON.parse(match[0]) as Skill
    if (!skill.meta || !skill.mapping) return null
    if (!skill.meta.id) skill.meta.id = uuidv4()
    if (!skill.meta.createdAt) skill.meta.createdAt = new Date().toISOString()
    if (!skill.meta.updatedAt) skill.meta.updatedAt = new Date().toISOString()
    return skill
  } catch {
    return null
  }
}

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
    id: uuidv4(),
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

const defaultCommands: QuickCommand[] = [
  { id: 'random', label: '🎨 随机灯效', prompt: '随机生成一个灯效' },
  { id: 'off', label: '💡 关灯', prompt: '关闭灯光' },
  { id: 'bright', label: '☀️ 最亮', prompt: '将亮度调到最高' },
  { id: 'night', label: '🌙 夜间模式', prompt: '设置一个适合夜间的低亮度暖色灯效' },
  { id: 'party', label: '🎉 派对模式', prompt: '创建一个彩色闪烁的派对灯效' },
]

export function getQuickCommands(): QuickCommand[] {
  return readJSON<QuickCommand[]>('quick_commands.json', defaultCommands)
}
