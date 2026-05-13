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
