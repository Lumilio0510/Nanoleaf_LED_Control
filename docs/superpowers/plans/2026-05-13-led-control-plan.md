# LED Control 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建基于 Electron 的 LED 灯板桌面控制工具，集成 AI Agent 通过自然语言生成灯效方案。

**Architecture:** Electron 主进程作为后端中枢（LED API 网关 + LLM 编排 + Skill 管理 + 本地存储），React 渲染进程作为纯 UI，通过 IPC 通信。Skill 系统以 JSON 文件存储，包含参数定义和 API 映射模板，由 LLM 生成、用户可调参执行。

**Tech Stack:** Electron + electron-vite + React 18 + TypeScript + Tailwind CSS + OpenAI SDK + Ollama REST API

---

## 文件结构总览

```
src/
├── shared/                          # 主进程 & 渲染进程共享
│   └── types.ts                     # 类型定义 + IPC 通道常量
├── main/                            # 主进程
│   ├── main.ts                      # 入口，窗口管理
│   ├── preload.ts                   # contextBridge
│   ├── storage.ts                   # JSON 文件读写
│   ├── device.service.ts            # 设备发现、连接、心跳
│   ├── led-api.service.ts           # LED HTTP 网关
│   ├── skill.service.ts             # Skill CRUD
│   ├── skill-executor.ts            # 模板引擎 + API 调用
│   ├── llm/
│   │   ├── types.ts                 # LLM 适配器接口
│   │   ├── openai.adapter.ts        # OpenAI 实现
│   │   └── ollama.adapter.ts        # Ollama 实现
│   ├── agent.service.ts             # 意图识别 + LLM 编排
│   └── ipc-handlers.ts              # 所有 IPC 处理器注册
└── renderer/                        # 渲染进程
    ├── index.html
    ├── main.tsx                     # React 入口
    ├── App.tsx                      # 布局壳
    ├── global.css                   # Tailwind + 基础样式
    ├── types.ts                     # 渲染进程专用类型
    ├── api.ts                       # IPC 调用封装（preload 桥接）
    ├── components/
    │   ├── Sidebar.tsx
    │   ├── StatusBar.tsx
    │   ├── ControlPanel.tsx
    │   ├── DeviceConnector.tsx
    │   ├── BasicControls.tsx
    │   ├── EffectList.tsx
    │   ├── SkillLibrary.tsx
    │   ├── SkillCard.tsx
    │   ├── SkillEditor.tsx
    │   ├── AgentChat.tsx
    │   ├── ChatWindow.tsx
    │   ├── ChatInput.tsx
    │   ├── QuickCommands.tsx
    │   ├── SessionManager.tsx
    │   ├── SettingsPage.tsx
    │   ├── DeviceSettings.tsx
    │   └── LLMSettings.tsx
    └── hooks/
        ├── useDevices.ts
        ├── useSkills.ts
        └── useChat.ts
```

---

### Task 1: 工程脚手架搭建

**Files:**
- Create: `package.json`
- Create: `electron.vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `tsconfig.web.json`
- Create: `tailwind.config.js`
- Create: `postcss.config.js`
- Create: `src/main/main.ts`
- Create: `src/main/preload.ts`
- Create: `src/renderer/index.html`
- Create: `src/renderer/main.tsx`
- Create: `src/renderer/App.tsx`
- Create: `src/renderer/global.css`
- Create: `.gitignore`

- [ ] **Step 1: 初始化 package.json**

```bash
cd "d:/my/Softwaves/LED_Control" && npm init -y
```

- [ ] **Step 2: 安装依赖**

```bash
npm install react react-dom
npm install -D electron electron-vite @vitejs/plugin-react typescript @types/react @types/react-dom tailwindcss @tailwindcss/vite postcss autoprefixer
```

- [ ] **Step 3: 创建 tsconfig.json（项目根）**

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.node.json" },
    { "path": "./tsconfig.web.json" }
  ]
}
```

- [ ] **Step 4: 创建 tsconfig.node.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./out",
    "sourceMap": true,
    "resolveJsonModule": true,
    "declaration": true
  },
  "include": ["src/main/**/*.ts", "src/shared/**/*.ts", "electron.vite.config.ts"]
}
```

- [ ] **Step 5: 创建 tsconfig.web.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "react-jsx",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": false
  },
  "include": ["src/renderer/**/*.ts", "src/renderer/**/*.tsx", "src/shared/**/*.ts"]
}
```

- [ ] **Step 6: 创建 electron.vite.config.ts**

```typescript
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  main: {
    build: {
      outDir: 'out/main',
      rollupOptions: {
        input: { main: resolve(__dirname, 'src/main/main.ts') }
      }
    }
  },
  preload: {
    build: {
      outDir: 'out/preload',
      rollupOptions: {
        input: { preload: resolve(__dirname, 'src/main/preload.ts') }
      }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    build: { outDir: 'out/renderer' },
    plugins: [react(), tailwindcss()]
  }
})
```

- [ ] **Step 7: 创建 tailwind.config.js**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/**/*.{ts,tsx,html}'],
  theme: { extend: {} },
  plugins: []
}
```

- [ ] **Step 8: 创建 postcss.config.js**

```javascript
export default {
  plugins: {
    autoprefixer: {}
  }
}
```

- [ ] **Step 9: 创建 src/main/main.ts**

```typescript
import { app, BrowserWindow } from 'electron'
import { join } from 'path'

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Softwaves LED Control',
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
```

- [ ] **Step 10: 创建 src/main/preload.ts**

```typescript
import { contextBridge, ipcRenderer } from 'electron'

const api = {
  invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args),
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => callback(...args)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  }
}

contextBridge.exposeInMainWorld('electronAPI', api)
```

- [ ] **Step 11: 创建 src/renderer/index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Softwaves LED Control</title>
</head>
<body class="bg-gray-950 text-white">
  <div id="root"></div>
  <script type="module" src="./main.tsx"></script>
</body>
</html>
```

- [ ] **Step 12: 创建 src/renderer/main.tsx**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './global.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 13: 创建 src/renderer/App.tsx**

```tsx
export default function App() {
  return (
    <div className="flex h-screen items-center justify-center">
      <h1 className="text-2xl">Softwaves LED Control</h1>
    </div>
  )
}
```

- [ ] **Step 14: 创建 src/renderer/global.css**

```css
@import "tailwindcss";
```

- [ ] **Step 15: 创建 .gitignore**

```
node_modules/
out/
dist/
.DS_Store
```

- [ ] **Step 16: 更新 package.json scripts**

Read `package.json`, edit the `scripts` field to:

```json
{
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview"
  }
}
```

Also add `"main": "./out/main/main.js"` to package.json.

- [ ] **Step 17: 验证启动**

```bash
npx electron-vite dev
```

Expected: Electron 窗口打开，显示 "Softwaves LED Control" 标题。

- [ ] **Step 18: Commit**

```bash
git add -A && git commit -m "feat: scaffold Electron + React + TypeScript project"
```

---

### Task 2: 共享类型定义

**Files:**
- Create: `src/shared/types.ts`

- [ ] **Step 1: 创建 src/shared/types.ts**

```typescript
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
```

- [ ] **Step 2: 验证编译**

```bash
npx tsc --project tsconfig.node.json --noEmit && npx tsc --project tsconfig.web.json --noEmit
```

Expected: 无错误。

- [ ] **Step 3: Commit**

```bash
git add src/shared/types.ts && git commit -m "feat: add shared type definitions and IPC channel constants"
```

---

### Task 3: 主进程存储服务

**Files:**
- Create: `src/main/storage.ts`

- [ ] **Step 1: 创建 src/main/storage.ts**

```typescript
import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

function getDataDir(): string {
  const dir = join(app.getPath('userData'), 'data')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

export function readJSON<T>(filename: string, fallback: T): T {
  const filepath = join(getDataDir(), filename)
  try {
    if (!existsSync(filepath)) return fallback
    return JSON.parse(readFileSync(filepath, 'utf-8')) as T
  } catch {
    return fallback
  }
}

export function writeJSON<T>(filename: string, data: T): void {
  const filepath = join(getDataDir(), filename)
  writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8')
}

export function fileExists(filename: string): boolean {
  return existsSync(join(getDataDir(), filename))
}

export function ensureDir(dirname: string): string {
  const dir = join(getDataDir(), dirname)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

export function listDir(dirname: string): string[] {
  const dir = join(getDataDir(), dirname)
  if (!existsSync(dir)) return []
  const { readdirSync } = require('fs')
  return readdirSync(dir).filter((f: string) => f.endsWith('.json'))
}

export function deleteFile(filename: string): void {
  const { unlinkSync } = require('fs')
  const filepath = join(getDataDir(), filename)
  if (existsSync(filepath)) unlinkSync(filepath)
}
```

- [ ] **Step 2: 验证编译**

```bash
npx tsc --project tsconfig.node.json --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/main/storage.ts && git commit -m "feat: add main process storage service"
```

---

### Task 4: 设备发现与连接服务

**Files:**
- Create: `src/main/device.service.ts`

- [ ] **Step 1: 创建 src/main/device.service.ts**

```typescript
import { DeviceConfig, DeviceState, DeviceStatus, DiscoveredDevice } from '../shared/types'
import { readJSON, writeJSON } from './storage'
import { net } from 'electron'

let currentState: DeviceState = { config: null, status: 'disconnected' }
let heartbeatTimer: ReturnType<typeof setInterval> | null = null
let failCount = 0
const MAX_FAIL = 3
const HEARTBEAT_INTERVAL = 10000

type StatusCallback = (state: DeviceState) => void
let statusCallbacks: StatusCallback[] = []

export function onStatusChange(cb: StatusCallback): () => void {
  statusCallbacks.push(cb)
  return () => { statusCallbacks = statusCallbacks.filter(c => c !== cb) }
}

function emitStatus() {
  statusCallbacks.forEach(cb => cb({ ...currentState }))
}

export function getDevices(): DeviceConfig[] {
  return readJSON<DeviceConfig[]>('devices.json', [])
}

export function addDevice(config: DeviceConfig): DeviceConfig[] {
  const devices = getDevices()
  devices.push(config)
  writeJSON('devices.json', devices)
  return devices
}

export function removeDevice(id: string): DeviceConfig[] {
  let devices = getDevices()
  devices = devices.filter(d => d.id !== id)
  writeJSON('devices.json', devices)
  return devices
}

export function getDeviceStatus(): DeviceState {
  return { ...currentState }
}

async function pingDevice(config: DeviceConfig): Promise<boolean> {
  try {
    const url = `http://${config.host}:${config.port}/ping`
    const res = await net.fetch(url, { method: 'GET' })
    return res.ok
  } catch {
    return false
  }
}

export async function connect(deviceId: string): Promise<DeviceState> {
  const devices = getDevices()
  const config = devices.find(d => d.id === deviceId)
  if (!config) return { config: null, status: 'error', errorMessage: '设备不存在' }

  currentState = { config, status: 'connecting' }
  emitStatus()

  const ok = await pingDevice(config)
  if (!ok) {
    currentState = { config, status: 'error', errorMessage: '无法连接到设备' }
    emitStatus()
    return { ...currentState }
  }

  currentState = { config, status: 'connected' }
  failCount = 0
  startHeartbeat()
  emitStatus()
  return { ...currentState }
}

export async function disconnect(): Promise<DeviceState> {
  stopHeartbeat()
  currentState = { config: null, status: 'disconnected' }
  emitStatus()
  return { ...currentState }
}

function startHeartbeat() {
  stopHeartbeat()
  heartbeatTimer = setInterval(async () => {
    if (!currentState.config) return
    const ok = await pingDevice(currentState.config)
    if (!ok) {
      failCount++
      if (failCount >= MAX_FAIL) {
        currentState = { config: currentState.config, status: 'error', errorMessage: '设备连接中断' }
        emitStatus()
      }
    } else {
      failCount = 0
    }
  }, HEARTBEAT_INTERVAL)
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
}

export async function scanNetwork(): Promise<DiscoveredDevice[]> {
  const results: DiscoveredDevice[] = []
  const baseIp = getLocalBaseIP()
  if (!baseIp) return results

  const promises: Promise<void>[] = []
  for (let i = 1; i <= 254; i++) {
    const host = `${baseIp}.${i}`
    promises.push(
      (async () => {
        try {
          const res = await net.fetch(`http://${host}:8080/ping`, { method: 'GET' })
          if (res.ok) results.push({ host, port: 8080, name: `LED-${host}` })
        } catch { /* 不可达 */ }
      })()
    )
  }
  await Promise.allSettled(promises)
  return results
}

function getLocalBaseIP(): string | null {
  const { networkInterfaces } = require('os')
  const ifaces = networkInterfaces()
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        const parts = iface.address.split('.')
        return `${parts[0]}.${parts[1]}.${parts[2]}`
      }
    }
  }
  return null
}
```

- [ ] **Step 2: 验证编译**

```bash
npx tsc --project tsconfig.node.json --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/main/device.service.ts && git commit -m "feat: add device discovery and connection service"
```

---

### Task 5: LED API 网关服务

**Files:**
- Create: `src/main/led-api.service.ts`

- [ ] **Step 1: 创建 src/main/led-api.service.ts**

```typescript
import { getDeviceStatus } from './device.service'
import { EffectInfo } from '../shared/types'

function getBaseUrl(): string {
  const { config } = getDeviceStatus()
  if (!config) throw new Error('未连接设备')
  return `http://${config.host}:${config.port}`
}

export async function switchLight(on: boolean): Promise<void> {
  const base = getBaseUrl()
  const res = await fetch(`${base}/light/power`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ on })
  })
  if (!res.ok) throw new Error(`开关灯失败: ${res.status}`)
}

export async function setBrightness(value: number): Promise<void> {
  const base = getBaseUrl()
  const res = await fetch(`${base}/light/brightness`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ brightness: Math.round(value) })
  })
  if (!res.ok) throw new Error(`设置亮度失败: ${res.status}`)
}

export async function setColor(r: number, g: number, b: number): Promise<void> {
  const base = getBaseUrl()
  const res = await fetch(`${base}/light/color`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ r, g, b })
  })
  if (!res.ok) throw new Error(`设置颜色失败: ${res.status}`)
}

export async function applyEffect(effectId: string, params: Record<string, unknown>): Promise<void> {
  const base = getBaseUrl()
  const res = await fetch(`${base}/effect/${effectId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  })
  if (!res.ok) throw new Error(`应用灯效失败: ${res.status}`)
}

export async function getEffectList(): Promise<EffectInfo[]> {
  const base = getBaseUrl()
  const res = await fetch(`${base}/effect/list`)
  if (!res.ok) throw new Error(`获取灯效列表失败: ${res.status}`)
  return res.json()
}

export async function sendRequest(method: string, path: string, body?: Record<string, unknown>): Promise<unknown> {
  const base = getBaseUrl()
  const url = `${base}${path}`
  const options: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' }
  }
  if (body) options.body = JSON.stringify(body)
  const res = await fetch(url, options)
  if (!res.ok) throw new Error(`LED API 请求失败: ${res.status} ${url}`)
  const text = await res.text()
  try { return JSON.parse(text) } catch { return text }
}
```

- [ ] **Step 2: 验证编译**

```bash
npx tsc --project tsconfig.node.json --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/main/led-api.service.ts && git commit -m "feat: add LED API gateway service"
```

---

### Task 6: 设备 IPC 处理器 + preload 桥接

**Files:**
- Create: `src/main/ipc-handlers.ts`
- Modify: `src/main/main.ts`
- Modify: `src/main/preload.ts`

- [ ] **Step 1: 创建 src/main/ipc-handlers.ts（设备部分）**

```typescript
import { ipcMain, BrowserWindow } from 'electron'
import { IPC } from '../shared/types'
import * as deviceService from './device.service'

export function registerHandlers() {
  ipcMain.handle(IPC.DEVICE_SCAN, async () => {
    return deviceService.scanNetwork()
  })

  ipcMain.handle(IPC.DEVICE_CONNECT, async (_event, deviceId: string) => {
    return deviceService.connect(deviceId)
  })

  ipcMain.handle(IPC.DEVICE_DISCONNECT, async () => {
    return deviceService.disconnect()
  })

  ipcMain.handle(IPC.DEVICE_LIST, async () => {
    return deviceService.getDevices()
  })

  ipcMain.handle(IPC.DEVICE_ADD, async (_event, config) => {
    return deviceService.addDevice(config)
  })

  ipcMain.handle(IPC.DEVICE_REMOVE, async (_event, id: string) => {
    return deviceService.removeDevice(id)
  })

  ipcMain.handle(IPC.DEVICE_STATUS, async () => {
    return deviceService.getDeviceStatus()
  })

  // 设备状态有变化时，广播到所有窗口
  deviceService.onStatusChange((state) => {
    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send(IPC.DEVICE_ON_STATUS_CHANGE, state)
    })
  })
}
```

- [ ] **Step 2: 修改 src/main/main.ts，在 createWindow 后注册 handlers**

把 `src/main/main.ts` 中 `app.whenReady().then(createWindow)` 改为：

```typescript
import { registerHandlers } from './ipc-handlers'

app.whenReady().then(() => {
  registerHandlers()
  createWindow()
})
```

- [ ] **Step 3: 修改 src/main/preload.ts，添加设备 API**

```typescript
import { contextBridge, ipcRenderer } from 'electron'
import { IPC, DeviceConfig, DeviceState, DiscoveredDevice } from '../shared/types'

const api = {
  // 设备
  scanNetwork: (): Promise<DiscoveredDevice[]> => ipcRenderer.invoke(IPC.DEVICE_SCAN),
  connect: (deviceId: string): Promise<DeviceState> => ipcRenderer.invoke(IPC.DEVICE_CONNECT, deviceId),
  disconnect: (): Promise<DeviceState> => ipcRenderer.invoke(IPC.DEVICE_DISCONNECT),
  getDevices: (): Promise<DeviceConfig[]> => ipcRenderer.invoke(IPC.DEVICE_LIST),
  addDevice: (config: DeviceConfig): Promise<DeviceConfig[]> => ipcRenderer.invoke(IPC.DEVICE_ADD, config),
  removeDevice: (id: string): Promise<DeviceConfig[]> => ipcRenderer.invoke(IPC.DEVICE_REMOVE, id),
  getDeviceStatus: (): Promise<DeviceState> => ipcRenderer.invoke(IPC.DEVICE_STATUS),
  onDeviceStatusChange: (cb: (state: DeviceState) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, state: DeviceState) => cb(state)
    ipcRenderer.on(IPC.DEVICE_ON_STATUS_CHANGE, handler)
    return () => ipcRenderer.removeListener(IPC.DEVICE_ON_STATUS_CHANGE, handler)
  },
}

contextBridge.exposeInMainWorld('electronAPI', api)
```

- [ ] **Step 4: 验证编译**

```bash
npx tsc --project tsconfig.node.json --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/main/ipc-handlers.ts src/main/main.ts src/main/preload.ts && git commit -m "feat: add device IPC handlers and preload bridge"
```

---

### Task 7: 控制 IPC 处理器

**Files:**
- Modify: `src/main/ipc-handlers.ts`
- Modify: `src/main/preload.ts`

- [ ] **Step 1: 在 ipc-handlers.ts 中添加控制 handlers**

在 `registerHandlers()` 函数末尾追加：

```typescript
  import * as ledApi from './led-api.service'

  ipcMain.handle(IPC.CONTROL_SWITCH, async (_event, on: boolean) => {
    await ledApi.switchLight(on)
  })

  ipcMain.handle(IPC.CONTROL_BRIGHTNESS, async (_event, value: number) => {
    await ledApi.setBrightness(value)
  })

  ipcMain.handle(IPC.CONTROL_COLOR, async (_event, r: number, g: number, b: number) => {
    await ledApi.setColor(r, g, b)
  })

  ipcMain.handle(IPC.CONTROL_APPLY_EFFECT, async (_event, effectId: string, params: Record<string, unknown>) => {
    await ledApi.applyEffect(effectId, params)
  })

  ipcMain.handle(IPC.CONTROL_EFFECT_LIST, async () => {
    return ledApi.getEffectList()
  })
```

注意：`import * as ledApi from './led-api.service'` 需要放到文件顶部。

- [ ] **Step 2: 在 preload.ts 中添加控制 API**

在 `api` 对象中添加：

```typescript
  // 控制
  switchLight: (on: boolean): Promise<void> => ipcRenderer.invoke(IPC.CONTROL_SWITCH, on),
  setBrightness: (value: number): Promise<void> => ipcRenderer.invoke(IPC.CONTROL_BRIGHTNESS, value),
  setColor: (r: number, g: number, b: number): Promise<void> => ipcRenderer.invoke(IPC.CONTROL_COLOR, r, g, b),
  applyEffect: (effectId: string, params: Record<string, unknown>): Promise<void> =>
    ipcRenderer.invoke(IPC.CONTROL_APPLY_EFFECT, effectId, params),
  getEffectList: (): Promise<unknown> => ipcRenderer.invoke(IPC.CONTROL_EFFECT_LIST),
```

- [ ] **Step 3: 验证编译**

```bash
npx tsc --project tsconfig.node.json --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/main/ipc-handlers.ts src/main/preload.ts && git commit -m "feat: add light control IPC handlers"
```

---

### Task 8: 渲染进程 API 封装 + 类型 + App 壳

**Files:**
- Create: `src/renderer/types.ts`
- Create: `src/renderer/api.ts`
- Modify: `src/renderer/App.tsx`
- Create: `src/renderer/components/Sidebar.tsx`
- Create: `src/renderer/components/StatusBar.tsx`

- [ ] **Step 1: 创建 src/renderer/types.ts**

```typescript
export type { DeviceConfig, DeviceState, DeviceStatus, DiscoveredDevice } from '../shared/types'
export type { EffectInfo, EffectParamDef } from '../shared/types'
export type { Skill, SkillMeta, SkillParam, SkillMapping } from '../shared/types'
export type { ChatMessage, ChatSession, MessageRole } from '../shared/types'
export type { QuickCommand, LLMConfig, LLMProvider } from '../shared/types'
```

- [ ] **Step 2: 创建 src/renderer/api.ts**

```typescript
import type { DeviceConfig, DeviceState, DiscoveredDevice, EffectInfo, Skill, ChatSession, ChatMessage, QuickCommand, LLMConfig } from './types'

declare global {
  interface Window {
    electronAPI: {
      scanNetwork: () => Promise<DiscoveredDevice[]>
      connect: (deviceId: string) => Promise<DeviceState>
      disconnect: () => Promise<DeviceState>
      getDevices: () => Promise<DeviceConfig[]>
      addDevice: (config: DeviceConfig) => Promise<DeviceConfig[]>
      removeDevice: (id: string) => Promise<DeviceConfig[]>
      getDeviceStatus: () => Promise<DeviceState>
      onDeviceStatusChange: (cb: (state: DeviceState) => void) => () => void
      switchLight: (on: boolean) => Promise<void>
      setBrightness: (value: number) => Promise<void>
      setColor: (r: number, g: number, b: number) => Promise<void>
      applyEffect: (effectId: string, params: Record<string, unknown>) => Promise<void>
      getEffectList: () => Promise<EffectInfo[]>
      getSkills: () => Promise<Skill[]>
      getSkill: (id: string) => Promise<Skill | null>
      saveSkill: (skill: Skill) => Promise<Skill[]>
      deleteSkill: (id: string) => Promise<Skill[]>
      executeSkill: (skillId: string, params: Record<string, unknown>) => Promise<void>
      chat: (sessionId: string, message: string) => Promise<ChatMessage>
      chatStream: (sessionId: string, message: string) => void
      onStreamChunk: (cb: (chunk: string) => void) => () => void
      quickCommand: (commandId: string) => void
      listCommands: () => Promise<QuickCommand[]>
      getSessions: () => Promise<ChatSession[]>
      getSession: (id: string) => Promise<ChatSession | null>
      createSession: () => Promise<ChatSession>
      deleteSession: (id: string) => Promise<void>
      getSettings: () => Promise<Record<string, unknown>>
      saveSettings: (settings: Record<string, unknown>) => Promise<void>
      getLlmConfig: () => Promise<LLMConfig>
      saveLlmConfig: (config: LLMConfig) => Promise<void>
    }
  }
}

export const api = {
  scanNetwork: () => window.electronAPI.scanNetwork(),
  connect: (deviceId: string) => window.electronAPI.connect(deviceId),
  disconnect: () => window.electronAPI.disconnect(),
  getDevices: () => window.electronAPI.getDevices(),
  addDevice: (config: DeviceConfig) => window.electronAPI.addDevice(config),
  removeDevice: (id: string) => window.electronAPI.removeDevice(id),
  getDeviceStatus: () => window.electronAPI.getDeviceStatus(),
  onDeviceStatusChange: (cb: (state: DeviceState) => void) => window.electronAPI.onDeviceStatusChange(cb),
  switchLight: (on: boolean) => window.electronAPI.switchLight(on),
  setBrightness: (value: number) => window.electronAPI.setBrightness(value),
  setColor: (r: number, g: number, b: number) => window.electronAPI.setColor(r, g, b),
  applyEffect: (effectId: string, params: Record<string, unknown>) => window.electronAPI.applyEffect(effectId, params),
  getEffectList: () => window.electronAPI.getEffectList(),
  getSkills: () => window.electronAPI.getSkills(),
  saveSkill: (skill: Skill) => window.electronAPI.saveSkill(skill),
  deleteSkill: (id: string) => window.electronAPI.deleteSkill(id),
  executeSkill: (skillId: string, params: Record<string, unknown>) => window.electronAPI.executeSkill(skillId, params),
  chat: (sessionId: string, message: string) => window.electronAPI.chat(sessionId, message),
  chatStream: (sessionId: string, message: string) => window.electronAPI.chatStream(sessionId, message),
  onStreamChunk: (cb: (chunk: string) => void) => window.electronAPI.onStreamChunk(cb),
  quickCommand: (commandId: string) => window.electronAPI.quickCommand(commandId),
  listCommands: () => window.electronAPI.listCommands(),
  getSessions: () => window.electronAPI.getSessions(),
  createSession: () => window.electronAPI.createSession(),
  deleteSession: (id: string) => window.electronAPI.deleteSession(id),
  getSettings: () => window.electronAPI.getSettings(),
  saveSettings: (settings: Record<string, unknown>) => window.electronAPI.saveSettings(settings),
  getLlmConfig: () => window.electronAPI.getLlmConfig(),
  saveLlmConfig: (config: LLMConfig) => window.electronAPI.saveLlmConfig(config),
}
```

- [ ] **Step 3: 修改 src/renderer/App.tsx 为布局壳**

```tsx
import { useState } from 'react'
import Sidebar from './components/Sidebar'
import StatusBar from './components/StatusBar'
import ControlPanel from './components/ControlPanel'
import SkillLibrary from './components/SkillLibrary'
import AgentChat from './components/AgentChat'
import SettingsPage from './components/SettingsPage'

type Page = 'control' | 'skills' | 'agent' | 'settings'

export default function App() {
  const [page, setPage] = useState<Page>('control')

  return (
    <div className="flex h-screen flex-col bg-gray-950 text-gray-100">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar current={page} onNavigate={setPage} />
        <main className="flex-1 overflow-auto p-6">
          {page === 'control' && <ControlPanel />}
          {page === 'skills' && <SkillLibrary />}
          {page === 'agent' && <AgentChat />}
          {page === 'settings' && <SettingsPage />}
        </main>
      </div>
      <StatusBar />
    </div>
  )
}
```

- [ ] **Step 4: 创建 src/renderer/components/Sidebar.tsx**

```tsx
type Page = 'control' | 'skills' | 'agent' | 'settings'

const items: { key: Page; label: string; icon: string }[] = [
  { key: 'control', label: '控制面板', icon: '◉' },
  { key: 'skills', label: 'Skill 库', icon: '📚' },
  { key: 'agent', label: 'AI 助手', icon: '💬' },
  { key: 'settings', label: '设置', icon: '⚙' },
]

export default function Sidebar({ current, onNavigate }: { current: Page; onNavigate: (p: Page) => void }) {
  return (
    <aside className="w-48 border-r border-gray-800 bg-gray-900 flex flex-col py-4">
      <h1 className="px-4 mb-6 text-sm font-bold text-cyan-400 tracking-wide">LED CONTROL</h1>
      {items.map(item => (
        <button
          key={item.key}
          onClick={() => onNavigate(item.key)}
          className={`px-4 py-2.5 text-left text-sm transition-colors ${
            current === item.key
              ? 'bg-gray-800 text-cyan-400 border-r-2 border-cyan-400'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
          }`}
        >
          <span className="mr-2">{item.icon}</span>
          {item.label}
        </button>
      ))}
    </aside>
  )
}
```

- [ ] **Step 5: 创建 src/renderer/components/StatusBar.tsx**

```tsx
import { useState, useEffect } from 'react'
import { api } from '../api'
import type { DeviceState } from '../types'

export default function StatusBar() {
  const [device, setDevice] = useState<DeviceState>({ config: null, status: 'disconnected' })

  useEffect(() => {
    api.getDeviceStatus().then(setDevice)
    return api.onDeviceStatusChange(setDevice)
  }, [])

  const statusDot = {
    disconnected: '⚫',
    connecting: '🟡',
    connected: '🟢',
    error: '🔴',
  }[device.status]

  return (
    <footer className="h-7 border-t border-gray-800 bg-gray-900 flex items-center px-4 text-xs text-gray-500">
      <span className="mr-2">{statusDot}</span>
      <span>{device.config ? `${device.config.name} | ${device.config.host}:${device.config.port}` : '未连接'}</span>
      <span className="ml-auto">v1.0</span>
    </footer>
  )
}
```

- [ ] **Step 6: 创建占位组件（让 App.tsx 编译通过）**

创建 `src/renderer/components/ControlPanel.tsx`:
```tsx
export default function ControlPanel() {
  return <div className="text-gray-400">控制面板（即将实现）</div>
}
```

创建 `src/renderer/components/SkillLibrary.tsx`:
```tsx
export default function SkillLibrary() {
  return <div className="text-gray-400">Skill 库（即将实现）</div>
}
```

创建 `src/renderer/components/AgentChat.tsx`:
```tsx
export default function AgentChat() {
  return <div className="text-gray-400">AI 助手（即将实现）</div>
}
```

创建 `src/renderer/components/SettingsPage.tsx`:
```tsx
export default function SettingsPage() {
  return <div className="text-gray-400">设置（即将实现）</div>
}
```

- [ ] **Step 7: 验证编译**

```bash
npx tsc --project tsconfig.web.json --noEmit
```

- [ ] **Step 8: Commit**

```bash
git add src/renderer/ && git commit -m "feat: add renderer API layer, App shell with sidebar and status bar"
```

---

### Task 9: 控制面板 UI

**Files:**
- Modify: `src/renderer/components/ControlPanel.tsx`
- Create: `src/renderer/components/DeviceConnector.tsx`
- Create: `src/renderer/components/BasicControls.tsx`
- Create: `src/renderer/components/EffectList.tsx`
- Create: `src/renderer/hooks/useDevices.ts`

- [ ] **Step 1: 创建 src/renderer/hooks/useDevices.ts**

```typescript
import { useState, useEffect, useCallback } from 'react'
import { api } from '../api'
import type { DeviceConfig, DeviceState, DiscoveredDevice, EffectInfo } from '../types'

export function useDeviceStatus() {
  const [state, setState] = useState<DeviceState>({ config: null, status: 'disconnected' })

  useEffect(() => {
    api.getDeviceStatus().then(setState)
    return api.onDeviceStatusChange(setState)
  }, [])

  return state
}

export function useSavedDevices() {
  const [devices, setDevices] = useState<DeviceConfig[]>([])

  const refresh = useCallback(async () => {
    setDevices(await api.getDevices())
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return { devices, refresh }
}

export function useScan() {
  const [scanning, setScanning] = useState(false)
  const [found, setFound] = useState<DiscoveredDevice[]>([])

  const scan = useCallback(async () => {
    setScanning(true)
    try { setFound(await api.scanNetwork()) }
    finally { setScanning(false) }
  }, [])

  return { scan, scanning, found, setFound }
}

export function useEffects() {
  const [effects, setEffects] = useState<EffectInfo[]>([])

  useEffect(() => {
    api.getEffectList().then(setEffects).catch(() => setEffects([]))
  }, [])

  return effects
}
```

- [ ] **Step 2: 创建 src/renderer/components/DeviceConnector.tsx**

```tsx
import { useState } from 'react'
import { api } from '../api'
import { useDeviceStatus, useSavedDevices, useScan } from '../hooks/useDevices'
import type { DeviceConfig } from '../types'

export default function DeviceConnector() {
  const state = useDeviceStatus()
  const { devices, refresh } = useSavedDevices()
  const { scan, scanning, found, setFound } = useScan()
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newHost, setNewHost] = useState('')
  const [newPort, setNewPort] = useState('8080')
  const [newNote, setNewNote] = useState('')

  async function handleConnect(id: string) { await api.connect(id) }
  async function handleDisconnect() { await api.disconnect() }

  async function handleAdd() {
    const config: DeviceConfig = {
      id: crypto.randomUUID(),
      name: newName || newHost,
      host: newHost,
      port: parseInt(newPort) || 8080,
      note: newNote
    }
    await api.addDevice(config)
    refresh()
    setShowAdd(false)
    setNewName(''); setNewHost(''); setNewPort('8080'); setNewNote('')
  }

  async function handleAddFound(host: string, port: number, name?: string) {
    const config: DeviceConfig = {
      id: crypto.randomUUID(),
      name: name || host,
      host,
      port,
      note: ''
    }
    await api.addDevice(config)
    refresh()
    setFound(found.filter(f => f.host !== host))
  }

  async function handleRemove(id: string) {
    await api.removeDevice(id)
    refresh()
  }

  const statusColor = { disconnected: 'text-gray-500', connecting: 'text-yellow-400', connected: 'text-green-400', error: 'text-red-400' }

  return (
    <div className="mb-6 bg-gray-900 rounded-lg border border-gray-800 p-4">
      <h2 className="text-sm font-semibold text-gray-300 mb-3">设备连接</h2>

      <div className="flex items-center gap-3 mb-3">
        <select
          className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
          onChange={e => { if (e.target.value) handleConnect(e.target.value) }}
          value={state.config?.id || ''}
        >
          <option value="">-- 选择设备 --</option>
          {devices.map(d => <option key={d.id} value={d.id}>{d.name} ({d.host}:{d.port})</option>)}
        </select>
        <button onClick={scan} disabled={scanning} className="px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded hover:bg-gray-700 disabled:opacity-50">
          {scanning ? '扫描中...' : '🔍 扫描'}
        </button>
        <button onClick={() => setShowAdd(!showAdd)} className="px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded hover:bg-gray-700">
          ＋ 手动添加
        </button>
      </div>

      {found.length > 0 && (
        <div className="mb-3 p-2 bg-gray-800 rounded text-sm">
          <div className="text-gray-400 mb-1">发现的设备：</div>
          {found.map(f => (
            <div key={f.host} className="flex items-center justify-between py-1">
              <span>{f.name || f.host}:{f.port}</span>
              <button onClick={() => handleAddFound(f.host, f.port, f.name)} className="text-cyan-400 hover:text-cyan-300">保存</button>
            </div>
          ))}
        </div>
      )}

      {state.config && (
        <div className={`flex items-center gap-2 text-sm ${statusColor[state.status]}`}>
          <span>● {state.config.name} | {state.config.host}:{state.config.port}</span>
          <span className="text-gray-500">({state.status})</span>
          {state.status === 'connected' && (
            <button onClick={handleDisconnect} className="ml-auto text-xs px-2 py-1 bg-gray-800 rounded hover:bg-gray-700 text-gray-400">断开</button>
          )}
          {state.errorMessage && <span className="text-red-400 text-xs ml-2">{state.errorMessage}</span>}
        </div>
      )}

      {showAdd && (
        <div className="mt-3 p-3 bg-gray-800 rounded space-y-2">
          <input className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm" placeholder="设备名称" value={newName} onChange={e => setNewName(e.target.value)} />
          <div className="flex gap-2">
            <input className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm" placeholder="IP 地址" value={newHost} onChange={e => setNewHost(e.target.value)} />
            <input className="w-24 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm" placeholder="端口" value={newPort} onChange={e => setNewPort(e.target.value)} />
          </div>
          <input className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm" placeholder="备注（可选）" value={newNote} onChange={e => setNewNote(e.target.value)} />
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={!newHost} className="px-4 py-1.5 text-sm bg-cyan-600 rounded hover:bg-cyan-500 disabled:opacity-50">保存设备</button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-1.5 text-sm bg-gray-700 rounded hover:bg-gray-600">取消</button>
          </div>
        </div>
      )}

      {devices.length > 0 && (
        <div className="mt-3 text-xs text-gray-500">
          {devices.map(d => (
            <div key={d.id} className="flex items-center justify-between py-0.5">
              <span>{d.name} — {d.host}:{d.port}</span>
              <button onClick={() => handleRemove(d.id)} className="text-red-400 hover:text-red-300">删除</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: 创建 src/renderer/components/BasicControls.tsx**

```tsx
import { useState } from 'react'
import { api } from '../api'

export default function BasicControls() {
  const [powerOn, setPowerOn] = useState(false)
  const [brightness, setBrightness] = useState(80)
  const [color, setColor] = useState('#00ffff')

  async function togglePower() {
    const next = !powerOn
    await api.switchLight(next)
    setPowerOn(next)
  }

  async function handleBrightness(v: number) {
    setBrightness(v)
    await api.setBrightness(v)
  }

  async function handleColor(hex: string) {
    setColor(hex)
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    await api.setColor(r, g, b)
  }

  return (
    <div className="mb-6 bg-gray-900 rounded-lg border border-gray-800 p-4">
      <h2 className="text-sm font-semibold text-gray-300 mb-3">基础控制</h2>
      <div className="flex items-center gap-6 flex-wrap">
        <button
          onClick={togglePower}
          className={`px-5 py-2.5 rounded text-sm font-medium ${powerOn ? 'bg-cyan-600 text-white' : 'bg-gray-700 text-gray-400'}`}
        >
          ⏻ {powerOn ? '开' : '关'}
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 w-10">亮度</span>
          <input
            type="range" min="0" max="100" value={brightness}
            onChange={e => handleBrightness(Number(e.target.value))}
            className="w-32 accent-cyan-500"
          />
          <span className="text-xs text-gray-400 w-8">{brightness}%</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">颜色</span>
          <input
            type="color" value={color}
            onChange={e => handleColor(e.target.value)}
            className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
          />
          <span className="text-xs text-gray-400 font-mono">{color}</span>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 创建 src/renderer/components/EffectList.tsx**

```tsx
import { useState } from 'react'
import { useEffects } from '../hooks/useDevices'
import { api } from '../api'
import type { EffectInfo } from '../types'

export default function EffectList() {
  const effects = useEffects()
  const [params, setParams] = useState<Record<string, unknown>>({})

  if (effects.length === 0) return null

  async function apply(effect: EffectInfo) {
    await api.applyEffect(effect.id, params)
  }

  function renderParamControl(effect: EffectInfo) {
    return effect.params.map(p => {
      if (p.type === 'range') {
        return (
          <div key={p.key} className="flex items-center gap-2 mb-2">
            <span className="text-xs text-gray-500 w-12">{p.label}</span>
            <input
              type="range" min={p.min ?? 0} max={p.max ?? 100}
              defaultValue={p.default as number}
              onChange={e => setParams(prev => ({ ...prev, [p.key]: Number(e.target.value) }))}
              className="w-24 accent-cyan-500"
            />
            <span className="text-xs text-gray-400">{String(params[p.key] ?? p.default)}</span>
          </div>
        )
      }
      if (p.type === 'select' && p.options) {
        return (
          <div key={p.key} className="flex items-center gap-2 mb-2">
            <span className="text-xs text-gray-500 w-12">{p.label}</span>
            <select
              onChange={e => setParams(prev => ({ ...prev, [p.key]: e.target.value }))}
              className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs"
            >
              {p.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        )
      }
      if (p.type === 'color') {
        return (
          <div key={p.key} className="flex items-center gap-2 mb-2">
            <span className="text-xs text-gray-500 w-12">{p.label}</span>
            <input
              type="color" defaultValue={p.default as string}
              onChange={e => setParams(prev => ({ ...prev, [p.key]: e.target.value }))}
              className="w-6 h-6 rounded cursor-pointer bg-transparent"
            />
          </div>
        )
      }
      return null
    })
  }

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
      <h2 className="text-sm font-semibold text-gray-300 mb-3">灯效列表</h2>
      <div className="grid grid-cols-2 gap-2">
        {effects.map(effect => (
          <div key={effect.id} className="bg-gray-800 rounded p-3 border border-gray-700">
            <div className="flex items-start justify-between mb-1">
              <div>
                <div className="text-sm font-medium">{effect.name}</div>
                <div className="text-xs text-gray-500">{effect.description}</div>
              </div>
              <button onClick={() => apply(effect)} className="px-3 py-1 text-xs bg-cyan-600 rounded hover:bg-cyan-500">应用</button>
            </div>
            {effect.params.length > 0 && (
              <div className="mt-2 pt-2 border-t border-gray-700">
                {renderParamControl(effect)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: 修改 ControlPanel.tsx 组装控制面板**

```tsx
import DeviceConnector from './DeviceConnector'
import BasicControls from './BasicControls'
import EffectList from './EffectList'

export default function ControlPanel() {
  return (
    <div>
      <DeviceConnector />
      <BasicControls />
      <EffectList />
    </div>
  )
}
```

- [ ] **Step 6: 验证编译**

```bash
npx tsc --project tsconfig.web.json --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add src/renderer/components/ControlPanel.tsx src/renderer/components/DeviceConnector.tsx src/renderer/components/BasicControls.tsx src/renderer/components/EffectList.tsx src/renderer/hooks/useDevices.ts && git commit -m "feat: add control panel UI with device connector, basic controls and effect list"
```

---

### Task 10: Skill 服务与执行器

**Files:**
- Create: `src/main/skill.service.ts`
- Create: `src/main/skill-executor.ts`

- [ ] **Step 1: 创建 src/main/skill.service.ts**

```typescript
import { Skill } from '../shared/types'
import { readJSON, writeJSON, ensureDir, listDir, deleteFile } from './storage'
import { join } from 'path'
import { app } from 'electron'
import { readFileSync, existsSync } from 'fs'

const SKILLS_DIR = 'skills'

export function getSkills(): Skill[] {
  const files = listDir(SKILLS_DIR)
  const dir = ensureDir(SKILLS_DIR)
  return files
    .map(f => {
      try {
        return JSON.parse(readFileSync(join(dir, f), 'utf-8')) as Skill
      } catch { return null }
    })
    .filter((s): s is Skill => s !== null)
}

export function getSkill(id: string): Skill | null {
  const skills = getSkills()
  return skills.find(s => s.meta.id === id) || null
}

export function saveSkill(skill: Skill): void {
  ensureDir(SKILLS_DIR)
  const filepath = join(app.getPath('userData'), 'data', SKILLS_DIR, `${skill.meta.id}.json`)
  const { writeFileSync } = require('fs')
  writeFileSync(filepath, JSON.stringify(skill, null, 2), 'utf-8')
}

export function deleteSkill(id: string): void {
  deleteFile(`${SKILLS_DIR}/${id}.json`)
}

export function exportSkill(id: string): Skill | null {
  return getSkill(id)
}
```

- [ ] **Step 2: 创建 src/main/skill-executor.ts**

```typescript
import { Skill } from '../shared/types'
import { sendRequest } from './led-api.service'

export function resolveParams(skill: Skill, values: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const param of skill.params) {
    result[param.key] = values[param.key] ?? param.default
  }
  return result
}

export function buildRequestBody(mapping: Skill['mapping'], resolvedParams: Record<string, unknown>): Record<string, unknown> {
  const template = JSON.stringify(mapping.bodyTemplate)
  const rendered = template.replace(/\{\{params\.(\w+)\}\}/g, (_, key: string) => {
    const val = resolvedParams[key]
    return val !== undefined ? JSON.stringify(val).replace(/^"|"$/g, '') : ''
  })
  return JSON.parse(rendered) as Record<string, unknown>
}

export function parseEndpoint(mapping: Skill['mapping']): { method: string; path: string } {
  const parts = mapping.endpoint.split(' ')
  return { method: parts[0], path: parts[1] }
}

export async function executeSkill(skillId: string, getSkillFn: (id: string) => Skill | null, values: Record<string, unknown>): Promise<void> {
  const skill = getSkillFn(skillId)
  if (!skill) throw new Error(`Skill 不存在: ${skillId}`)
  const resolved = resolveParams(skill, values)
  const body = buildRequestBody(skill.mapping, resolved)
  const { method, path } = parseEndpoint(skill.mapping)
  await sendRequest(method, path, body)
}
```

- [ ] **Step 3: 验证编译**

```bash
npx tsc --project tsconfig.node.json --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/main/skill.service.ts src/main/skill-executor.ts && git commit -m "feat: add skill service and executor with template mapping engine"
```

---

### Task 11: Skill IPC 处理器

**Files:**
- Modify: `src/main/ipc-handlers.ts`
- Modify: `src/main/preload.ts`

- [ ] **Step 1: 在 ipc-handlers.ts 中添加 Skill handlers**

```typescript
  import * as skillService from './skill.service'
  import { executeSkill } from './skill-executor'
  import type { Skill } from '../shared/types'

  ipcMain.handle(IPC.SKILL_LIST, async () => {
    return skillService.getSkills()
  })

  ipcMain.handle(IPC.SKILL_GET, async (_event, id: string) => {
    return skillService.getSkill(id)
  })

  ipcMain.handle(IPC.SKILL_SAVE, async (_event, skill: Skill) => {
    skillService.saveSkill(skill)
    return skillService.getSkills()
  })

  ipcMain.handle(IPC.SKILL_DELETE, async (_event, id: string) => {
    skillService.deleteSkill(id)
    return skillService.getSkills()
  })

  ipcMain.handle(IPC.SKILL_EXECUTE, async (_event, skillId: string, params: Record<string, unknown>) => {
    await executeSkill(skillId, skillService.getSkill, params)
  })

  ipcMain.handle(IPC.SKILL_EXPORT, async (_event, id: string) => {
    return skillService.exportSkill(id)
  })
```

（将以上代码放入 `registerHandlers()` 函数内）

- [ ] **Step 2: 在 preload.ts 中添加 Skill API**

```typescript
  // Skill
  getSkills: (): Promise<Skill[]> => ipcRenderer.invoke(IPC.SKILL_LIST),
  getSkill: (id: string): Promise<Skill | null> => ipcRenderer.invoke(IPC.SKILL_GET, id),
  saveSkill: (skill: Skill): Promise<Skill[]> => ipcRenderer.invoke(IPC.SKILL_SAVE, skill),
  deleteSkill: (id: string): Promise<Skill[]> => ipcRenderer.invoke(IPC.SKILL_DELETE, id),
  executeSkill: (skillId: string, params: Record<string, unknown>): Promise<void> =>
    ipcRenderer.invoke(IPC.SKILL_EXECUTE, skillId, params),
```

确保 `Skill` 类型在 preload.ts 顶部与 `../shared/types` 的其他类型一起导入。

- [ ] **Step 3: 验证编译**

```bash
npx tsc --project tsconfig.node.json --noEmit && npx tsc --project tsconfig.web.json --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/main/ipc-handlers.ts src/main/preload.ts && git commit -m "feat: add skill IPC handlers"
```

---

### Task 12: Skill 库 UI

**Files:**
- Modify: `src/renderer/components/SkillLibrary.tsx`
- Create: `src/renderer/components/SkillCard.tsx`
- Create: `src/renderer/components/SkillEditor.tsx`
- Create: `src/renderer/hooks/useSkills.ts`

- [ ] **Step 1: 创建 src/renderer/hooks/useSkills.ts**

```typescript
import { useState, useEffect, useCallback } from 'react'
import { api } from '../api'
import type { Skill } from '../types'

export function useSkills() {
  const [skills, setSkills] = useState<Skill[]>([])

  const refresh = useCallback(async () => {
    setSkills(await api.getSkills())
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const saveSkill = useCallback(async (skill: Skill) => {
    const updated = await api.saveSkill(skill)
    setSkills(updated)
  }, [])

  const deleteSkill = useCallback(async (id: string) => {
    const updated = await api.deleteSkill(id)
    setSkills(updated)
  }, [])

  const execute = useCallback(async (skillId: string, params: Record<string, unknown>) => {
    await api.executeSkill(skillId, params)
  }, [])

  return { skills, refresh, saveSkill, deleteSkill, execute }
}
```

- [ ] **Step 2: 创建 src/renderer/components/SkillCard.tsx**

```tsx
import type { Skill } from '../types'

interface Props {
  skill: Skill
  onExecute: (skill: Skill) => void
  onEdit: (skill: Skill) => void
  onDelete: (id: string) => void
}

export default function SkillCard({ skill, onExecute, onEdit, onDelete }: Props) {
  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-3 hover:border-gray-600 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="text-sm font-medium">{skill.meta.name}</div>
          <div className="text-xs text-gray-500 mt-0.5">{skill.meta.description}</div>
        </div>
      </div>
      {skill.meta.tags.length > 0 && (
        <div className="flex gap-1 mb-2 flex-wrap">
          {skill.meta.tags.map(tag => (
            <span key={tag} className="px-1.5 py-0.5 text-xs bg-gray-700 text-gray-400 rounded">{tag}</span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 mt-3 pt-2 border-t border-gray-700">
        <button onClick={() => onExecute(skill)} className="px-3 py-1 text-xs bg-cyan-600 rounded hover:bg-cyan-500">执行</button>
        <button onClick={() => onEdit(skill)} className="px-3 py-1 text-xs bg-gray-700 rounded hover:bg-gray-600">编辑</button>
        <button onClick={() => onDelete(skill.meta.id)} className="px-3 py-1 text-xs bg-gray-700 rounded hover:bg-red-600 text-gray-400 hover:text-white ml-auto">删除</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 创建 src/renderer/components/SkillEditor.tsx**

```tsx
import { useState, useEffect } from 'react'
import type { Skill, SkillParam } from '../types'

interface Props {
  skill?: Skill | null
  onSave: (skill: Skill) => void
  onClose: () => void
}

function emptySkill(): Skill {
  return {
    meta: { id: crypto.randomUUID(), name: '', description: '', tags: [], version: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    params: [],
    mapping: { endpoint: '', bodyTemplate: {} }
  }
}

export default function SkillEditor({ skill: initial, onSave, onClose }: Props) {
  const [skill, setSkill] = useState<Skill>(initial || emptySkill())

  useEffect(() => { if (initial) setSkill(initial) }, [initial])

  function updateMeta(field: string, value: unknown) {
    setSkill(prev => ({ ...prev, meta: { ...prev.meta, [field]: value, updatedAt: new Date().toISOString() } }))
  }

  function updateParam(index: number, field: string, value: unknown) {
    setSkill(prev => {
      const params = [...prev.params]
      params[index] = { ...params[index], [field]: value }
      return { ...prev, params }
    })
  }

  function addParam() {
    setSkill(prev => ({
      ...prev,
      params: [...prev.params, { key: '', label: '', type: 'text' as const, default: '' }]
    }))
  }

  function removeParam(index: number) {
    setSkill(prev => ({ ...prev, params: prev.params.filter((_, i) => i !== index) }))
  }

  function handleSave() { onSave(skill) }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-lg w-[640px] max-h-[80vh] overflow-auto p-6">
        <h2 className="text-lg font-semibold mb-4">{initial ? '编辑 Skill' : '新建 Skill'}</h2>

        <div className="space-y-3">
          <input className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm" placeholder="名称" value={skill.meta.name} onChange={e => updateMeta('name', e.target.value)} />
          <input className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm" placeholder="描述" value={skill.meta.description} onChange={e => updateMeta('description', e.target.value)} />
          <input className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm" placeholder="标签（逗号分隔）" value={skill.meta.tags.join(',')} onChange={e => updateMeta('tags', e.target.value.split(',').map(t => t.trim()).filter(Boolean))} />
          <input className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm font-mono" placeholder="Endpoint（如 POST /effect/breathe）" value={skill.mapping.endpoint} onChange={e => setSkill(prev => ({ ...prev, mapping: { ...prev.mapping, endpoint: e.target.value } }))} />
          <div>
            <label className="text-xs text-gray-500">Body Template (JSON)</label>
            <textarea
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm font-mono mt-1"
              rows={6}
              value={JSON.stringify(skill.mapping.bodyTemplate, null, 2)}
              onChange={e => { try { setSkill(prev => ({ ...prev, mapping: { ...prev.mapping, bodyTemplate: JSON.parse(e.target.value) } })) } catch {} }}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-gray-500">参数列表</label>
              <button onClick={addParam} className="px-2 py-1 text-xs bg-gray-700 rounded hover:bg-gray-600">＋ 添加参数</button>
            </div>
            {skill.params.map((p, i) => (
              <div key={i} className="flex gap-2 mb-2 items-center">
                <input className="w-28 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs" placeholder="参数名" value={p.key} onChange={e => updateParam(i, 'key', e.target.value)} />
                <input className="w-28 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs" placeholder="显示名" value={p.label} onChange={e => updateParam(i, 'label', e.target.value)} />
                <select className="w-24 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs" value={p.type} onChange={e => updateParam(i, 'type', e.target.value)}>
                  <option value="range">range</option>
                  <option value="color">color</option>
                  <option value="select">select</option>
                  <option value="number">number</option>
                  <option value="text">text</option>
                </select>
                <input className="w-28 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs" placeholder="默认值" value={String(p.default)} onChange={e => updateParam(i, 'default', e.target.value)} />
                <button onClick={() => removeParam(i)} className="text-red-400 text-xs hover:text-red-300">✕</button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button onClick={handleSave} className="px-4 py-2 text-sm bg-cyan-600 rounded hover:bg-cyan-500">保存</button>
          <button onClick={onClose} className="px-4 py-2 text-sm bg-gray-700 rounded hover:bg-gray-600">取消</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 修改 src/renderer/components/SkillLibrary.tsx**

```tsx
import { useState } from 'react'
import { useSkills } from '../hooks/useSkills'
import SkillCard from './SkillCard'
import SkillEditor from './SkillEditor'
import type { Skill } from '../types'

export default function SkillLibrary() {
  const { skills, saveSkill, deleteSkill, execute } = useSkills()
  const [search, setSearch] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null)
  const [executeParams, setExecuteParams] = useState<Record<string, Record<string, unknown>>>({})

  const filtered = skills.filter(s => {
    if (!search) return true
    const q = search.toLowerCase()
    return s.meta.name.toLowerCase().includes(q) ||
      s.meta.tags.some(t => t.toLowerCase().includes(q))
  })

  async function handleExecute(skill: Skill) {
    const params = executeParams[skill.meta.id] || {}
    await execute(skill.meta.id, params)
  }

  function handleEdit(skill: Skill) { setEditingSkill(skill); setEditorOpen(true) }
  function handleNew() { setEditingSkill(null); setEditorOpen(true) }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Skill 库</h2>
        <div className="flex gap-2">
          <input
            className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm w-64"
            placeholder="搜索名称或标签..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button onClick={handleNew} className="px-4 py-2 text-sm bg-cyan-600 rounded hover:bg-cyan-500">＋ 新建</button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-gray-500 text-sm py-12 text-center">
          {skills.length === 0 ? '还没有 Skill，点击"新建"创建或去 AI 助手生成' : '没有匹配的 Skill'}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map(skill => (
            <SkillCard key={skill.meta.id} skill={skill} onExecute={handleExecute} onEdit={handleEdit} onDelete={deleteSkill} />
          ))}
        </div>
      )}

      {editorOpen && (
        <SkillEditor
          skill={editingSkill}
          onSave={async (s) => { await saveSkill(s); setEditorOpen(false) }}
          onClose={() => setEditorOpen(false)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 5: 验证编译**

```bash
npx tsc --project tsconfig.web.json --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/SkillLibrary.tsx src/renderer/components/SkillCard.tsx src/renderer/components/SkillEditor.tsx src/renderer/hooks/useSkills.ts && git commit -m "feat: add skill library UI with card grid, editor and search"
```

---

### Task 13: LLM 适配器

**Files:**
- Create: `src/main/llm/types.ts`
- Create: `src/main/llm/openai.adapter.ts`
- Create: `src/main/llm/ollama.adapter.ts`
- Create: `src/main/llm/index.ts`

- [ ] **Step 1: 创建 src/main/llm/types.ts**

```typescript
import type { LLMConfig } from '../../shared/types'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LLMAdapter {
  chat(messages: ChatMessage[], config: LLMConfig): Promise<string>
  chatStream(messages: ChatMessage[], config: LLMConfig, onChunk: (chunk: string) => void): Promise<string>
}
```

- [ ] **Step 2: 创建 src/main/llm/openai.adapter.ts**

```typescript
import type { LLMAdapter, ChatMessage } from './types'
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
  }
}
```

- [ ] **Step 3: 创建 src/main/llm/ollama.adapter.ts**

```typescript
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
```

- [ ] **Step 4: 创建 src/main/llm/index.ts**

```typescript
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
```

- [ ] **Step 5: 验证编译**

```bash
npx tsc --project tsconfig.node.json --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/main/llm/ && git commit -m "feat: add LLM adapters for OpenAI and Ollama"
```

---

### Task 14: Agent 服务

**Files:**
- Create: `src/main/agent.service.ts`

- [ ] **Step 1: 创建 src/main/agent.service.ts**

```typescript
import { readJSON, writeJSON, fileExists } from './storage'
import type { LLMConfig, ChatMessage, ChatSession, Skill, QuickCommand } from '../shared/types'
import { getAdapter, type ChatMessage as LLMMessage } from './llm'
import { v4 as uuidv4 } from 'uuid'
import { app } from 'electron'
import { join } from 'path'
import { readFileSync, existsSync } from 'fs'

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
4. 如果用户不是请求生成灯效，正常回复即可

当前已连接设备状态：请在回复时告知用户。`
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
```

注意：需要安装 `uuid` 依赖：
```bash
npm install uuid && npm install -D @types/uuid
```

- [ ] **Step 2: 验证编译**

```bash
npx tsc --project tsconfig.node.json --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/main/agent.service.ts package.json package-lock.json && git commit -m "feat: add agent service with LLM orchestration and chat session management"
```

---

### Task 15: Agent + 聊天 IPC 处理器

**Files:**
- Modify: `src/main/ipc-handlers.ts`
- Modify: `src/main/preload.ts`

- [ ] **Step 1: 在 ipc-handlers.ts 中添加 Agent handlers**

```typescript
  import * as agentService from './agent.service'
  import { getSkill } from './skill.service'
  import { saveSkill } from './skill.service'

  ipcMain.handle(IPC.AGENT_CHAT, async (_event, sessionId: string, message: string) => {
    return agentService.chat(sessionId, message)
  })

  ipcMain.on(IPC.AGENT_CHAT_STREAM, (event, sessionId: string, message: string) => {
    agentService.chatStream(
      sessionId,
      message,
      (chunk) => event.sender.send(IPC.AGENT_ON_STREAM_CHUNK, chunk),
      (msg) => {
        if (msg.skill) {
          saveSkill(msg.skill)
        }
        event.sender.send(IPC.AGENT_ON_STREAM_CHUNK, '__DONE__')
      }
    )
  })

  ipcMain.handle(IPC.AGENT_LIST_COMMANDS, async () => {
    return agentService.getQuickCommands()
  })

  ipcMain.on(IPC.AGENT_QUICK_COMMAND, (event, commandId: string) => {
    const commands = agentService.getQuickCommands()
    const cmd = commands.find(c => c.id === commandId)
    if (cmd) {
      agentService.chatStream(
        'default',
        cmd.prompt,
        (chunk) => event.sender.send(IPC.AGENT_ON_STREAM_CHUNK, chunk),
        (msg) => {
          if (msg.skill) saveSkill(msg.skill)
          event.sender.send(IPC.AGENT_ON_STREAM_CHUNK, '__DONE__')
        }
      )
    }
  })

  ipcMain.handle(IPC.CHAT_SESSION_LIST, async () => {
    return agentService.getSessions()
  })

  ipcMain.handle(IPC.CHAT_SESSION_GET, async (_event, id: string) => {
    return agentService.getSession(id)
  })

  ipcMain.handle(IPC.CHAT_SESSION_CREATE, async () => {
    return agentService.createSession()
  })

  ipcMain.handle(IPC.CHAT_SESSION_DELETE, async (_event, id: string) => {
    agentService.deleteSession(id)
  })
```

- [ ] **Step 2: 在 preload.ts 中添加 Agent + Chat API**

```typescript
  // Agent
  chat: (sessionId: string, message: string): Promise<ChatMessage> =>
    ipcRenderer.invoke(IPC.AGENT_CHAT, sessionId, message),
  chatStream: (sessionId: string, message: string) => {
    ipcRenderer.send(IPC.AGENT_CHAT_STREAM, sessionId, message)
  },
  onStreamChunk: (cb: (chunk: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, chunk: string) => cb(chunk)
    ipcRenderer.on(IPC.AGENT_ON_STREAM_CHUNK, handler)
    return () => ipcRenderer.removeListener(IPC.AGENT_ON_STREAM_CHUNK, handler)
  },
  quickCommand: (commandId: string) => {
    ipcRenderer.send(IPC.AGENT_QUICK_COMMAND, commandId)
  },
  listCommands: (): Promise<QuickCommand[]> => ipcRenderer.invoke(IPC.AGENT_LIST_COMMANDS),

  // 聊天历史
  getSessions: (): Promise<ChatSession[]> => ipcRenderer.invoke(IPC.CHAT_SESSION_LIST),
  getSession: (id: string): Promise<ChatSession | null> => ipcRenderer.invoke(IPC.CHAT_SESSION_GET, id),
  createSession: (): Promise<ChatSession> => ipcRenderer.invoke(IPC.CHAT_SESSION_CREATE),
  deleteSession: (id: string): Promise<void> => ipcRenderer.invoke(IPC.CHAT_SESSION_DELETE, id),
```

确保导入 `ChatMessage`, `ChatSession`, `QuickCommand` 类型。

- [ ] **Step 3: 验证编译**

```bash
npx tsc --project tsconfig.node.json --noEmit && npx tsc --project tsconfig.web.json --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/main/ipc-handlers.ts src/main/preload.ts && git commit -m "feat: add agent and chat IPC handlers"
```

---

### Task 16: AI 助手聊天 UI

**Files:**
- Modify: `src/renderer/components/AgentChat.tsx`
- Create: `src/renderer/components/ChatWindow.tsx`
- Create: `src/renderer/components/ChatInput.tsx`
- Create: `src/renderer/components/QuickCommands.tsx`
- Create: `src/renderer/components/SessionManager.tsx`
- Create: `src/renderer/hooks/useChat.ts`

- [ ] **Step 1: 创建 src/renderer/hooks/useChat.ts**

```typescript
import { useState, useEffect, useCallback } from 'react'
import { api } from '../api'
import type { ChatMessage, ChatSession, QuickCommand } from '../types'

export function useChat() {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string>('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streaming, setStreaming] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)

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

  const sendMessage = useCallback(async (text: string) => {
    if (!currentSessionId) {
      const session = await api.createSession()
      setCurrentSessionId(session.id)
      setSessions(prev => [session, ...prev])
      const msg = await api.chat(session.id, text)
      setMessages(prev => [...prev, msg])
    } else {
      const msg = await api.chat(currentSessionId, text)
      setMessages(prev => [...prev, msg])
    }
    api.getSessions().then(setSessions)
  }, [currentSessionId])

  const sendStream = useCallback((text: string) => {
    const sid = currentSessionId || 'default'
    setIsStreaming(true)
    setStreaming('')

    const unsub = api.onStreamChunk((chunk: string) => {
      if (chunk === '__DONE__') {
        setIsStreaming(false)
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
    sendMessage, sendStream, createNewSession, deleteSession, switchSession
  }
}
```

- [ ] **Step 2: 创建 src/renderer/components/ChatWindow.tsx**

```tsx
import type { ChatMessage } from '../types'
import { api } from '../api'
import { useState } from 'react'

export default function ChatWindow({ messages, streaming }: { messages: ChatMessage[]; streaming: string }) {
  return (
    <div className="flex-1 overflow-auto space-y-4 mb-4 bg-gray-950 rounded-lg p-4 border border-gray-800">
      {messages.map(msg => (
        <div key={msg.id}>
          <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${
              msg.role === 'user'
                ? 'bg-cyan-600 text-white'
                : 'bg-gray-800 text-gray-100'
            }`}>
              <div className="whitespace-pre-wrap">{msg.content}</div>
              {msg.skill && <SkillInlinePreview skill={msg.skill} />}
            </div>
          </div>
        </div>
      ))}
      {streaming && (
        <div className="flex justify-start">
          <div className="max-w-[80%] rounded-lg px-4 py-2 text-sm bg-gray-800 text-gray-100">
            <div className="whitespace-pre-wrap">{streaming}<span className="animate-pulse">▌</span></div>
          </div>
        </div>
      )}
    </div>
  )
}

function SkillInlinePreview({ skill }: { skill: { meta: { id: string; name: string }; params: unknown[] } }) {
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    await api.saveSkill(skill as never)
    setSaved(true)
  }

  if (saved) {
    return (
      <div className="mt-2 pt-2 border-t border-gray-700">
        <div className="flex items-center gap-2 text-xs text-green-400">
          <span>✓ 已保存到 Skill 库</span>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-2 pt-2 border-t border-gray-700">
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400">📦 {skill.meta.name}</span>
        <button onClick={handleSave} className="px-2 py-0.5 text-xs bg-cyan-500 rounded hover:bg-cyan-400">
          💾 保存到 Skill 库
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 创建 src/renderer/components/ChatInput.tsx**

```tsx
import { useState, useRef } from 'react'

interface Props {
  onSend: (text: string) => void
  disabled: boolean
}

export default function ChatInput({ onSend, disabled }: Props) {
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function handleSend() {
    if (!text.trim() || disabled) return
    onSend(text.trim())
    setText('')
    inputRef.current?.focus()
  }

  return (
    <div className="flex gap-2">
      <input
        ref={inputRef}
        className="flex-1 bg-gray-800 border border-gray-700 rounded px-4 py-2.5 text-sm"
        placeholder="描述你想要的灯效..."
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleSend()}
        disabled={disabled}
      />
      <button onClick={handleSend} disabled={disabled || !text.trim()} className="px-5 py-2.5 bg-cyan-600 rounded text-sm hover:bg-cyan-500 disabled:opacity-50">
        发送
      </button>
    </div>
  )
}
```

- [ ] **Step 4: 创建 src/renderer/components/QuickCommands.tsx**

```tsx
import { useState, useEffect } from 'react'
import { api } from '../api'
import type { QuickCommand } from '../types'

interface Props {
  onExecute: (prompt: string) => void
}

export default function QuickCommands({ onExecute }: Props) {
  const [commands, setCommands] = useState<QuickCommand[]>([])

  useEffect(() => {
    api.listCommands().then(setCommands)
  }, [])

  return (
    <div className="flex gap-2 flex-wrap mb-3">
      {commands.map(cmd => (
        <button
          key={cmd.id}
          onClick={() => onExecute(cmd.prompt)}
          className="px-3 py-1.5 text-xs bg-gray-800 border border-gray-700 rounded-full hover:bg-gray-700 hover:border-gray-600 transition-colors"
        >
          {cmd.label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 5: 创建 src/renderer/components/SessionManager.tsx**

```tsx
import type { ChatSession } from '../types'

interface Props {
  sessions: ChatSession[]
  currentId: string
  onSwitch: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
}

export default function SessionManager({ sessions, currentId, onSwitch, onNew, onDelete }: Props) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <button onClick={onNew} className="px-3 py-1.5 text-xs bg-cyan-600 rounded hover:bg-cyan-500">＋ 新建会话</button>
      <div className="flex gap-1 overflow-x-auto flex-1">
        {sessions.map(s => (
          <div key={s.id} className={`flex items-center gap-1 px-2 py-1 rounded text-xs whitespace-nowrap cursor-pointer ${
            s.id === currentId ? 'bg-gray-700 text-cyan-400' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`} onClick={() => onSwitch(s.id)}>
            <span>{s.title || '新会话'}</span>
            <button onClick={e => { e.stopPropagation(); onDelete(s.id) }} className="text-gray-600 hover:text-red-400 ml-1">✕</button>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: 修改 AgentChat.tsx 组装**

```tsx
import { useChat } from '../hooks/useChat'
import ChatWindow from './ChatWindow'
import ChatInput from './ChatInput'
import QuickCommands from './QuickCommands'
import SessionManager from './SessionManager'

export default function AgentChat() {
  const chat = useChat()

  return (
    <div className="flex flex-col h-full">
      <SessionManager
        sessions={chat.sessions}
        currentId={chat.currentSessionId}
        onSwitch={chat.switchSession}
        onNew={chat.createNewSession}
        onDelete={chat.deleteSession}
      />
      <QuickCommands onExecute={(prompt) => chat.sendStream(prompt)} />
      <ChatWindow messages={chat.messages} streaming={chat.streaming} />
      <ChatInput onSend={chat.sendStream} disabled={chat.isStreaming} />
    </div>
  )
}
```

- [ ] **Step 7: 验证编译**

```bash
npx tsc --project tsconfig.web.json --noEmit
```

- [ ] **Step 8: Commit**

```bash
git add src/renderer/components/AgentChat.tsx src/renderer/components/ChatWindow.tsx src/renderer/components/ChatInput.tsx src/renderer/components/QuickCommands.tsx src/renderer/components/SessionManager.tsx src/renderer/hooks/useChat.ts && git commit -m "feat: add AI assistant chat UI with streaming, quick commands and session management"
```

---

### Task 17: 设置页面

**Files:**
- Modify: `src/renderer/components/SettingsPage.tsx`
- Create: `src/renderer/components/DeviceSettings.tsx`
- Create: `src/renderer/components/LLMSettings.tsx`

- [ ] **Step 1: 创建 src/renderer/components/DeviceSettings.tsx**

```tsx
import { useSavedDevices } from '../hooks/useDevices'
import { api } from '../api'

export default function DeviceSettings() {
  const { devices, refresh } = useSavedDevices()

  async function handleRemove(id: string) {
    await api.removeDevice(id)
    refresh()
  }

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">已保存设备</h3>
      {devices.length === 0 ? (
        <div className="text-sm text-gray-500">暂无设备，请到控制面板添加</div>
      ) : (
        <div className="space-y-2">
          {devices.map(d => (
            <div key={d.id} className="flex items-center justify-between bg-gray-800 rounded p-3">
              <div>
                <div className="text-sm">{d.name}</div>
                <div className="text-xs text-gray-500">{d.host}:{d.port} {d.note && `— ${d.note}`}</div>
              </div>
              <button onClick={() => handleRemove(d.id)} className="text-xs px-3 py-1 bg-gray-700 rounded hover:bg-red-600 text-gray-400 hover:text-white">删除</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 创建 src/renderer/components/LLMSettings.tsx**

```tsx
import { useState, useEffect } from 'react'
import { api } from '../api'
import type { LLMConfig, LLMProvider } from '../types'

const defaults: Record<LLMProvider, Partial<LLMConfig>> = {
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o' },
  ollama: { baseUrl: 'http://localhost:11434', model: 'llama3' },
}

export default function LLMSettings() {
  const [config, setConfig] = useState<LLMConfig>({ provider: 'openai', apiKey: '', baseUrl: '', model: '' })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api.getLlmConfig().then(setConfig)
  }, [])

  function updateProvider(provider: LLMProvider) {
    setConfig({ ...config, provider, baseUrl: defaults[provider].baseUrl || '', model: defaults[provider].model || '' })
  }

  async function handleSave() {
    await api.saveLlmConfig(config)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">LLM 模型配置</h3>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-gray-500">模型类型</label>
          <select
            className="w-full mt-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
            value={config.provider}
            onChange={e => updateProvider(e.target.value as LLMProvider)}
          >
            <option value="openai">OpenAI / 兼容 API</option>
            <option value="ollama">Ollama（本地）</option>
          </select>
        </div>

        <div>
          <label className="text-xs text-gray-500">API 端点</label>
          <input
            className="w-full mt-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
            value={config.baseUrl}
            onChange={e => setConfig({ ...config, baseUrl: e.target.value })}
            placeholder={defaults[config.provider].baseUrl || ''}
          />
        </div>

        <div>
          <label className="text-xs text-gray-500">模型名称</label>
          <input
            className="w-full mt-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
            value={config.model}
            onChange={e => setConfig({ ...config, model: e.target.value })}
            placeholder={defaults[config.provider].model || ''}
          />
        </div>

        {config.provider === 'openai' && (
          <div>
            <label className="text-xs text-gray-500">API Key</label>
            <input
              type="password"
              className="w-full mt-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
              value={config.apiKey}
              onChange={e => setConfig({ ...config, apiKey: e.target.value })}
              placeholder="sk-..."
            />
          </div>
        )}
      </div>

      <button onClick={handleSave} className="mt-4 px-4 py-2 text-sm bg-cyan-600 rounded hover:bg-cyan-500">
        {saved ? '✓ 已保存' : '保存配置'}
      </button>
    </div>
  )
}
```

- [ ] **Step 3: 修改 SettingsPage.tsx 组装**

```tsx
import DeviceSettings from './DeviceSettings'
import LLMSettings from './LLMSettings'

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">设置</h2>
      <DeviceSettings />
      <LLMSettings />
    </div>
  )
}
```

- [ ] **Step 4: 添加 Settings IPC handlers + preload**

在 `ipc-handlers.ts` 中添加：

```typescript
  import { readJSON, writeJSON } from './storage'

  ipcMain.handle(IPC.SETTINGS_GET, async () => {
    return readJSON<Record<string, unknown>>('config.json', {})
  })

  ipcMain.handle(IPC.SETTINGS_SAVE, async (_event, settings: Record<string, unknown>) => {
    writeJSON('config.json', settings)
  })

  ipcMain.handle(IPC.SETTINGS_GET_LLM, async () => {
    return readJSON<LLMConfig>('llm.json', { provider: 'openai', apiKey: '', baseUrl: '', model: '' })
  })

  ipcMain.handle(IPC.SETTINGS_SAVE_LLM, async (_event, config: LLMConfig) => {
    writeJSON('llm.json', config)
  })
```

在 `preload.ts` 中添加：

```typescript
  // 设置
  getSettings: (): Promise<Record<string, unknown>> => ipcRenderer.invoke(IPC.SETTINGS_GET),
  saveSettings: (settings: Record<string, unknown>): Promise<void> => ipcRenderer.invoke(IPC.SETTINGS_SAVE, settings),
  getLlmConfig: (): Promise<LLMConfig> => ipcRenderer.invoke(IPC.SETTINGS_GET_LLM),
  saveLlmConfig: (config: LLMConfig): Promise<void> => ipcRenderer.invoke(IPC.SETTINGS_SAVE_LLM, config),
```

- [ ] **Step 5: 验证编译**

```bash
npx tsc --project tsconfig.node.json --noEmit && npx tsc --project tsconfig.web.json --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/SettingsPage.tsx src/renderer/components/DeviceSettings.tsx src/renderer/components/LLMSettings.tsx src/main/ipc-handlers.ts src/main/preload.ts && git commit -m "feat: add settings page with device and LLM configuration"
```

---

### Task 18: 集成收尾

- [ ] **Step 1: 确保所有 IPC handlers 已注册**

检查 `src/main/ipc-handlers.ts` 顶部的 import 已包含所有依赖：
```typescript
import { ipcMain, BrowserWindow } from 'electron'
import { IPC, type LLMConfig } from '../shared/types'
import * as deviceService from './device.service'
import * as ledApi from './led-api.service'
import * as skillService from './skill.service'
import { executeSkill } from './skill-executor'
import type { Skill } from '../shared/types'
import * as agentService from './agent.service'
import { readJSON, writeJSON } from './storage'
```

- [ ] **Step 2: 启动应用验证**

```bash
npx electron-vite dev
```

验证以下流程：
1. 控制面板 → 扫描局域网 → 添加设备 → 连接
2. 控制面板 → 开关灯、调亮度、调颜色
3. AI 助手 → 新建会话 → 输入"帮我生成一个呼吸灯" → 查看流式回复 → 保存 Skill
4. Skill 库 → 查看已保存 → 执行 Skill
5. 设置 → 配置 LLM

- [ ] **Step 3: 修复编译和运行时错误**

根据实际运行结果修复。

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: integration fixes and final wiring"
```

---

## 依赖安装汇总

实施过程中按需安装以下依赖：

```bash
# 项目初始化时
npm install react react-dom uuid
npm install -D electron electron-vite @vitejs/plugin-react typescript @types/react @types/react-dom @types/uuid tailwindcss @tailwindcss/vite postcss autoprefixer
```
