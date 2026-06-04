import { readJSON } from './storage'
import type { PanelType } from '../shared/canvas-types'
import type { LLMConfig } from '../shared/types'
import { getAdapter, type ChatMessage } from './llm'

const SYSTEM_PROMPT = `你是 Nanoleaf Shape 灯板布局设计师。
根据用户的描述，用三种灯板拼出大致形状。

## 可用灯板

1. 六边形 (hexagon):
   - 中心到顶点距离: 67px
   - 6条边，形似正六边形
   - 有6个连接点（每条边中点）

2. 三角形 (triangle):
   - 边长: 134px，中心到顶点约77px
   - 等边三角形，尖角默认朝上(rotation=0)
   - 有6个连接点（每条边2个三等分点）

3. 迷你三角形 (mini-triangle):
   - 边长: 67px，中心到顶点约39px
   - 等边三角形，面积约为三角形的1/4
   - 有3个连接点（每条边中点）

## 几何约束

- 迷你三角形边长 = 六边形边长 = 67px
- 三角形边长 = 2 × 迷你三角形边长 = 134px
- 两个迷你三角形并排 = 一个三角形

## 坐标规则

- 画布以(0,0)为中心，x轴向右，y轴向下
- 相邻六边形中心间距约116px（水平方向约100px，交错排列约58px垂直偏移）
- 相邻三角形中心间距约77px
- 相邻迷你三角形中心间距约39px
- 控制总量在8-30块板子之间
- rotation为角度制: 0保持三角形尖角朝上，30为六边形一个顶点朝上

## 配色规则

- 根据形状语义自动选择颜色方案
- 爱心→红/粉红系，星星→金黄系，树/植物→绿色系，海洋/水→蓝色系，太阳→橙黄系
- 不同区域可用不同深浅的同色系颜色增强层次感
- 辅助/背景板用浅灰(#cccccc)或白色(#ffffff)
- 颜色格式: hex字符串 "#rrggbb"

## 输出格式

严格只输出一个 JSON 数组，不要任何额外文字:

[
  {"type":"hexagon","x":0,"y":0,"rotation":0,"color":"#ff4444"},
  ...
]`

const VALID_TYPES: PanelType[] = ['hexagon', 'triangle', 'mini-triangle']
const MAX_PANELS = 50

function buildMessages(description: string): ChatMessage[] {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: description },
  ]
}

function extractJson(text: string): string {
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) throw new Error('AI 返回格式异常，未找到 JSON 数组，请重试')
  return match[0]
}

interface ValidatedPanel {
  type: PanelType
  x: number
  y: number
  rotation: number
  color: string
}

function validatePanels(raw: unknown[]): ValidatedPanel[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error('AI 未生成任何灯板，请尝试更详细的描述')
  }
  if (raw.length > MAX_PANELS) {
    throw new Error(`AI 生成了 ${raw.length} 块灯板，超过上限 ${MAX_PANELS}，请尝试简化描述`)
  }

  return raw.map((item, i) => {
    if (!item || typeof item !== 'object') {
      throw new Error(`第 ${i + 1} 块灯板数据格式错误`)
    }
    const obj = item as Record<string, unknown>

    const type = obj.type
    if (!VALID_TYPES.includes(type as PanelType)) {
      throw new Error(`第 ${i + 1} 块灯板类型 "${type}" 不合法，仅支持 hexagon / triangle / mini-triangle`)
    }

    if (typeof obj.x !== 'number' || isNaN(obj.x)) {
      throw new Error(`第 ${i + 1} 块灯板 x 坐标无效`)
    }
    if (typeof obj.y !== 'number' || isNaN(obj.y)) {
      throw new Error(`第 ${i + 1} 块灯板 y 坐标无效`)
    }
    if (typeof obj.rotation !== 'number' || isNaN(obj.rotation)) {
      throw new Error(`第 ${i + 1} 块灯板 rotation 无效`)
    }
    if (typeof obj.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(obj.color)) {
      throw new Error(`第 ${i + 1} 块灯板颜色 "${obj.color}" 不合法，需为 #rrggbb 格式`)
    }

    return {
      type: type as PanelType,
      x: obj.x,
      y: obj.y,
      rotation: obj.rotation,
      color: obj.color,
    }
  })
}

export interface GenerateResult {
  panels: ValidatedPanel[]
}

export async function generatePanels(description: string): Promise<GenerateResult> {
  const config = readJSON<LLMConfig>('llm.json', { provider: 'openai', apiKey: '', baseUrl: '', model: '' })
  if (!config.apiKey && config.provider === 'openai') {
    throw new Error('请先在设置中配置 LLM')
  }

  const adapter = getAdapter(config)
  const messages = buildMessages(description)

  const text = await adapter.chat(messages, config)

  const jsonStr = extractJson(text)
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonStr)
  } catch {
    throw new Error('AI 返回的 JSON 解析失败，请重试')
  }

  if (!Array.isArray(parsed)) {
    throw new Error('AI 返回的不是数组格式，请重试')
  }

  const panels = validatePanels(parsed)
  return { panels }
}
