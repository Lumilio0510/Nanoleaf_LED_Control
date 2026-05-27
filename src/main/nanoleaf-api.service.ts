import { getDeviceStatus } from './device.service'
import type { EffectInfo, EffectDetail, NanoleafDeviceInfo } from '../shared/types'
import { hsbToRgb } from './color-converter'

async function request(method: string, url: string, body?: unknown): Promise<Response> {
  console.log(`[nanoleaf] ${method} ${url}${body ? ' ' + JSON.stringify(body) : ''}`)
  const options: RequestInit = { method, headers: { 'Content-Type': 'application/json' } }
  if (body) options.body = JSON.stringify(body)
  let res: Response
  try {
    res = await fetch(url, options)
  } catch (e) {
    const host = url.match(/^https?:\/\/[^/]+/)?.[0] || 'unknown'
    throw new Error(`无法连接到设备 (${host})，请检查设备是否在线`)
  }
  console.log(`[nanoleaf] ${method} ${url} → HTTP ${res.status}`)
  return res
}

function getToken(): string {
  const { config } = getDeviceStatus()
  if (!config || !config.authToken) throw new Error('设备未认证')
  return config.authToken
}

function getBasePath(): string {
  return `/api/v1/${getToken()}`
}

function stateUrl(): string {
  return `${getBasePath()}/state`
}

function effectsUrl(): string {
  return `${getBasePath()}/effects`
}

function baseUrl(): string {
  const { config } = getDeviceStatus()
  if (!config) throw new Error('设备未连接')
  return `http://${config.host}:${config.port}`
}

export async function setPower(on: boolean): Promise<void> {
  const res = await request('PUT', `${baseUrl()}${stateUrl()}`, { on: { value: on } })
  if (!res.ok) throw new Error(`开关失败: HTTP ${res.status}`)
}

export async function setBrightness(value: number, duration?: number): Promise<void> {
  const body: Record<string, unknown> = { value: Math.round(value) }
  if (duration && duration > 0) body.duration = duration
  const res = await request('PUT', `${baseUrl()}${stateUrl()}`, { brightness: body })
  if (!res.ok) throw new Error(`设置亮度失败: HTTP ${res.status}`)
}

export async function setHue(value: number): Promise<void> {
  const res = await request('PUT', `${baseUrl()}${stateUrl()}`, { hue: { value: Math.round(value) } })
  if (!res.ok) throw new Error(`设置色相失败: HTTP ${res.status}`)
}

export async function setSaturation(value: number): Promise<void> {
  const res = await request('PUT', `${baseUrl()}${stateUrl()}`, { sat: { value: Math.round(value) } })
  if (!res.ok) throw new Error(`设置饱和度失败: HTTP ${res.status}`)
}

export async function setColorTemperature(value: number): Promise<void> {
  const res = await request('PUT', `${baseUrl()}${stateUrl()}`, { ct: { value: Math.round(value) } })
  if (!res.ok) throw new Error(`设置色温失败: HTTP ${res.status}`)
}

export async function setHSB(h: number, s: number, b: number): Promise<void> {
  const res = await request('PUT', `${baseUrl()}${stateUrl()}`, {
    hue: { value: Math.round(h) },
    sat: { value: Math.round(s) },
    brightness: { value: Math.round(b) }
  })
  if (!res.ok) throw new Error(`设置颜色失败: HTTP ${res.status}`)
}

export async function getEffectsList(): Promise<EffectInfo[]> {
  const res = await request('GET', `${baseUrl()}${getBasePath()}/effects/effectsList`)
  if (!res.ok) throw new Error(`获取特效列表失败: HTTP ${res.status}`)
  const names: string[] = await res.json()
  return names.map(name => ({
    id: name,
    name,
    description: '',
    params: []
  }))
}

export async function getEffectDetails(): Promise<EffectDetail[]> {
  const res = await request('PUT', `${baseUrl()}${effectsUrl()}`, {
    write: { command: 'requestAll' }
  })
  if (!res.ok) throw new Error(`获取特效详情失败: HTTP ${res.status}`)
  const data = await res.json()
  const animations: any[] = data?.animations ?? []
  return animations.map((a: any) => ({
    id: a.animName || '',
    name: a.animName || '',
    description: a.animType || '',
    params: [],
    palette: (a.palette || []).map((c: any) => {
      const rgb = hsbToRgb(c.hue ?? 0, c.saturation ?? 100, c.brightness ?? 100)
      return { r: rgb.r, g: rgb.g, b: rgb.b }
    })
  }))
}

export async function setEffect(effectName: string): Promise<void> {
  const res = await request('PUT', `${baseUrl()}${effectsUrl()}`, { select: effectName })
  if (!res.ok) throw new Error(`应用特效失败: HTTP ${res.status}`)
}

export async function addCustomEffect(effectDef: Record<string, unknown>): Promise<void> {
  const res = await request('PUT', `${baseUrl()}${effectsUrl()}`, { write: { command: 'add', ...effectDef } })
  if (!res.ok) throw new Error(`添加特效失败: HTTP ${res.status}`)
}

export async function deleteEffect(effectName: string): Promise<void> {
  const res = await request('PUT', `${baseUrl()}${effectsUrl()}`, { write: { command: 'delete', animName: effectName } })
  if (!res.ok) throw new Error(`删除特效失败: HTTP ${res.status}`)
}

export async function getDeviceInfo(): Promise<NanoleafDeviceInfo> {
  const res = await request('GET', `${baseUrl()}${getBasePath()}`)
  if (!res.ok) throw new Error(`获取设备信息失败: HTTP ${res.status}`)
  return res.json()
}

export async function getPanelLayout(): Promise<unknown> {
  const res = await request('GET', `${baseUrl()}${getBasePath()}/panelLayout/layout`)
  if (!res.ok) throw new Error(`获取面板布局失败: HTTP ${res.status}`)
  return res.json()
}

export async function identify(): Promise<void> {
  const res = await request('PUT', `${baseUrl()}${getBasePath()}/identify`)
  if (!res.ok) throw new Error(`设备识别失败: HTTP ${res.status}`)
}

// 规范化 LLM 生成的不规范字段名，如 Palette → palette
function normalizeEffectDef(def: Record<string, unknown>): Record<string, unknown> {
  const normalized = { ...def }

  // 修复常见的字段名大小写问题：Palette → palette
  if ('Palette' in normalized && !('palette' in normalized)) {
    normalized.palette = normalized.Palette
    delete normalized.Palette
  }
  if ('Palette' in normalized && 'palette' in normalized) {
    delete normalized.Palette
  }

  // 规范化 palette 数组元素的字段名
  if (Array.isArray(normalized.palette)) {
    normalized.palette = (normalized.palette as Record<string, unknown>[]).map(c => {
      const entry: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(c)) {
        entry[k.toLowerCase()] = v
      }
      return entry
    })
  }

  // animName 去除非 ASCII 字符（Nanoleaf 不支持中文）
  if (typeof normalized.animName === 'string') {
    normalized.animName = normalized.animName.replace(/[^\x20-\x7E]/g, '').trim()
    if (!normalized.animName) {
      normalized.animName = 'AI_Effect'
    }
  }

  return normalized
}

export async function sendRequest(method: string, path: string, body?: Record<string, unknown>): Promise<unknown> {
  const url = `${baseUrl()}${getBasePath()}${path}`
  const res = await request(method, url, body)
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('认证已过期，请重新认证设备')
    }
    // 尝试读取响应体以获得详细错误信息
    let detail = ''
    try {
      const text = await res.text()
      if (text) detail = ` · ${text.slice(0, 200)}`
    } catch { /* ignore */ }
    throw new Error(`API 请求失败: HTTP ${res.status} ${method} ${path}${detail}`)
  }
  const text = await res.text()
  try { return JSON.parse(text) } catch { return text }
}

export { normalizeEffectDef }
