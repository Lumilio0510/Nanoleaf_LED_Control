const DEFAULT_PORT = 16021

export async function authenticate(host: string, port: number = DEFAULT_PORT): Promise<string> {
  const url = `http://${host}:${port}/api/v1/new`
  console.log(`[nanoleaf] POST ${url}`)
  const res = await fetch(url, { method: 'POST' })
  console.log(`[nanoleaf] POST ${url} → HTTP ${res.status}`)
  if (!res.ok) {
    if (res.status === 403) {
      throw new Error('认证失败：请确认已长按设备电源键 5-7 秒，LED 指示灯开始闪烁后再试')
    }
    throw new Error(`认证失败：设备返回 HTTP ${res.status}`)
  }
  const data = await res.json() as { auth_token: string }
  if (!data.auth_token) {
    throw new Error('认证失败：未收到有效的 auth_token')
  }
  return data.auth_token
}
