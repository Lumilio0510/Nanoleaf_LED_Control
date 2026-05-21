# Agent Tool Calling 重构实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Agent 从单一 Skill 生成器升级为 Tool Calling 驱动的完整 Nanoleaf 设备管理助手

**Architecture:** 扩展 LLMAdapter 接口增加 chatWithTools，新增 16 个工具定义并注册到 `src/main/tools/`，重写 agent.service.ts 为多轮 tool calling 循环，前端通过 `__TOOL_*__` 特殊 chunk 展示工具调用状态

**Tech Stack:** TypeScript, Electron, OpenAI Function Calling API, React + MUI

---

### Task 1: 扩展 LLM 类型定义

**Files:**
- Modify: `src/main/llm/types.ts`

- [ ] **Step 1: 添加 Tool Calling 相关类型**

```ts
import type { LLMConfig } from '../../shared/types'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_call_id?: string
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
}

export interface LLMAdapter {
  chat(messages: ChatMessage[], config: LLMConfig): Promise<string>
  chatStream(messages: ChatMessage[], config: LLMConfig, onChunk: (chunk: string) => void): Promise<string>
  chatWithTools(messages: ChatMessage[], tools: ToolDef[], config: LLMConfig): Promise<ToolCallResponse>
}
```

- [ ] **Step 2: 提交**

```bash
git add src/main/llm/types.ts
git commit -m "feat(llm): add ToolDef, ToolCall, ToolCallResponse types and chatWithTools to adapter"
```

---

### Task 2: OpenAI 适配器实现 chatWithTools

**Files:**
- Modify: `src/main/llm/openai.adapter.ts`

- [ ] **Step 1: 实现 chatWithTools 方法**

修改 `src/main/llm/openai.adapter.ts`，在 `openaiAdapter` 对象中 `chatStream` 方法之后添加 `chatWithTools` 方法。完整文件如下：

```ts
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
          arguments: JSON.parse(tc.function.arguments)
        }))
      }
    }
    return { finishReason: 'stop', content: choice.message.content || '', toolCalls: [] }
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add src/main/llm/openai.adapter.ts
git commit -m "feat(llm): add chatWithTools to OpenAI adapter"
```

---

### Task 3: Ollama 适配器 chatWithTools 桩方法

**Files:**
- Modify: `src/main/llm/ollama.adapter.ts`

- [ ] **Step 1: 添加抛出异常的桩方法**

先读取现有文件确认内容，然后在 `ollamaAdapter` 对象末尾的 `}` 前添加 `chatWithTools` 方法。如果 `chatStream` 是最后一个方法，在其后加上逗号再添加：

```ts
  async chatWithTools(_messages: ChatMessage[], _tools: ToolDef[], _config: LLMConfig): Promise<ToolCallResponse> {
    throw new Error('Tool calling 仅支持 OpenAI 兼容 API，Ollama 暂不支持。请在设置中切换到 OpenAI 提供商。')
  }
```

同时在文件顶部更新 import：

```ts
import type { LLMAdapter, ChatMessage, ToolDef, ToolCallResponse } from './types'
```

- [ ] **Step 2: 提交**

```bash
git add src/main/llm/ollama.adapter.ts
git commit -m "feat(llm): add chatWithTools stub to Ollama adapter"
```

---

### Task 4: 创建工具定义——控制类和设备类

**Files:**
- Create: `src/main/tools/control.tools.ts`

- [ ] **Step 1: 编写控制类和设备类工具定义与执行函数**

```ts
import * as nanoleafApi from '../nanoleaf-api.service'
import { discoverDevices } from '../discovery.service'
import type { ToolDef } from '../llm/types'

type ToolExecutor = (args: Record<string, unknown>) => Promise<unknown>

export const controlToolDefs: ToolDef[] = [
  {
    name: 'setPower',
    description: '开关 Nanoleaf 设备灯光',
    parameters: {
      type: 'object',
      properties: {
        on: { type: 'boolean', description: 'true 为开灯，false 为关灯' }
      },
      required: ['on']
    }
  },
  {
    name: 'setBrightness',
    description: '调节亮度，可指定渐变秒数实现平滑过渡',
    parameters: {
      type: 'object',
      properties: {
        value: { type: 'number', description: '亮度值 0-100', minimum: 0, maximum: 100 },
        duration: { type: 'number', description: '渐变持续的秒数，0 为立即切换' }
      },
      required: ['value']
    }
  },
  {
    name: 'setColor',
    description: '设置 HSB 颜色（色相/饱和度/亮度）。饱和度为 0 时显示白色。亮度用于统一亮度控制',
    parameters: {
      type: 'object',
      properties: {
        hue: { type: 'number', description: '色相 0-360', minimum: 0, maximum: 360 },
        saturation: { type: 'number', description: '饱和度 0-100', minimum: 0, maximum: 100 },
        brightness: { type: 'number', description: '亮度 0-100，可选', minimum: 0, maximum: 100 }
      },
      required: ['hue', 'saturation']
    }
  },
  {
    name: 'setColorTemp',
    description: '设置色温（Kelvin 白平衡）。低值为暖光，高值为冷光',
    parameters: {
      type: 'object',
      properties: {
        value: { type: 'number', description: '色温值 1200-6500K', minimum: 1200, maximum: 6500 }
      },
      required: ['value']
    }
  },
  {
    name: 'identifyDevice',
    description: '使当前连接的设备闪烁，用于在多个设备中识别',
    parameters: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'discoverDevices',
    description: '扫描局域网发现新的 Nanoleaf 设备',
    parameters: { type: 'object', properties: {}, required: [] }
  }
]

export const controlExecutors: Record<string, ToolExecutor> = {
  setPower: async (args) => { await nanoleafApi.setPower(args.on as boolean); return { success: true } },
  setBrightness: async (args) => {
    await nanoleafApi.setBrightness(args.value as number, args.duration as number | undefined)
    return { success: true }
  },
  setColor: async (args) => {
    await nanoleafApi.setHSB(args.hue as number, args.saturation as number, (args.brightness ?? 100) as number)
    return { success: true }
  },
  setColorTemp: async (args) => {
    await nanoleafApi.setColorTemperature(args.value as number)
    return { success: true }
  },
  identifyDevice: async () => { await nanoleafApi.identify(); return { success: true } },
  discoverDevices: async () => { return discoverDevices() }
}
```

- [ ] **Step 2: 提交**

```bash
git add src/main/tools/control.tools.ts
git commit -m "feat(tools): add control and device tool definitions"
```

---

### Task 5: 创建查询类工具

**Files:**
- Create: `src/main/tools/query.tools.ts`

- [ ] **Step 1: 编写查询类工具定义与执行函数**

```ts
import * as nanoleafApi from '../nanoleaf-api.service'
import type { ToolDef } from '../llm/types'

type ToolExecutor = (args: Record<string, unknown>) => Promise<unknown>

export const queryToolDefs: ToolDef[] = [
  {
    name: 'getDeviceInfo',
    description: '获取当前连接设备完整信息：名称、型号、序列号、固件版本',
    parameters: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'getDeviceState',
    description: '获取当前设备状态：开关、亮度、色相、饱和度、色温、当前颜色模式',
    parameters: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'getPanelLayout',
    description: '获取面板物理布局数据：面板数量、位置坐标、形状类型',
    parameters: { type: 'object', properties: {}, required: [] }
  }
]

export const queryExecutors: Record<string, ToolExecutor> = {
  getDeviceInfo: async () => { return nanoleafApi.getDeviceInfo() },
  getDeviceState: async () => {
    const info = await nanoleafApi.getDeviceInfo()
    return {
      on: info.state.on.value,
      brightness: info.state.brightness.value,
      hue: info.state.hue.value,
      saturation: info.state.sat.value,
      colorTemp: info.state.ct.value,
      colorMode: info.state.colorMode
    }
  },
  getPanelLayout: async () => { return nanoleafApi.getPanelLayout() }
}
```

- [ ] **Step 2: 提交**

```bash
git add src/main/tools/query.tools.ts
git commit -m "feat(tools): add query tool definitions"
```

---

### Task 6: 创建特效管理和 Skill 类工具

**Files:**
- Create: `src/main/tools/effect.tools.ts`
- Create: `src/main/tools/skill.tools.ts`

- [ ] **Step 1: 特效管理工具**

```ts
// src/main/tools/effect.tools.ts
import * as nanoleafApi from '../nanoleaf-api.service'
import type { ToolDef } from '../llm/types'

type ToolExecutor = (args: Record<string, unknown>) => Promise<unknown>

export const effectToolDefs: ToolDef[] = [
  {
    name: 'listEffects',
    description: '列出设备上所有已保存的特效',
    parameters: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'getCurrentEffect',
    description: '查看设备当前正在运行的特效名称',
    parameters: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'selectEffect',
    description: '切换到指定名称的已保存特效',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '特效名称，必须与设备上的名称完全匹配' }
      },
      required: ['name']
    }
  },
  {
    name: 'deleteEffect',
    description: '从设备上删除指定特效',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '要删除的特效名称' }
      },
      required: ['name']
    }
  },
  {
    name: 'renameEffect',
    description: '重命名设备上的特效',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '当前特效名称' },
        newName: { type: 'string', description: '新名称' }
      },
      required: ['name', 'newName']
    }
  }
]

export const effectExecutors: Record<string, ToolExecutor> = {
  listEffects: async () => { return nanoleafApi.getEffectsList() },
  getCurrentEffect: async () => {
    const info = await nanoleafApi.getDeviceInfo()
    return { currentEffect: info.state.colorMode === 'effect' ? '（无法从 state 端点直接获取当前特效名）' : '非特效模式' }
  },
  selectEffect: async (args) => { await nanoleafApi.setEffect(args.name as string); return { success: true } },
  deleteEffect: async (args) => { await nanoleafApi.deleteEffect(args.name as string); return { success: true } },
  renameEffect: async (args) => {
    await nanoleafApi.sendRequest('PUT', '/effects', {
      write: { command: 'rename', animName: args.name as string, newName: args.newName as string }
    })
    return { success: true }
  }
}
```

- [ ] **Step 2: Skill 类工具**

```ts
// src/main/tools/skill.tools.ts
import * as nanoleafApi from '../nanoleaf-api.service'
import * as skillService from '../skill.service'
import { randomUUID } from 'crypto'
import type { ToolDef } from '../llm/types'

type ToolExecutor = (args: Record<string, unknown>) => Promise<unknown>

const PLUGIN_UUIDS: Record<string, string> = {
  flow: '027842e4-e1d6-4a4c-a731-be74a1ebd4cf',
  wheel: '6970681a-20b5-4c5e-8813-bdaebc4ee4fa',
  explode: '713518c1-d560-47db-8991-de780af71d1e',
  fade: 'b3fd723a-aae8-4c99-bf2b-087159e0ef53',
  random: 'ba632d3e-9c2b-4413-a965-510c839b3f71',
  highlight: '70b7c636-6bf8-491f-89c1-f4103508d642'
}

export const skillToolDefs: ToolDef[] = [
  {
    name: 'createEffect',
    description: `创建/更新一个 Nanoleaf 灯效并保存到 Skill 库。支持三种类型：
1. plugin（动态特效）：使用内置插件如 Flow/Wheel/Random 等，需提供 pluginUuid、pluginType、pluginOptions、palette
2. static（静态布局）：每面板独立颜色，需提供 animData 字符串
3. solid（纯色）：最简单的统一纯色，只需一个 palette 颜色
已知 pluginUuid 和对应名称：${Object.entries(PLUGIN_UUIDS).map(([k, v]) => `${k}: ${v}`).join(', ')}`,
    parameters: {
      type: 'object',
      properties: {
        effectDefinition: {
          type: 'object',
          description: '完整的 Nanoleaf effect JSON，command 固定为 "add"，version 固定为 "2.0"',
          properties: {
            command: { type: 'string', enum: ['add'] },
            animName: { type: 'string', description: '特效名称' },
            version: { type: 'string', enum: ['2.0'] },
            animType: { type: 'string', enum: ['plugin', 'static', 'solid'] },
            colorType: { type: 'string', enum: ['HSB'] }
          },
          required: ['command', 'animName', 'animType', 'colorType']
        }
      },
      required: ['effectDefinition']
    }
  },
  {
    name: 'previewEffect',
    description: '临时预览灯效，不保存到设备上。duration 秒后自动恢复到之前状态',
    parameters: {
      type: 'object',
      properties: {
        effectDefinition: {
          type: 'object',
          description: '完整的 Nanoleaf effect JSON，不含 command 字段（自动使用 display）'
        },
        duration: { type: 'number', description: '预览持续秒数，默认 10', minimum: 1, maximum: 300 }
      },
      required: ['effectDefinition']
    }
  }
]

export const skillExecutors: Record<string, ToolExecutor> = {
  createEffect: async (args) => {
    const def = args.effectDefinition as Record<string, unknown>
    const writePayload: Record<string, unknown> = { command: 'add', ...def }
    await nanoleafApi.sendRequest('PUT', '/effects', { write: writePayload })

    const skillId = randomUUID()
    const skill = {
      meta: {
        id: skillId,
        name: def.animName as string,
        description: `由 AI 生成的 ${def.animType} 灯效`,
        tags: ['AI生成'],
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      params: [] as { key: string; label: string; type: string; default: unknown }[],
      mapping: {
        endpoint: 'PUT /effects',
        bodyTemplate: { write: writePayload }
      }
    }
    skillService.saveSkill(skill)
    return { skillId: skill.meta.id, skillName: skill.meta.name, effectDef: def }
  },
  previewEffect: async (args) => {
    const def = args.effectDefinition as Record<string, unknown>
    const duration = (args.duration as number) || 10
    const displayPayload: Record<string, unknown> = { command: 'display', duration, version: '2.0', ...def }
    await nanoleafApi.sendRequest('PUT', '/effects', { write: displayPayload })
    return { success: true, duration }
  }
}
```

- [ ] **Step 3: 提交**

```bash
git add src/main/tools/effect.tools.ts src/main/tools/skill.tools.ts
git commit -m "feat(tools): add effect management and skill tool definitions"
```

---

### Task 7: 创建工具注册表

**Files:**
- Create: `src/main/tools/index.ts`

- [ ] **Step 1: 聚合所有工具定义和执行器**

```ts
import type { ToolDef } from '../llm/types'
import { controlToolDefs, controlExecutors } from './control.tools'
import { queryToolDefs, queryExecutors } from './query.tools'
import { effectToolDefs, effectExecutors } from './effect.tools'
import { skillToolDefs, skillExecutors } from './skill.tools'

type ToolExecutor = (args: Record<string, unknown>) => Promise<unknown>

export const allToolDefs: ToolDef[] = [
  ...controlToolDefs,
  ...queryToolDefs,
  ...effectToolDefs,
  ...skillToolDefs
]

const allExecutors: Record<string, ToolExecutor> = {
  ...controlExecutors,
  ...queryExecutors,
  ...effectExecutors,
  ...skillExecutors
}

export function executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const exec = allExecutors[name]
  if (!exec) throw new Error(`未知工具: ${name}`)
  return exec(args)
}
```

- [ ] **Step 2: 提交**

```bash
git add src/main/tools/index.ts
git commit -m "feat(tools): add tool registry aggregating all tool definitions"
```

---

### Task 8: 扩展共享类型和 IPC 通道

**Files:**
- Modify: `src/shared/types.ts`

- [ ] **Step 1: 添加 ToolCallRecord 类型和新的 IPC 通道**

在 `src/shared/types.ts` 中，`ChatMessage` 接口定义后添加 `ToolCallRecord` 接口，并更新 `ChatMessage`：

```ts
// 在 ChatMessage 之前添加：
export interface ToolCallRecord {
  id: string
  name: string
  arguments: Record<string, unknown>
  result?: unknown
  error?: string
}

// 修改现有的 ChatMessage 接口：
export interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  skill?: Skill
  toolCalls?: ToolCallRecord[]
  timestamp: string
}
```

在 `IPC` 对象中添加新的通道常量：

```ts
// 在 AGENT_ON_STREAM_CHUNK 后面添加：
AGENT_ON_TOOL_STATUS: 'agent:onToolStatus',
```

- [ ] **Step 2: 提交**

```bash
git add src/shared/types.ts
git commit -m "feat(types): add ToolCallRecord type and tool status IPC channel"
```

---

### Task 9: 重写 Agent Service

**Files:**
- Modify: `src/main/agent.service.ts`

- [ ] **Step 1: 重写 agent.service.ts 核心逻辑**

重写后的完整文件：

```ts
import { readJSON, writeJSON } from './storage'
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import electron from 'electron'
const { app } = electron
import { randomUUID } from 'crypto'
import type { LLMConfig, ChatMessage, ChatSession, Skill, QuickCommand, ToolCallRecord } from '../shared/types'
import { getAdapter, type ChatMessage as LLMMessage } from './llm'
import type { ToolDef } from './llm/types'
import { allToolDefs, executeTool } from './tools'
import { getDeviceStatus } from './device.service'

const MAX_TOOL_ROUNDS = 5

function getLlmConfig(): LLMConfig {
  return readJSON<LLMConfig>('llm.json', { provider: 'openai', apiKey: '', baseUrl: '', model: '' })
}

function getApiDoc(): string {
  const dataDir = join(app.getPath('userData'), 'data')
  const docPath = join(dataDir, 'api-doc.md')

  if (!existsSync(docPath)) {
    mkdirSync(dataDir, { recursive: true })
    const defaultDoc = DEFAULT_API_DOC
    writeFileSync(docPath, defaultDoc, 'utf-8')
    return defaultDoc
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

    // 执行 tool calls
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
      // 流式输出最终文本
      for (let i = 0; i < text.length; i++) {
        onChunk(text[i])
        await sleep(10)
      }
      return { content: text, toolCalls: toolCallRecords }
    }

    // 通知前端工具调用开始
    for (const tc of response.toolCalls) {
      onChunk(`__TOOL_START__${JSON.stringify({ id: tc.id, name: tc.name, args: tc.arguments })}`)
    }

    // 执行 tool calls
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

// ====== 会话管理（不变） ======

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
```

- [ ] **Step 2: 提交**

```bash
git add src/main/agent.service.ts
git commit -m "feat(agent): rewrite with tool calling loop and dynamic system prompt"
```

---

### Task 10: 更新 IPC Handlers

**Files:**
- Modify: `src/main/ipc-handlers.ts`

- [ ] **Step 1: 更新 agent:chatStream handler**

在 `src/main/ipc-handlers.ts` 中，修改 `AGENT_CHAT_STREAM` handler：

找到：
```ts
  ipcMain.on(IPC.AGENT_CHAT_STREAM, (event, sessionId: string, message: string) => {
    agentService.chatStream(
      sessionId,
      message,
      (chunk) => event.sender.send(IPC.AGENT_ON_STREAM_CHUNK, chunk),
      (msg) => {
        if (msg.skill) {
          skillService.saveSkill(msg.skill)
        }
        event.sender.send(IPC.AGENT_ON_STREAM_CHUNK, '__DONE__')
      }
    )
  })
```

替换为：
```ts
  ipcMain.on(IPC.AGENT_CHAT_STREAM, (event, sessionId: string, message: string) => {
    agentService.chatStream(
      sessionId,
      message,
      (chunk) => {
        // chunk 可能是普通文本、__TOOL_START__/__TOOL_DONE__/__TOOL_ERROR__ 或最终文本
        event.sender.send(IPC.AGENT_ON_STREAM_CHUNK, chunk)
      },
      (msg) => {
        event.sender.send(IPC.AGENT_ON_STREAM_CHUNK, `__SKILL__${JSON.stringify(msg.skill || null)}`)
        event.sender.send(IPC.AGENT_ON_STREAM_CHUNK, '__DONE__')
      }
    )
  })
```

同样的修改应用于 `AGENT_QUICK_COMMAND` handler：

```ts
  ipcMain.on(IPC.AGENT_QUICK_COMMAND, (event, commandId: string) => {
    const commands = agentService.getQuickCommands()
    const cmd = commands.find(c => c.id === commandId)
    if (cmd) {
      agentService.chatStream(
        'default',
        cmd.prompt,
        (chunk) => event.sender.send(IPC.AGENT_ON_STREAM_CHUNK, chunk),
        (msg) => {
          event.sender.send(IPC.AGENT_ON_STREAM_CHUNK, `__SKILL__${JSON.stringify(msg.skill || null)}`)
          event.sender.send(IPC.AGENT_ON_STREAM_CHUNK, '__DONE__')
        }
      )
    }
  })
```

- [ ] **Step 2: 提交**

```bash
git add src/main/ipc-handlers.ts
git commit -m "feat(ipc): update stream handlers for tool call status chunks"
```

---

### Task 11: 更新 Preload 和 API 层

**Files:**
- Modify: `src/main/preload.ts`
- Modify: `src/renderer/api.ts`

- [ ] **Step 1: 更新 preload.ts**

`src/main/preload.ts` 无需新增方法，现有的 `onStreamChunk` 已够用。确认 `api.ts` 中的类型声明匹配即可。

- [ ] **Step 2: 更新 renderer/api.ts 的 ToolCallRecord 导入**

在 `src/renderer/api.ts` 顶部添加 `ToolCallRecord` 导入：
```ts
import type { DeviceConfig, DeviceState, DiscoveredDevice, EffectInfo, Skill, ChatSession, ChatMessage, QuickCommand, LLMConfig, ToolCallRecord } from './types'
```

文件其余部分不变。类型通过 `shared/types.ts` 的更新自动同步。

- [ ] **Step 3: 提交**

```bash
git add src/main/preload.ts src/renderer/api.ts
git commit -m "feat(api): add ToolCallRecord type import"
```

---

### Task 12: 更新 useChat Hook 处理工具状态 chunks

**Files:**
- Modify: `src/renderer/hooks/useChat.ts`

- [ ] **Step 1: 重写 useChat hook 支持工具调用状态**

```ts
import { useState, useEffect, useCallback } from 'react'
import { api } from '../api'
import type { ChatMessage, ChatSession, ToolCallRecord } from '../types'

interface ToolStatus {
  id: string
  name: string
  status: 'running' | 'done' | 'error'
  error?: string
}

export function useChat() {
 const [sessions, setSessions] = useState<ChatSession[]>([])
 const [currentSessionId, setCurrentSessionId] = useState<string>('')
 const [messages, setMessages] = useState<ChatMessage[]>([])
 const [streaming, setStreaming] = useState('')
 const [isStreaming, setIsStreaming] = useState(false)
 const [toolStatuses, setToolStatuses] = useState<ToolStatus[]>([])
 const [pendingSkill, setPendingSkill] = useState<ChatMessage['skill']>(null)

 useEffect(() => {
 api.getSessions().then(s => {
 setSessions(s)
 if (s.length > 0 && !currentSessionId) {
 setCurrentSessionId(s[0].id)
 }
 })
 }, [])

 useEffect(() => {
 if (!currentSessionId) return
 api.getSession(currentSessionId).then(s => {
 if (s) setMessages(s.messages)
 })
 }, [currentSessionId])

 const sendStream = useCallback((text: string) => {
 const sid = currentSessionId || 'default'
 const userMsg: ChatMessage = {
 id: crypto.randomUUID(),
 role: 'user',
 content: text,
 timestamp: new Date().toISOString()
 }
 setMessages(prev => [...prev, userMsg])
 setIsStreaming(true)
 setStreaming('')
 setToolStatuses([])
 setPendingSkill(null)

 const unsub = api.onStreamChunk((chunk: string) => {
   if (chunk === '__DONE__') {
     setIsStreaming(false)
     setStreaming('')
     setToolStatuses([])
     unsub()
     api.getSession(sid).then(s => {
       if (s) {
         setMessages(s.messages)
         if (!currentSessionId) setCurrentSessionId(s.id)
       }
     })
     api.getSessions().then(setSessions)
     return
   }

   if (chunk.startsWith('__TOOL_START__')) {
     const data = JSON.parse(chunk.slice('__TOOL_START__'.length)) as { id: string; name: string; args: Record<string, unknown> }
     setToolStatuses(prev => [...prev, { id: data.id, name: data.name, status: 'running' }])
     return
   }
   if (chunk.startsWith('__TOOL_DONE__')) {
     const data = JSON.parse(chunk.slice('__TOOL_DONE__'.length)) as { id: string; name: string }
     setToolStatuses(prev => prev.map(t => t.id === data.id ? { ...t, status: 'done' } : t))
     return
   }
   if (chunk.startsWith('__TOOL_ERROR__')) {
     const data = JSON.parse(chunk.slice('__TOOL_ERROR__'.length)) as { id: string; name: string; error: string }
     setToolStatuses(prev => prev.map(t => t.id === data.id ? { ...t, status: 'error', error: data.error } : t))
     return
   }

   if (chunk.startsWith('__SKILL__')) {
     const skill = JSON.parse(chunk.slice('__SKILL__'.length))
     if (skill) setPendingSkill(skill)
     return
   }

   setStreaming(prev => prev + chunk)
 })

 api.chatStream(sid, text)
 }, [currentSessionId])

 const createNewSession = useCallback(async () => {
 const session = await api.createSession()
 setSessions(prev => [session, ...prev])
 setCurrentSessionId(session.id)
 setMessages([])
 }, [])

 const deleteSession = useCallback(async (id: string) => {
 await api.deleteSession(id)
 setSessions(prev => prev.filter(s => s.id !== id))
 if (currentSessionId === id) {
 const remaining = sessions.filter(s => s.id !== id)
 setCurrentSessionId(remaining[0]?.id || '')
 }
 }, [currentSessionId, sessions])

 const switchSession = useCallback((id: string) => {
 setCurrentSessionId(id)
 }, [])

 return {
 currentSessionId, messages, streaming, isStreaming, sessions,
 toolStatuses, pendingSkill,
 sendStream, createNewSession, deleteSession, switchSession
 }
}
```

- [ ] **Step 2: 提交**

```bash
git add src/renderer/hooks/useChat.ts
git commit -m "feat(chat): handle tool status chunks in useChat hook"
```

---

### Task 13: 更新 AgentChat 组件展示工具调用状态

**Files:**
- Modify: `src/renderer/components/AgentChat.tsx`
- Modify: `src/renderer/components/ChatWindow.tsx`

- [ ] **Step 1: 更新 ChatWindow 接收 toolStatuses 并展示**

在 `ChatWindow.tsx` 中修改 props 以接受 `toolStatuses`：

```ts
// 修改 props 类型
interface ToolStatus {
  id: string
  name: string
  status: 'running' | 'done' | 'error'
  error?: string
}

export default function ChatWindow({ messages, streaming, toolStatuses }: { messages: ChatMessage[]; streaming: string; toolStatuses: ToolStatus[] }) {
```

在 streaming 状态的 Paper 之前，添加 toolStatuses 展示：

```ts
{/* 在 streaming 的 Stack 之前添加 */}
{toolStatuses.length > 0 && (
  <Stack direction="row" sx={{ mb: 2 }}>
    <Paper variant="outlined" sx={{ maxWidth: '80%', px: 2, py: 1, borderRadius: 3, bgcolor: 'primary.light', color: 'white' }}>
      {toolStatuses.map(ts => (
        <Typography key={ts.id} variant="caption" sx={{ display: 'block' }}>
          {ts.status === 'running' && `⏳ ${toolLabel(ts.name)}...`}
          {ts.status === 'done' && `✅ ${toolLabel(ts.name)} 完成`}
          {ts.status === 'error' && `❌ ${toolLabel(ts.name)} 失败: ${ts.error}`}
        </Typography>
      ))}
    </Paper>
  </Stack>
)}
```

在 ChatWindow 文件末尾添加辅助函数（export 之前）：

```ts
function toolLabel(name: string): string {
  const labels: Record<string, string> = {
    setPower: '开关灯', setBrightness: '调节亮度', setColor: '设置颜色', setColorTemp: '设置色温',
    getDeviceInfo: '获取设备信息', getDeviceState: '查询状态', getPanelLayout: '获取面板布局',
    listEffects: '列出特效', getCurrentEffect: '查询当前特效', selectEffect: '切换特效',
    deleteEffect: '删除特效', renameEffect: '重命名特效',
    createEffect: '创建灯效', previewEffect: '预览灯效',
    identifyDevice: '识别设备', discoverDevices: '扫描设备'
  }
  return labels[name] || name
}
```

- [ ] **Step 2: 更新 AgentChat.tsx 传递 toolStatuses**

修改 `AgentChat.tsx` 的 ChatWindow 调用：

```ts
<ChatWindow messages={chat.messages} streaming={chat.streaming} toolStatuses={chat.toolStatuses} />
```

- [ ] **Step 3: 提交**

```bash
git add src/renderer/components/ChatWindow.tsx src/renderer/components/AgentChat.tsx
git commit -m "feat(ui): show tool call status inline in chat window"
```

---

### Task 14: 验证构建

**Files:** 无

- [ ] **Step 1: 运行 TypeScript 编译检查**

```bash
npx tsc --noEmit
```

检查是否有类型错误，逐一修复。

- [ ] **Step 2: 运行构建**

```bash
npm run build
```

确认构建成功，无错误。

- [ ] **Step 3: 提交（如有修复）**

```bash
git add -A
git commit -m "fix: resolve type errors and build issues"
```
