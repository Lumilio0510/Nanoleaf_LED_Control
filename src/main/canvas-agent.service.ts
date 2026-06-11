import { randomUUID } from 'crypto'
import { readFileSync, readdirSync } from 'fs'
import { join, resolve } from 'path'
import { readJSON } from './storage'
import type { LLMConfig } from '../shared/types'
import type { CanvasDesign } from '../shared/canvas-types'
import { getAdapter, type ChatMessage } from './llm'
import type { ToolDef, ToolCallResponse } from './llm/types'
import { panelsOverlap, panelsShareEdge } from '../shared/panelGeometry'
import { getWorldVertices, alignToEdge, getPanelGeometry } from '../shared/panelGeometry'
import type { PanelType } from '../shared/canvas-types'

const SYSTEM_PROMPT_BASE = `你是 Nanoleaf Shapes 灯板布局设计师。根据用户描述，直接生成完整的灯板布局方案，每个面板给出精确的 (x, y) 中心坐标。

## 可用灯板

1. **triangle** — 大三角形，边长 134px，中心到顶点约 77px，中心到边中点约 39px
2. hexagon — 六边形，边长 67px
3. mini-triangle — 小三角形，边长 67px（大三角形的 1/4 面积）

**重要：优先使用 triangle 作为主力面板。**

## 坐标系统

屏幕坐标系（Y 轴向下）。每个面板由其中心 (x, y) 定位。

## 面板定位参考

三角形 panel 在旋转 0 度（尖角朝上）时的本地顶点：
v0 = (0, -77) 尖顶
v1 = (67, 39) 右下
v2 = (-67, 39) 左下

相邻三角形面板的中心偏移（共享整条边时）：

父面板 rot=0 在 (px, py)：
- 右边接 rot=180 面板：子中心 (px + 67, py - 39)
- 左边接 rot=180 面板：子中心 (px - 67, py - 39)
- 下边接 rot=0 面板：  子中心 (px, py + 77)

父面板 rot=180（尖角朝下）在 (px, py)：
- 右边接 rot=0 面板：子中心 (px + 67, py + 39)
- 左边接 rot=0 面板：子中心 (px - 67, py + 39)
- 上边接 rot=180 面板：子中心 (px, py - 77)

## 图案构造要点

- 第一块放 (0, 0)，然后逐步向外扩展
- 骨架优先：用 3-5 块核心面板确定主体走向
- 对称图案：左右面板 x 坐标互为相反数
- hexagon 边长 67px，与小三角形边长相同，可以互换
- 总数 8-25 块

## 核心原则（极其重要）

**原则 1：面板要组成"面"，不是"线"**
不要用面板画边框轮廓就完了！要像拼拼图一样填满区域。
- 先用 3-5 块 panel 组成一块"面积"（核心区域）
- 再在边缘扩展，用三角形收尖来塑造轮廓
- 最终形状的宽度至少要有 2 块面板的厚度
- ✅ 正确：主体用六边形填充出面积，边缘用三角形收出尖角
- ❌ 错误：所有面板排成一串折线，只有长度没有宽度

**原则 2：可识别性优先**
- 放完面板后审视：只看位置不看颜色，能看出这是什么形状吗？
- 如果不能 → 加厚、加宽、填充内部空隙

**原则 3：对称即美**
- 需要对称时，先做左半边，然后严格镜像：右面板的 x = -左面板的 x，y 不变
- 左右面板数量应相等
- 中心放在 x=0 附近

### ❌ 必须避免的错误
- ❌ 锯齿/折线排列：面板一个接一个排成之字形 → 这不是图案，这是线条
- ❌ 纯边框无填充：只有轮廓几块面板，中间是空的 → 看起来像简笔画
- ❌ 面板过少（< 8 块）：不足以形成可识别的形状轮廓
- ❌ 尺寸比例极端（如宽度远大于高度）：导致形状细长无法辨认
- ❌ 旋转角度乱用：三角形旋转角度统一用 0°（尖朝上）或 180°（尖朝下），不要用其他角度以免面板无法贴合
- ❌❌❌ 不遵循用户指定的面板数量和类型（最严重的错误！）：如果用户明确说"用 5 块六边形和 5 块小三角形"，JSON 中必须恰好有 5 个 type=hexagon 和 5 个 type=mini-triangle，不能多也不能少。输出前逐个数清楚！

## 常见形状构造指南

根据主题选择对应的构造方案。先构思整体布局，再逐块放置面板。每个形状附有推荐面板数量和构造步骤。

### 爱心（10-15 块）
1. 底部：1 个 triangle rot=180（尖角朝下）在最底端收尖
2. 中段左右弧：各 2-3 个 panel 形成弧形向外展开，从底部向上弧度逐渐变大
3. 顶部 V 口：两个 triangle rot=0 相对放置形成内凹
4. 填充：用小三角形或六边形填补弧形之间的空隙
比例：宽度 ≈ 高度，底部尖、中间饱满、顶部有 V 形内凹

### 星星/星光（10-20 块）
1. 中心：用 hexagon 或 triangle 做核心
2. 五个角：用 triangle 尖端对外，围绕中心均匀放射（每 72° 一个）
3. 加厚：每个角两侧可加辅助面板增加厚度
比例：宽度 ≈ 高度，呈放射状五角或六角形

### 翅膀/翼（15-25 块）
1. 中心：用 hexagon 做连接枢纽，位于 (0, 0) 附近
2. 水平展开：左右对称，从中心向两侧逐层扩展
3. 每层间距：约 67-100px，越靠外间距可稍大
4. 末端：最外侧用 triangle 或 mini-triangle 收尖
比例：宽度 >> 高度，横向舒展，呈扁平扇形

### 苹果/圆形果实（12-18 块）
1. 中段主体：用 4-6 个 hexagon 和 triangle 围成饱满圆形
2. 顶部：微凹，用 1-2 个 triangle 形成果梗凹陷
3. 底部：微收，用 triangle rot=180 收窄
比例：宽度 ≈ 高度，饱满圆润

### 花朵（5-10 块）
1. 花蕊：中心 1 个 hexagon
2. 花瓣：周围 5-6 个 triangle 尖端向外均匀放射排列
3. 可选：第二层花瓣用不同颜色增加层次
比例：宽度 ≈ 高度，紧凑集中

### 树/圣诞树（8-15 块）
1. 底层：最宽，用 3-5 个 panel 横向排列
2. 中层：逐渐收窄，比底层少 1-2 个 panel
3. 顶层：最窄，1-2 个 panel 收尖
4. 每层向上移动约 67-77px，形成金字塔形
比例：下宽上窄，宽度约 150-300px，高度约 200-400px

### 蝴蝶（12-20 块）
1. 身体：中央纵向 2-3 个 panel 组成细长身体
2. 上翼：左右各 3-5 个 panel 向外上方展开，宽大
3. 下翼：左右各 2-3 个 panel 向外下方展开，比上翼小
4. 外缘：可用 mini-triangle 形成波浪边缘
比例：宽度 > 高度，左右完全对称

### 钻石（8-12 块）
1. 中间最宽：用 2-3 个 panel 横向排列
2. 向上收窄：每层减少 panel 并向上移动
3. 向下收窄：每层减少 panel 并向下移动
4. 尖端：顶部和底部各用 1 个 triangle 收尖
比例：高度 > 宽度，菱形轮廓

### 皇冠（8-12 块）
1. 底部：平直，3-5 个 panel 横向一字排列
2. 顶部：3-5 个 triangle 尖端向上突起，高低错落
比例：宽度 > 高度，左右对称

### 动物面孔（8-15 块）
1. 头部轮廓：用 hexagon 或 triangle 围成圆形或椭圆形
2. 耳朵：顶部两侧各 1 个 triangle 尖角向上
3. 眼睛：用 mini-triangle 或小六边形做点缀
比例：宽度 ≈ 高度，左右对称

## 输出格式

先简要描述你的构图计划（1-2句话），然后输出完整的 JSON 数组。

例如：
我将设计一个爱心造型：底部收尖、中间饱满、顶部 V 形内凹，左右对称，用 12 块面板。

[
  {"type":"triangle","x":0,"y":0,"rotation":0,"color":"#10B981"},
  {"type":"triangle","x":67,"y":-39,"rotation":180,"color":"#34D399"},
  {"type":"triangle","x":-67,"y":-39,"rotation":180,"color":"#059669"}
]

**注意：JSON 数组前需要先写计划文字，但只有 JSON 数组会被程序解析。**

## 主题色板（每个主题从对应色板选取 2-3 种颜色）

❤️ 爱心/花朵：#FF1744(主红) #E91E63(粉红) #F06292(浅粉) #FF5252(亮红)
⭐ 星星/太阳：#FFD700(金) #FF8C00(橙) #FFAB00(亮橙) #FFE082(浅黄)
🌲 树/叶子：#2E7D32(深绿) #43A047(中绿) #66BB6A(浅绿) #795548(树干棕)
🌊 水/波浪：#0D47A1(深蓝) #1E88E5(中蓝) #42A5F5(亮蓝) #BBDEFB(白蓝)
🎨 几何抽象：#37474F(深灰) #78909C(中灰) #FFFFFF(白) — 同色系渐变
🦋 动物/生物：#8D6E63(棕) #5D4037(深棕) #FF8A65(橙棕) #A5D6A7(草绿)

配色原则：主体用主色，辅助/填充面板用较浅色或 #cccccc，不要用视觉上无法区分的近似色。`

function buildAgentSystemPrompt(hasImage?: boolean): string {
  const beforeOutput = SYSTEM_PROMPT_BASE.split('## 输出格式')[0]
  const colorSection = SYSTEM_PROMPT_BASE.includes('## 配色')
    ? '## 配色' + SYSTEM_PROMPT_BASE.split('## 配色')[1]
    : ''

  // 参考历史设计方案的规律
  let knowledge = ''
  try {
    knowledge = extractDesignKnowledge()
  } catch (e) {
    console.warn('[canvas-agent] extractDesignKnowledge failed:', e)
  }

  const toolGuide = `## 工具使用流程

你有 7 个工具可用。请使用工具一步步构建灯板布局，不要直接输出 JSON。

关键规则：
1. 第一块面板放在 (0, 0) 作为起始点
2. 相邻面板共享边时，中心偏移量参考"面板定位参考"中的说明
3. 每次 addPanel 后会检查重叠，如有重叠请调整坐标或换位置
4. 需要对称时，左右面板的 x 坐标互为相反数
5. 总数建议 8-25 块
6. 常用颜色搭配见配色指南
7. 完成后务必调用 finish(description) 来提交最终方案
8. finish 的 description 参数请认真填写：用一句话描述你的设计（主题+面板构成+布局特点），这段描述会被存入方案库，以后其他 AI 设计时会参考它`

  let prompt = beforeOutput + '\n\n' + toolGuide + '\n\n' + colorSection
  if (hasImage) {
    prompt += '\n\n**用户上传了参考图片。请仔细观察图片中物体的形状、比例和轮廓特征，用灯板拼出相似的造型。** 先分析图片里的物体是什么，然后用 addPanel 逐步搭建。如果图片中的物体有特定颜色，优先使用相近的灯板颜色。'
  }
  if (knowledge) {
    prompt += '\n\n' + knowledge
  }
  return prompt
}

/**
 * Extract aggregate design knowledge from all existing designs.
 * Categorizes by subject keywords and computes statistical patterns,
 * presenting them as abstract knowledge rather than copyable layouts.
 */
function extractDesignKnowledge(): string {
  const designsDir = resolve(process.cwd(), 'designs')
  let files: string[] = []
  try {
    files = readdirSync(designsDir).filter(f => f.endsWith('.json'))
  } catch { return '' }
  if (files.length === 0) return ''

  interface CatDesign {
    name: string
    ownDesc: string
    panelCount: number
    triCount: number; hexCount: number; miniCount: number
    width: number; height: number; symmetric: boolean
  }
  interface CategoryInfo { name: string; designs: CatDesign[] }

  const categories: Record<string, CategoryInfo> = {}
  const other: CategoryInfo = { name: '其他图案', designs: [] }
  const KEYWORDS: Array<{ keys: string[]; cat: string; label: string }> = [
    { keys: ['翅膀', '翼', 'wing'], cat: 'wings', label: '翅膀/翼' },
    { keys: ['爱心', '心形', '心', 'heart'], cat: 'heart', label: '爱心/心形' },
    { keys: ['苹果', 'apple'], cat: 'apple', label: '苹果' },
    { keys: ['花朵', '花', 'flower'], cat: 'flower', label: '花朵' },
    { keys: ['树', '圣诞树', 'tree'], cat: 'tree', label: '树/圣诞树' },
    { keys: ['蝴蝶', 'butterfly'], cat: 'butterfly', label: '蝴蝶' },
    { keys: ['钻石', 'diamond'], cat: 'diamond', label: '钻石' },
    { keys: ['皇冠', 'crown'], cat: 'crown', label: '皇冠' },
    { keys: ['动物', '脸', '面孔', '猫', '狗', '兔'], cat: 'animal', label: '动物面孔' },
    { keys: ['星星', '星', 'star'], cat: 'star', label: '星星/星光' },
    { keys: ['太阳', 'sun'], cat: 'sun', label: '太阳' },
  ]

  function categorize(name: string): string | null {
    const lower = name.toLowerCase()
    for (const { keys, cat } of KEYWORDS) {
      if (keys.some(k => lower.includes(k))) return cat
    }
    return null
  }

  for (const file of files) {
    try {
      const design = JSON.parse(readFileSync(join(designsDir, file), 'utf-8'))
      const panels = design.panels || []
      if (panels.length === 0) continue
      const cat = categorize(design.name || '')
      const target = cat ?? other
      if (cat && !categories[cat]) {
        categories[cat] = { name: KEYWORDS.find(k => k.cat === cat)?.label || cat, designs: [] }
      }
      const xs = panels.map(p => p.x)
      const ys = panels.map(p => p.y)
      target.designs.push({
        name: design.name || '',
        ownDesc: design.description || '',
        panelCount: panels.length,
        triCount: panels.filter(p => p.type === 'triangle').length,
        hexCount: panels.filter(p => p.type === 'hexagon').length,
        miniCount: panels.filter(p => p.type === 'mini-triangle').length,
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys),
        symmetric: (design.description || '').includes('对称'),
      })
    } catch { /* skip */ }
  }

  // Collect all non-empty categories, put "其他图案" last
  const catList: CategoryInfo[] = Object.values(categories)
    .filter(c => c.designs.length > 0)
    .sort((a, b) => b.designs.length - a.designs.length)
  if (other.designs.length > 0) catList.push(other)
  if (catList.length === 0) return ''

  const lines: string[] = [
    '## 设计知识库',
    '',
    `从已有 ${files.length} 个设计方案中提炼出以下规律供参考：`,
    '',
  ]

  for (const info of catList) {
    const ds = info.designs
    const panelCounts = ds.map(d => d.panelCount)
    const minP = Math.min(...panelCounts)
    const maxP = Math.max(...panelCounts)
    const countLabel = minP === maxP ? `${minP} 块` : `${minP}-${maxP} 块`

    const avgTri = Math.round(ds.reduce((s, d) => s + d.triCount, 0) / ds.length)
    const avgHex = Math.round(ds.reduce((s, d) => s + d.hexCount, 0) / ds.length)
    const avgMini = Math.round(ds.reduce((s, d) => s + d.miniCount, 0) / ds.length)
    const avgW = Math.round(ds.reduce((s, d) => s + d.width, 0) / ds.length)
    const avgH = Math.round(ds.reduce((s, d) => s + d.height, 0) / ds.length)
    const allSym = ds.every(d => d.symmetric)

    lines.push(`### ${info.name}（${ds.length} 个方案）`)
    lines.push(`- 面板数：${countLabel}，常用 ${formatComposition(avgTri, avgHex, avgMini)}`)
    if (allSym) lines.push('- 左右对称')
    lines.push(`- 整体尺寸约 ${avgW}×${avgH}px`)
    // List each design with its brief description
    for (const d of ds) {
      const brief = d.ownDesc ? ` — ${d.ownDesc}` : ''
      lines.push(`  - ${d.name}${brief}`)
    }
    lines.push('')
  }

  lines.push('以上数据来自已有方案，供设计时参考主题的比例和构成方式。不要复制已有方案，而是根据当前需求创造全新的布局。')
  return lines.join('\n')
}

function formatComposition(tri: number, hex: number, mini: number): string {
  const parts: string[] = []
  if (tri > 0) parts.push(`${tri} 个三角形`)
  if (hex > 0) parts.push(`${hex} 个六边形`)
  if (mini > 0) parts.push(`${mini} 个小三角形`)
  return parts.join('、')
}

function buildSystemPrompt(imageBase64?: string): string {
  let knowledge = ''
  try {
    knowledge = extractDesignKnowledge()
  } catch (e) {
    console.warn('[canvas-agent] extractDesignKnowledge failed:', e)
  }
  let prompt = imageBase64
    ? SYSTEM_PROMPT_BASE + '\n\n**用户上传了参考图片。请仔细观察图片中物体的形状、比例和轮廓，用灯板拼出相似的造型。**'
    : SYSTEM_PROMPT_BASE
  if (knowledge) {
    prompt += `\n\n${knowledge}`
  }
  return prompt
}

function buildMessages(description: string, imageBase64?: string): ChatMessage[] {
  const userMsg: ChatMessage = imageBase64
    ? { role: 'user', content: description, imageUrls: [imageBase64] }
    : { role: 'user', content: description }
  return [
    { role: 'system', content: buildSystemPrompt(imageBase64) },
    userMsg,
  ]
}

const MAX_ATTEMPTS = 3
const MAX_PANELS = 25
const MIN_PANELS = 3

export interface GenProgress {
  step: 'generating' | 'validating' | 'fixing' | 'complete' | 'warning'
  attempt: number
  maxAttempts: number
  totalPanels: number
  overlaps: Array<{ a: number; b: number; desc: string }>
  disconnected: Array<{ indices: number[]; desc: string }>
  // Agent mode fields
  agentAction?: string
  round?: number
}

interface RawInput {
  type: string
  x?: unknown
  y?: unknown
  rotation?: unknown
  color?: unknown
}

interface ParsedPanel {
  type: PanelType
  x: number
  y: number
  rotation: number
  color: string
}

function validatePanels(raw: unknown[]): ParsedPanel[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error('AI 未生成任何灯板，请尝试更详细的描述')
  }
  if (raw.length > MAX_PANELS) {
    throw new Error(`AI 生成了 ${raw.length} 块灯板，超过上限 ${MAX_PANELS}，请尝试简化描述`)
  }
  if (raw.length < MIN_PANELS) {
    throw new Error(`AI 仅生成了 ${raw.length} 块灯板，至少需要 ${MIN_PANELS} 块`)
  }

  const validTypes = ['hexagon', 'triangle', 'mini-triangle']

  return raw.map((item, i) => {
    if (!item || typeof item !== 'object') {
      throw new Error(`第 ${i + 1} 块灯板数据格式错误`)
    }
    const obj = item as RawInput

    if (typeof obj.type !== 'string' || !validTypes.includes(obj.type)) {
      throw new Error(`第 ${i + 1} 块灯板 type "${obj.type}" 不合法`)
    }

    if (typeof obj.x !== 'number' || isNaN(obj.x)) {
      throw new Error(`第 ${i + 1} 块灯板 x 坐标无效，需为数字`)
    }
    if (typeof obj.y !== 'number' || isNaN(obj.y)) {
      throw new Error(`第 ${i + 1} 块灯板 y 坐标无效，需为数字`)
    }
    if (typeof obj.rotation !== 'number' || isNaN(obj.rotation)) {
      throw new Error(`第 ${i + 1} 块灯板 rotation 无效`)
    }
    if (typeof obj.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(obj.color)) {
      throw new Error(`第 ${i + 1} 块灯板颜色 "${obj.color}" 不合法，需为 #rrggbb 格式`)
    }

    return {
      type: obj.type as PanelType,
      x: obj.x as number,
      y: obj.y as number,
      rotation: obj.rotation as number,
      color: obj.color as string,
    }
  })
}

function findOverlaps(panels: ParsedPanel[]): Array<{ a: number; b: number; desc: string }> {
  const result: Array<{ a: number; b: number; desc: string }> = []
  for (let i = 0; i < panels.length; i++) {
    for (let j = i + 1; j < panels.length; j++) {
      if (panelsOverlap(panels[i], panels[j])) {
        const a = panels[i]
        const b = panels[j]
        result.push({
          a: i,
          b: j,
          desc: `面板 #${i + 1} (${a.type} at ${a.x.toFixed(0)}, ${a.y.toFixed(0)} rot ${a.rotation}°) 与 面板 #${j + 1} (${b.type} at ${b.x.toFixed(0)}, ${b.y.toFixed(0)} rot ${b.rotation}°) 重叠`,
        })
      }
    }
  }
  return result
}

/**
 * Find disconnected groups in the panel graph.
 * Returns an array of groups, where each group is an array of panel indices.
 * If all panels are connected, returns a single group with all indices.
 * If there are multiple groups, the panels are not fully connected.
 */
function findDisconnectedGroups(panels: ParsedPanel[]): number[][] {
  const n = panels.length
  if (n === 0) return []

  const adj: number[][] = Array.from({ length: n }, () => [])
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (panelsShareEdge(panels[i], panels[j])) {
        adj[i].push(j)
        adj[j].push(i)
      }
    }
  }

  const visited = new Set<number>()
  const groups: number[][] = []

  for (let i = 0; i < n; i++) {
    if (visited.has(i)) continue
    const group: number[] = []
    const queue = [i]
    visited.add(i)
    while (queue.length > 0) {
      const idx = queue.shift()!
      group.push(idx)
      for (const neighbor of adj[idx]) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor)
          queue.push(neighbor)
        }
      }
    }
    groups.push(group)
  }

  return groups
}

function buildErrorFeedback(overlaps: Array<{ a: number; b: number; desc: string }>): string {
  const lines = overlaps.map(o => `- ${o.desc}`)
  return `你的方案有 ${overlaps.length} 处面板重叠，请修正重叠面板的 (x, y) 坐标：

${lines.join('\n')}

修正建议：
- 将重叠的面板向相反方向移动（如一个向左、一个向右各移 40-70px）
- 或者删除其中一块多余的面板，用其他位置替代
- 注意使用正确的坐标偏移量，相邻面板中心距通常为 67-134px

请重新输出完整的 JSON 数组。不要改变不重叠的面板。`
}

function buildConnectivityFeedback(groups: number[][], panels: ParsedPanel[]): string {
  const sorted = [...groups].sort((a, b) => b.length - a.length)
  const mainGroup = sorted[0]
  const isolated = sorted.slice(1)

  const lines: string[] = []
  for (const group of isolated) {
    for (const idx of group) {
      let minDist = Infinity
      let closest = -1
      for (const mi of mainGroup) {
        const dx = panels[idx].x - panels[mi].x
        const dy = panels[idx].y - panels[mi].y
        const d = Math.sqrt(dx * dx + dy * dy)
        if (d < minDist) { minDist = d; closest = mi }
      }
      lines.push(`- 面板 #${idx + 1}（${panels[idx].type}）距离主体 ${minDist.toFixed(0)}px，可移到面板 #${closest + 1}（${panels[closest].type}）附近并共享一条边`)
    }
  }

  const groupLines = sorted.map((g, gi) => {
    const panelList = g.map(i => `#${i + 1}`).join('、')
    return `组 ${gi + 1}：面板 ${panelList}（共 ${g.length} 块）`
  })

  let msg = `你的方案中面板未完全连通，分成了 ${groups.length} 个独立组，每组之间没有共享边的连接：

${groupLines.join('\n')}

所有面板必须通过共享边连成一个整体（相邻面板必须有一条完整的边重合，仅顶点接触不算连通）。`

  if (lines.length > 0) {
    msg += `\n\n修正建议：\n${lines.join('\n')}\n\n将孤立面板移动到主体面板附近，确保至少有一条边完全重合。使用正确的坐标偏移量（相邻面板中心距通常为 67-134px）。`
  }

  msg += '\n\n请重新输出完整的 JSON 数组。不要改变已正确连通的面板。'
  return msg
}

interface CountRequirement {
  type: PanelType
  count: number
}

/**
 * Parse user description for panel count requirements like "5块六边形", "3个小三角形" etc.
 */
function parsePanelRequirements(description: string): CountRequirement[] {
  const requirements: CountRequirement[] = []
  // Match "N块/个六边形" or "N个六边形"
  const hexMatch = description.match(/(\d+)\s*[块个]\s*六边形/)
  if (hexMatch) requirements.push({ type: 'hexagon', count: parseInt(hexMatch[1]) })
  // Match "N块/个小三角形"
  const miniMatch = description.match(/(\d+)\s*[块个]\s*小三角形/)
  if (miniMatch) requirements.push({ type: 'mini-triangle', count: parseInt(miniMatch[1]) })
  // Match "N块/个三角形" but NOT "小三角形" (use negative lookahead)
  const triMatch = description.match(/(\d+)\s*[块个]\s*(?!小)三角形/)
  if (triMatch) requirements.push({ type: 'triangle', count: parseInt(triMatch[1]) })
  return requirements
}

function buildCountFeedback(requirements: CountRequirement[], panels: ParsedPanel[]): string | null {
  const mismatches: string[] = []
  for (const req of requirements) {
    const actual = panels.filter(p => p.type === req.type).length
    if (actual !== req.count) {
      const typeNames: Record<string, string> = {
        hexagon: '六边形',
        triangle: '三角形',
        'mini-triangle': '小三角形',
      }
      mismatches.push(`用户要求 ${req.count} 块${typeNames[req.type]}，但你只放了 ${actual} 块`)
    }
  }
  if (mismatches.length === 0) return null

  const typeNames: Record<string, string> = {
    hexagon: '六边形',
    triangle: '三角形',
    'mini-triangle': '小三角形',
  }

  let spec = requirements.map(r => `${r.count} 块${typeNames[r.type]}`).join('、')
  let feedback = `❌ 面板数量不符合要求！用户指定了 ${spec}，请严格按此数量重新生成。\n`
  feedback += mismatches.join('\n')
  feedback += '\n\n在输出前逐块清点每种面板的数量，确保与用户要求完全一致。'
  return feedback
}

/**
 * Detect if panels are arranged in a line (too thin to be unrecognizable).
 * Returns a warning message or null if the arrangement looks reasonable.
 */
function detectLinearArrangement(panels: ParsedPanel[]): string | null {
  if (panels.length < 5) return null

  const xs = panels.map(p => p.x)
  const ys = panels.map(p => p.y)
  const sortedXs = [...xs].sort((a, b) => a - b)
  const sortedYs = [...ys].sort((a, b) => a - b)

  const xRange = sortedXs[sortedXs.length - 1] - sortedXs[0]
  const yRange = sortedYs[sortedYs.length - 1] - sortedYs[0]

  const minRange = Math.min(xRange, yRange)
  const maxRange = Math.max(xRange, yRange)

  if (maxRange > 200 && minRange < 80) {
    return `⚠️ 你的 ${panels.length} 块面板几乎排成了一条直线（${xRange.toFixed(0)}×${yRange.toFixed(0)}px），厚度严重不足。这样看起来像一条折线，根本无法形成可识别的形状。请重新设计：先用 3-5 块 panel 组成一个有厚度的核心区域（二维面），再向外扩展边缘。不要排成一行或一列！`
  }

  return null
}

function generateLayoutDescription(panels: ParsedPanel[]): string {
  if (!panels || panels.length === 0) return ''

  const counts: Record<string, number> = { triangle: 0, hexagon: 0, 'mini-triangle': 0 }
  panels.forEach(p => { counts[p.type]++ })
  const total = panels.length

  const TYPE_NAMES: Record<string, string> = {
    triangle: '全等正三角形',
    hexagon: '正六边形',
    'mini-triangle': '小正三角形',
  }

  const hasMultiple = Object.values(counts).filter(c => c > 0).length > 1
  const typeParts: string[] = []
  if (counts.triangle > 0) typeParts.push(`${counts.triangle} 块${TYPE_NAMES.triangle}`)
  if (counts.hexagon > 0) typeParts.push(`${counts.hexagon} 块${TYPE_NAMES.hexagon}`)
  if (counts['mini-triangle'] > 0) typeParts.push(`${counts['mini-triangle']} 块${TYPE_NAMES['mini-triangle']}`)

  let desc = hasMultiple
    ? `图案由 ${typeParts.join('、')} 共 ${total} 块面板拼接而成`
    : `图案由 ${total} 块${TYPE_NAMES[Object.keys(counts).find(k => counts[k] > 0)!]}拼接而成`

  // Symmetry detection around design center
  const xs = panels.map(p => p.x)
  const ys = panels.map(p => p.y)
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2
  const w = Math.max(...xs) - Math.min(...xs)
  const h = Math.max(...ys) - Math.min(...ys)
  const ratio = h > 0 ? w / h : w

  let symmetricCount = 0
  const matched = new Set<number>()
  for (let i = 0; i < panels.length; i++) {
    if (matched.has(i)) continue
    let bestMirror = -1
    let bestDist = 15
    const mirrorX = 2 * cx - panels[i].x
    for (let j = i + 1; j < panels.length; j++) {
      if (matched.has(j)) continue
      const dist = Math.sqrt((panels[j].x - mirrorX) ** 2 + (panels[j].y - panels[i].y) ** 2)
      if (dist < bestDist) { bestDist = dist; bestMirror = j }
    }
    if (bestMirror >= 0) { symmetricCount += 2; matched.add(i); matched.add(bestMirror) }
  }

  if (symmetricCount / total > 0.5) desc += '，整体左右对称'

  if (ratio > 3 && h <= 100) desc += '，呈横向一字排开的带状布局'
  else if (ratio > 2.5) desc += '，横向舒展'
  else if (ratio < 1.2 && h > 200) desc += '，纵向延伸，层次分明'
  else if (ratio < 2) desc += '，轮廓方正饱满'
  else desc += '，呈舒展轮廓'

  if (total >= 20) desc += `，面板数量达 ${total} 块，细节丰富`
  else if (total <= 5) desc += '，以极简面板勾勒轮廓'

  return desc + '。'
}

/**
 * Post-process: fill small triangular gaps with mini-triangles.
 * For each edge of every existing panel, tries placing a mini-triangle;
 * only keeps those that share edges with ≥2 panels (tight gap, not an extension).
 */
function fillMiniTriangleGaps(panels: ParsedPanel[]): ParsedPanel[] {
  const positionMap = new Map<string, ParsedPanel>()
  for (const p of panels) {
    positionMap.set(`${Math.round(p.x)},${Math.round(p.y)}`, p)
  }

  for (const panel of panels) {
    const geo = getPanelGeometry(panel.type)
    for (let edge = 0; edge < geo.edgeCount; edge++) {
      for (const rot of [0, 180]) {
        const placement = alignToEdge(panel, edge, 'mini-triangle', rot)
        if (!placement) continue

        const key = `${Math.round(placement.x)},${Math.round(placement.y)}`
        if (positionMap.has(key)) continue

        const candidate: ParsedPanel = {
          type: 'mini-triangle',
          x: placement.x,
          y: placement.y,
          rotation: rot,
          color: '#cccccc',
        }

        // Must not overlap any existing panel
        const existing = [...positionMap.values()]
        if (existing.some(p => panelsOverlap(p, candidate))) continue

        // Must share edges with at least 2 existing panels (tight gap)
        const sharedCount = existing.filter(p => panelsShareEdge(p, candidate)).length
        if (sharedCount < 2) continue

        positionMap.set(key, candidate)
      }
    }
  }

  return [...positionMap.values()]
}

/**
 * Post-process: enforce symmetry by mirroring panels across the vertical axis.
 * For panels that lack a mirror counterpart (within tolerance), creates one.
 */
function enforceSymmetry(panels: ParsedPanel[]): ParsedPanel[] {
  if (panels.length < 4) return panels

  const xs = panels.map(p => p.x)
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2

  const result = [...panels]
  const usedPositions = new Set<string>()
  for (const p of result) {
    usedPositions.add(`${Math.round(p.x)},${Math.round(p.y)}`)
  }

  const matched = new Set<number>()
  const newPanels: ParsedPanel[] = []

  for (let i = 0; i < panels.length; i++) {
    if (matched.has(i)) continue

    // Skip panels close to center line (they are the center axis)
    if (Math.abs(panels[i].x - cx) < 20) {
      matched.add(i)
      continue
    }

    const mirrorX = 2 * cx - panels[i].x
    let found = false

    for (let j = i + 1; j < panels.length; j++) {
      if (matched.has(j)) continue
      if (Math.abs(panels[j].x - mirrorX) < 5 && Math.abs(panels[j].y - panels[i].y) < 5) {
        matched.add(i)
        matched.add(j)
        found = true
        break
      }
    }

    if (!found) {
      const mirrorPanel: ParsedPanel = {
        type: panels[i].type,
        x: Math.round(mirrorX * 100) / 100,
        y: panels[i].y,
        rotation: panels[i].rotation,
        color: panels[i].color,
      }
      const key = `${Math.round(mirrorPanel.x)},${Math.round(mirrorPanel.y)}`
      if (!usedPositions.has(key)
        && !result.some(p => panelsOverlap(p, mirrorPanel))
        && !newPanels.some(p => panelsOverlap(p, mirrorPanel))) {
        newPanels.push(mirrorPanel)
        usedPositions.add(key)
      }
      matched.add(i)
    }
  }

  if (newPanels.length === 0) return panels
  return [...result, ...newPanels]
}

function buildPanels(panels: ParsedPanel[], description: string, now: string): CanvasDesign {
  const layoutDesc = generateLayoutDescription(panels)
  const fullDesc = description !== layoutDesc ? `${description} — ${layoutDesc}` : layoutDesc
  return {
    id: randomUUID(),
    name: description.length > 30 ? description.slice(0, 30) + '...' : description,
    description: fullDesc,
    panels: panels.map(p => ({
      id: randomUUID(),
      type: p.type,
      x: p.x,
      y: p.y,
      rotation: p.rotation,
      color: p.color,
      snappedTo: null,
      vertices: getWorldVertices(p),
    })),
    createdAt: now,
    updatedAt: now,
  }
}

function extractJson(text: string): string {
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) throw new Error('AI 返回格式异常，未找到 JSON 数组，请重试')
  return match[0]
}

export async function generateDesignIterative(
  description: string,
  onProgress: (p: GenProgress) => void,
  imageBase64?: string,
): Promise<CanvasDesign> {
  const config = readJSON<LLMConfig>('llm.json', { provider: 'openai', apiKey: '', baseUrl: '', model: '' })
  if (!config.apiKey && config.provider === 'openai') {
    throw new Error('请先在设置中配置 LLM')
  }

  const adapter = getAdapter(config)
  const history: ChatMessage[] = []

  // Pre-check: verify design knowledge extraction works
  try {
    const testKnowledge = extractDesignKnowledge()
    console.log('[canvas-agent] knowledge extracted, length:', testKnowledge.length)
  } catch (e) {
    console.warn('[canvas-agent] knowledge extraction failed:', e)
  }

  function buildInitialMessages(): ChatMessage[] {
    const msgs = buildMessages(description, imageBase64)
    return msgs
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let messages: ChatMessage[]
    if (attempt === 1) {
      messages = buildInitialMessages()
    } else {
      messages = [...buildInitialMessages(), ...history]
    }

    // Step 1: Generate
    onProgress({ step: 'generating', attempt, maxAttempts: MAX_ATTEMPTS, totalPanels: 0, overlaps: [] })

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

    // Step 2: Validate
    onProgress({ step: 'validating', attempt, maxAttempts: MAX_ATTEMPTS, totalPanels: 0, overlaps: [] })

    const panels = validatePanels(parsed)

    // Step 2.5: Check panel counts match user's requirements
    const countRequirements = parsePanelRequirements(description)
    const countIssue = buildCountFeedback(countRequirements, panels)

    // Step 3: Check overlaps
    const overlaps = findOverlaps(panels)

    // Step 4: Check connectivity (all panels connected via shared edges)
    const disconnected = findDisconnectedGroups(panels)
    // Step 5: Check if panels are too linear (no width)
    const linearIssue = detectLinearArrangement(panels)
    const hasIssues = overlaps.length > 0 || disconnected.length > 1 || linearIssue !== null || countIssue !== null

    onProgress({
      step: hasIssues ? 'fixing' : 'complete',
      attempt,
      maxAttempts: MAX_ATTEMPTS,
      totalPanels: panels.length,
      overlaps,
      disconnected: disconnected.length > 1
        ? disconnected.map(g => ({
            indices: g,
            desc: `面板 ${g.map(i => `#${i + 1}`).join('、')} 组成独立组（共 ${g.length} 块）`,
          }))
        : [],
    })

    if (!hasIssues) {
      // Success — fill gaps, enforce symmetry
      const filled = fillMiniTriangleGaps(panels)
      const symmetric = enforceSymmetry(filled)
      return buildPanels(symmetric, description, new Date().toISOString())
    }

    // Last attempt: return design with warning instead of throwing
    if (attempt === MAX_ATTEMPTS) {
      onProgress({
        step: 'warning',
        attempt,
        maxAttempts: MAX_ATTEMPTS,
        totalPanels: panels.length,
        overlaps,
        disconnected: disconnected.length > 1
          ? disconnected.map(g => ({
              indices: g,
              desc: `面板 ${g.map(i => `#${i + 1}`).join('、')} 组成独立组（共 ${g.length} 块）`,
            }))
          : [],
      })
      return buildPanels(panels, description, new Date().toISOString())
    }

    // Build combined feedback
    let feedback = ''
    if (overlaps.length > 0) {
      feedback += buildErrorFeedback(overlaps) + '\n\n'
    }
    if (disconnected.length > 1) {
      feedback += buildConnectivityFeedback(disconnected, panels)
    }
    if (linearIssue) {
      feedback += linearIssue + '\n\n'
    }
    if (countIssue) {
      feedback += countIssue + '\n\n'
    }

    history.push({ role: 'assistant', content: jsonStr })
    history.push({ role: 'user', content: feedback })
  }

  throw new Error('生成失败，请重试')
}

// ── Agent mode ─────────────────────────────────────────────────────

class CanvasAgentSession {
  panels: ParsedPanel[] = []
  finishAttempts = 0

  addPanel(type: string, x: number, y: number, rotation: number, color: string): string {
    const validTypes = ['hexagon', 'triangle', 'mini-triangle']
    if (!validTypes.includes(type)) {
      return `不支持的灯板类型 "${type}"，只能使用 ${validTypes.join('、')}`
    }
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
      return `颜色格式错误 "${color}"，需为 #rrggbb 格式`
    }

    const panel: ParsedPanel = { type: type as PanelType, x, y, rotation, color }
    const index = this.panels.length

    for (let i = 0; i < this.panels.length; i++) {
      if (panelsOverlap(panel, this.panels[i])) {
        return `面板 (#${index + 1}, ${type}) 在 (${x}, ${y}) 处与已有面板 #${i + 1}（${this.panels[i].type}）重叠，请调整坐标`
      }
    }

    this.panels.push(panel)
    return `已放置面板 #${index + 1}（${type}）在 (${x}, ${y})，旋转 ${rotation}°，颜色 ${color}`
  }

  removePanel(index: number): string {
    if (index < 0 || index >= this.panels.length) {
      return `无效的面板索引 #${index + 1}，当前共有 ${this.panels.length} 块面板`
    }
    const removed = this.panels.splice(index, 1)[0]
    return `已移除面板 #${index + 1}（${removed.type}）`
  }

  movePanel(index: number, x: number, y: number): string {
    if (index < 0 || index >= this.panels.length) {
      return `无效的面板索引 #${index + 1}，当前共有 ${this.panels.length} 块面板`
    }
    const oldPos = `(${this.panels[index].x.toFixed(0)}, ${this.panels[index].y.toFixed(0)})`
    this.panels[index].x = x
    this.panels[index].y = y

    for (let i = 0; i < this.panels.length; i++) {
      if (i === index) continue
      if (panelsOverlap(this.panels[index], this.panels[i])) {
        return `面板 #${index + 1} 已从 ${oldPos} 移到 (${x}, ${y})，但与面板 #${i + 1}（${this.panels[i].type}）重叠，请进一步调整`
      }
    }
    return `面板 #${index + 1} 已从 ${oldPos} 移到 (${x}, ${y})`
  }

  rotatePanel(index: number, rotation: number): string {
    if (index < 0 || index >= this.panels.length) {
      return `无效的面板索引 #${index + 1}`
    }
    this.panels[index].rotation = rotation
    return `面板 #${index + 1} 已旋转到 ${rotation}°`
  }

  setColor(index: number, color: string): string {
    if (index < 0 || index >= this.panels.length) {
      return `无效的面板索引 #${index + 1}`
    }
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
      return `颜色格式错误，需为 #rrggbb 格式`
    }
    this.panels[index].color = color
    return `面板 #${index + 1} 颜色已设为 ${color}`
  }

  preview(): string {
    if (this.panels.length === 0) return '当前没有放置任何面板'
    const lines = this.panels.map((p, i) =>
      `#${i + 1}: ${p.type} at (${p.x.toFixed(0)}, ${p.y.toFixed(0)}) rot ${p.rotation}° ${p.color}`
    )
    return `当前布局：共 ${this.panels.length} 块面板\n\n${lines.join('\n')}`
  }

  validate(): { ok: boolean; overlaps: Array<{ a: number; b: number; desc: string }>; disconnected: number[][] } {
    const overlaps = findOverlaps(this.panels)
    const disconnected = findDisconnectedGroups(this.panels)
    return { ok: overlaps.length === 0 && disconnected.length <= 1, overlaps, disconnected }
  }

  finish(description: string): CanvasDesign {
    const now = new Date().toISOString()
    const filled = fillMiniTriangleGaps(this.panels)
    const symmetric = enforceSymmetry(filled)
    return buildPanels(symmetric, description, now)
  }
}

const canvasAiToolDefs: ToolDef[] = [
  {
    name: 'addPanel',
    description: '添加一块灯板到指定位置。系统会检查是否与已有面板重叠。第一块建议放在 (0,0)。相邻面板中心距通常为 67-134px。',
    parameters: {
      type: 'object',
      properties: {
        type: { type: 'string', description: '灯板类型: triangle（大三角形）, hexagon（六边形）, mini-triangle（小三角形）' },
        x: { type: 'number', description: '面板中心 X 坐标' },
        y: { type: 'number', description: '面板中心 Y 坐标' },
        rotation: { type: 'number', description: '旋转角度（三角形常用 0 尖角朝上 或 180 尖角朝下）' },
        color: { type: 'string', description: 'HEX 格式颜色如 #FF0000' },
      },
      required: ['type', 'x', 'y', 'rotation', 'color'],
    },
  },
  {
    name: 'removePanel',
    description: '按索引删除已放置的面板。使用 preview 查看面板索引。',
    parameters: {
      type: 'object',
      properties: {
        index: { type: 'number', description: '面板索引（从 0 开始）' },
      },
      required: ['index'],
    },
  },
  {
    name: 'movePanel',
    description: '移动已放置的面板到新位置。系统会检查新位置是否与其它面板重叠。',
    parameters: {
      type: 'object',
      properties: {
        index: { type: 'number', description: '面板索引（从 0 开始）' },
        x: { type: 'number', description: '新的 X 坐标' },
        y: { type: 'number', description: '新的 Y 坐标' },
      },
      required: ['index', 'x', 'y'],
    },
  },
  {
    name: 'rotatePanel',
    description: '旋转已放置的面板。三角形常用 0（尖角朝上）或 180（尖角朝下）。',
    parameters: {
      type: 'object',
      properties: {
        index: { type: 'number', description: '面板索引（从 0 开始）' },
        rotation: { type: 'number', description: '旋转角度' },
      },
      required: ['index', 'rotation'],
    },
  },
  {
    name: 'setColor',
    description: '修改已放置面板的颜色。',
    parameters: {
      type: 'object',
      properties: {
        index: { type: 'number', description: '面板索引（从 0 开始）' },
        color: { type: 'string', description: 'HEX 格式颜色如 #FF0000' },
      },
      required: ['index', 'color'],
    },
  },
  {
    name: 'preview',
    description: '查看当前所有面板的列表，包括索引、类型、位置、旋转角度和颜色。',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'finish',
    description: '完成灯板布局设计。系统会全面检查连通性和重叠情况，如有问题返回错误信息供修正。确认无误后生成最终方案。',
    parameters: {
      type: 'object',
      properties: {
        description: { type: 'string', description: '用一句话描述你设计的图案，包含主题和面板构成，例如"用 12 个三角形和 6 个六边形拼成的爱心形状，左右对称"。这段描述会被存入方案库，后续设计时供 AI 参考，请写得完整准确。' },
      },
      required: ['description'],
    },
  },
]

function executeCanvasTool(name: string, args: Record<string, unknown>, session: CanvasAgentSession): string {
  switch (name) {
    case 'addPanel':
      return session.addPanel(
        String(args.type),
        Number(args.x),
        Number(args.y),
        Number(args.rotation),
        String(args.color),
      )
    case 'removePanel':
      return session.removePanel(Number(args.index))
    case 'movePanel':
      return session.movePanel(Number(args.index), Number(args.x), Number(args.y))
    case 'rotatePanel':
      return session.rotatePanel(Number(args.index), Number(args.rotation))
    case 'setColor':
      return session.setColor(Number(args.index), String(args.color))
    case 'preview':
      return session.preview()
    default:
      return `未知工具: ${name}`
  }
}

const AGENT_MAX_ROUNDS = 25
const AGENT_MAX_FINISH_ATTEMPTS = 3

export async function generateDesignAgentic(
  description: string,
  onProgress: (p: GenProgress) => void,
  imageBase64?: string,
): Promise<CanvasDesign> {
  const config = readJSON<LLMConfig>('llm.json', { provider: 'openai', apiKey: '', baseUrl: '', model: '' })
  if (!config.apiKey && config.provider === 'openai') {
    throw new Error('请先在设置中配置 LLM')
  }

  const adapter = getAdapter(config)
  const session = new CanvasAgentSession()
  const userMsg: ChatMessage = imageBase64
    ? { role: 'user', content: description, imageUrls: [imageBase64] }
    : { role: 'user', content: description }
  const messages: ChatMessage[] = [
    { role: 'system', content: buildAgentSystemPrompt(imageBase64) },
    userMsg,
  ]

  onProgress({
    step: 'generating', attempt: 1, maxAttempts: AGENT_MAX_ROUNDS, totalPanels: 0, overlaps: [], disconnected: [],
    agentAction: 'AI 正在规划布局...', round: 0,
  })

  for (let round = 1; round <= AGENT_MAX_ROUNDS; round++) {
    let response: ToolCallResponse
    try {
      response = await adapter.chatWithTools(messages, canvasAiToolDefs, config)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('Ollama') || msg.includes('tool calling')) {
        console.log('[canvas-agent] tool calling not supported, falling back to text generation')
        return generateDesignIterative(description, onProgress, imageBase64)
      }
      throw e
    }

    if (response.finishReason === 'stop') {
      if (session.panels.length > 0) {
        const design = session.finish(description)
        onProgress({
          step: 'complete', attempt: round, maxAttempts: AGENT_MAX_ROUNDS,
          totalPanels: session.panels.length, overlaps: [], disconnected: [],
        })
        return design
      }
      messages.push({ role: 'assistant', content: response.content })
      messages.push({ role: 'user', content: '请使用 addPanel 工具放置面板，不要仅输出文字。从 (0, 0) 开始。' })
      continue
    }

    // Push assistant message with tool_calls
    messages.push({
      role: 'assistant',
      content: response.content,
      tool_calls: response.toolCalls.map(tc => ({
        id: tc.id,
        type: 'function' as const,
        function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
      })),
    })

    // Process each tool call
    for (const tc of response.toolCalls) {
      if (tc.name === 'finish') {
        const desc = typeof tc.arguments.description === 'string' ? tc.arguments.description : description
        const validation = session.validate()

        if (validation.ok) {
          const design = session.finish(desc)
          onProgress({
            step: 'complete', attempt: round, maxAttempts: AGENT_MAX_ROUNDS,
            totalPanels: session.panels.length, overlaps: [], disconnected: [],
          })
          return design
        }

        session.finishAttempts++
        if (session.finishAttempts >= AGENT_MAX_FINISH_ATTEMPTS) {
          const design = session.finish(desc)
          onProgress({
            step: 'warning', attempt: round, maxAttempts: AGENT_MAX_ROUNDS,
            totalPanels: session.panels.length,
            overlaps: validation.overlaps,
            disconnected: validation.disconnected.length > 1
              ? validation.disconnected.map(g => ({
                  indices: g,
                  desc: `面板 ${g.map(i => `#${i + 1}`).join('、')} 组成独立组（共 ${g.length} 块）`,
                }))
              : [],
          })
          return design
        }

        let feedback = '方案验证未通过：\n'
        if (validation.overlaps.length > 0) {
          feedback += buildErrorFeedback(validation.overlaps) + '\n'
        }
        if (validation.disconnected.length > 1) {
          feedback += buildConnectivityFeedback(validation.disconnected, session.panels) + '\n'
        }
        feedback += '\n请使用 movePanel、removePanel 或 addPanel 修正问题，然后重新调用 finish。'

        messages.push({ role: 'tool', content: feedback, tool_call_id: tc.id })
        continue
      }

      // Execute non-finish tool
      let result: string
      try {
        result = executeCanvasTool(tc.name, tc.arguments, session)
      } catch (e: unknown) {
        result = `工具执行错误: ${e instanceof Error ? e.message : String(e)}`
      }

      onProgress({
        step: 'generating', attempt: round, maxAttempts: AGENT_MAX_ROUNDS,
        totalPanels: session.panels.length, overlaps: [], disconnected: [],
        agentAction: result, round,
      })

      messages.push({ role: 'tool', content: result, tool_call_id: tc.id })
    }
  }

  // Max rounds reached
  if (session.panels.length > 0) {
    const design = session.finish(description)
    onProgress({
      step: 'warning', attempt: AGENT_MAX_ROUNDS, maxAttempts: AGENT_MAX_ROUNDS,
      totalPanels: session.panels.length, overlaps: [], disconnected: [],
    })
    return design
  }
  throw new Error('AI 未能在限定轮数内完成布局，请重试')
}
