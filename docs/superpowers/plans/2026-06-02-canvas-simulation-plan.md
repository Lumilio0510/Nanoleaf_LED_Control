# Canvas 仿真系统实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Canvas 画板系统扩展为 Nanoleaf 灯效仿真器，支持 6 种灯效类型的实时动画渲染

**Architecture:** 插件化效果引擎模式 — SimulationEngine 调度 RAF 循环，每种效果类型独立 Engine 文件，PanelGraph 管理面板邻接关系，通过 CanvasStage props 覆盖颜色实现动画渲染

**Tech Stack:** React + react-konva + TypeScript + MUI, 纯渲染进程

---

### Task 1: 基础类型和颜色工具

**Files:**
- Create: `src/renderer/simulation/types.ts`
- Create: `src/renderer/simulation/color-utils.ts`

- [ ] **Step 1: 创建 types.ts**

```typescript
import type { PanelType } from '../../shared/canvas-types'

export interface HsbColor {
  hue: number
  saturation: number
  brightness: number
}

export interface RgbColor {
  r: number
  g: number
  b: number
}

export type FrameColors = Map<string, RgbColor>

export interface PanelNode {
  id: string
  type: PanelType
  x: number
  y: number
  rotation: number
  neighbors: string[]
}

/** Minimal graph interface engines depend on — avoids circular dep with PanelGraph.ts */
export interface PanelGraphReader {
  nodes: Map<string, PanelNode>
  getFlowPath(startId?: string): string[]
  getConnectedComponents(): string[][]
  getDistancesFrom(centerId: string): Map<string, number>
}

export interface EffectEngine {
  init(palette: HsbColor[], options: Record<string, unknown>): void
  getColors(elapsedMs: number, graph: PanelGraphReader): FrameColors
}
```

- [ ] **Step 2: 创建 color-utils.ts**

```typescript
import type { HsbColor, RgbColor } from './types'

export function hsbToRgb(h: number, s: number, b: number): RgbColor {
  const sn = s / 100
  const bn = b / 100
  const c = bn * sn
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = bn - c
  let rn = 0, gn = 0, bn2 = 0
  if (h < 60) { rn = c; gn = x }
  else if (h < 120) { rn = x; gn = c }
  else if (h < 180) { gn = c; bn2 = x }
  else if (h < 240) { gn = x; bn2 = c }
  else if (h < 300) { rn = x; bn2 = c }
  else { rn = c; bn2 = x }
  return {
    r: Math.round((rn + m) * 255),
    g: Math.round((gn + m) * 255),
    b: Math.round((bn2 + m) * 255),
  }
}

export function rgbToHex(c: RgbColor): string {
  const r = c.r.toString(16).padStart(2, '0')
  const g = c.g.toString(16).padStart(2, '0')
  const b = c.b.toString(16).padStart(2, '0')
  return `#${r}${g}${b}`
}

export function lerpColor(a: RgbColor, b: RgbColor, t: number): RgbColor {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)))
  return {
    r: clamp(a.r + (b.r - a.r) * t),
    g: clamp(a.g + (b.g - a.g) * t),
    b: clamp(a.b + (b.b - a.b) * t),
  }
}

/** Get color from palette by t:0-1, cycling through palette colors */
export function paletteIndex(palette: HsbColor[], t: number): RgbColor {
  if (palette.length === 0) return { r: 0, g: 0, b: 0 }
  if (palette.length === 1) return hsbToRgb(palette[0].hue, palette[0].saturation, palette[0].brightness)
  const total = palette.length
  const idx = ((t % 1) + 1) % 1 * total
  const i0 = Math.floor(idx) % total
  const i1 = (i0 + 1) % total
  const frac = idx - Math.floor(idx)
  const c0 = hsbToRgb(palette[i0].hue, palette[i0].saturation, palette[i0].brightness)
  const c1 = hsbToRgb(palette[i1].hue, palette[i1].saturation, palette[i1].brightness)
  return lerpColor(c0, c1, frac)
}

export function hsbToHex(h: number, s: number, b: number): string {
  return rgbToHex(hsbToRgb(h, s, b))
}
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/simulation/types.ts src/renderer/simulation/color-utils.ts
git commit -m "feat(simulation): add core types and color utilities"
```

---

### Task 2: PanelGraph — 面板邻接图

**Files:**
- Create: `src/renderer/simulation/PanelGraph.ts`

- [ ] **Step 1: 创建 PanelGraph.ts**

```typescript
import type { PlacedPanel } from '../../shared/canvas-types'
import type { PanelNode } from './types'

const CONNECTION_THRESHOLD = 20

export class PanelGraph {
  private _nodes: Map<string, PanelNode> = new Map()

  constructor(panels: PlacedPanel[]) {
    // 1. 创建所有节点
    for (const p of panels) {
      this._nodes.set(p.id, {
        id: p.id,
        type: p.type,
        x: p.x,
        y: p.y,
        rotation: p.rotation,
        neighbors: [],
      })
    }

    // 2. 从 snappedTo 建立边
    for (const p of panels) {
      if (p.snappedTo) {
        this.addEdge(p.id, p.snappedTo.panelId)
      }
    }

    // 3. 对孤立节点按空间最近距离连接
    const components = this.getConnectedComponents()
    if (components.length > 1) {
      for (let ci = 0; ci < components.length - 1; ci++) {
        let bestDist = Infinity
        let bestA = ''
        let bestB = ''
        for (const idA of components[ci]) {
          const nodeA = this._nodes.get(idA)!
          for (const idB of components[ci + 1]) {
            const nodeB = this._nodes.get(idB)!
            const d = Math.hypot(nodeA.x - nodeB.x, nodeA.y - nodeB.y)
            if (d < bestDist) {
              bestDist = d
              bestA = idA
              bestB = idB
            }
          }
        }
        if (bestA && bestB) this.addEdge(bestA, bestB)
      }
    }
  }

  private addEdge(a: string, b: string) {
    const na = this._nodes.get(a)
    const nb = this._nodes.get(b)
    if (!na || !nb) return
    if (!na.neighbors.includes(b)) na.neighbors.push(b)
    if (!nb.neighbors.includes(a)) nb.neighbors.push(a)
  }

  get nodes(): Map<string, PanelNode> {
    return this._nodes
  }

  /** BFS flow path starting from the most connected node */
  getFlowPath(startId?: string): string[] {
    if (this._nodes.size === 0) return []
    const start = startId ?? this.findCenterNode()
    const visited = new Set<string>()
    const queue: string[] = [start]
    const path: string[] = []
    while (queue.length > 0) {
      const id = queue.shift()!
      if (visited.has(id)) continue
      visited.add(id)
      path.push(id)
      const node = this._nodes.get(id)
      if (node) {
        for (const nid of node.neighbors) {
          if (!visited.has(nid)) queue.push(nid)
        }
      }
    }
    return path
  }

  /** Find the node with the most connections */
  private findCenterNode(): string {
    let best = ''
    let max = -1
    for (const [id, node] of this._nodes) {
      if (node.neighbors.length > max) {
        max = node.neighbors.length
        best = id
      }
    }
    return best || (this._nodes.keys().next().value ?? '')
  }

  getConnectedComponents(): string[][] {
    const visited = new Set<string>()
    const components: string[][] = []
    for (const id of this._nodes.keys()) {
      if (visited.has(id)) continue
      const comp: string[] = []
      const stack = [id]
      while (stack.length > 0) {
        const nid = stack.pop()!
        if (visited.has(nid)) continue
        visited.add(nid)
        comp.push(nid)
        const node = this._nodes.get(nid)
        if (node) {
          for (const neighbor of node.neighbors) {
            if (!visited.has(neighbor)) stack.push(neighbor)
          }
        }
      }
      components.push(comp)
    }
    return components
  }

  getDistancesFrom(centerId: string): Map<string, number> {
    const dists = new Map<string, number>()
    for (const id of this._nodes.keys()) dists.set(id, Infinity)
    dists.set(centerId, 0)
    const queue = [centerId]
    while (queue.length > 0) {
      const id = queue.shift()!
      const d = dists.get(id)!
      const node = this._nodes.get(id)
      if (node) {
        for (const nid of node.neighbors) {
          if ((dists.get(nid) ?? Infinity) > d + 1) {
            dists.set(nid, d + 1)
            queue.push(nid)
          }
        }
      }
    }
    return dists
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/simulation/PanelGraph.ts
git commit -m "feat(simulation): add PanelGraph adjacency graph from snappedTo data"
```

---

### Task 3: SimulationEngine

**Files:**
- Create: `src/renderer/simulation/SimulationEngine.ts`

- [ ] **Step 1: 创建 SimulationEngine.ts**

```typescript
import type { PlacedPanel } from '../../shared/canvas-types'
import type { EffectEngine, FrameColors, HsbColor } from './types'
import { PanelGraph } from './PanelGraph'

const PLUGIN_ENGINE_MAP: Record<string, string> = {
  '027842e4-e1d6-4a4c-a731-be74a1ebd4cf': 'flow',
  '6970681a-20b5-4c5e-8813-bdaebc4ee4fa': 'wheel',
  '713518c1-d560-47db-8991-de780af71d1e': 'explode',
  'b3fd723a-aae8-4c99-bf2b-087159e0ef53': 'fade',
  'ba632d3e-9c2b-4413-a965-510c839b3f71': 'random',
  '70b7c636-6bf8-491f-89c1-f4103508d642': 'highlight',
}

interface SkillBodyWrite {
  command?: string
  animName?: string
  version?: string
  animType?: string
  colorType?: string
  pluginUuid?: string
  pluginType?: string
  pluginOptions?: Record<string, unknown>
  palette?: Array<{ hue?: number; saturation?: number; brightness?: number }>
}

export class SimulationEngine {
  private engine: EffectEngine | null = null
  private rafId = 0
  private startTime = 0
  private _elapsedMs = 0
  private _playing = false

  start(
    bodyTemplate: Record<string, unknown>,
    panels: PlacedPanel[],
    onFrame: (colors: FrameColors) => void,
  ): void {
    this.stop()

    const write = (bodyTemplate as Record<string, unknown>)?.write as SkillBodyWrite | undefined
    const effectDef = write ?? bodyTemplate
    const pluginUuid = effectDef.pluginUuid ?? ''
    const engineName = PLUGIN_ENGINE_MAP[pluginUuid]

    if (!engineName) {
      console.warn(`[Simulation] Unknown pluginUuid: ${pluginUuid}, defaulting to fade`)
    }

    const palette: HsbColor[] = (effectDef.palette ?? []).map(p => ({
      hue: p.hue ?? 0,
      saturation: p.saturation ?? 100,
      brightness: p.brightness ?? 100,
    }))
    const options = effectDef.pluginOptions ?? {}

    // Dynamic import of engine
    this.loadEngine(engineName || 'fade').then(EngineClass => {
      this.engine = new EngineClass()
      this.engine.init(palette, options)

      const graph = new PanelGraph(panels)
      this._playing = true
      this.startTime = performance.now()
      this._elapsedMs = 0

      const tick = (now: number) => {
        if (!this._playing || !this.engine) return
        this._elapsedMs = now - this.startTime
        const colors = this.engine.getColors(this._elapsedMs, graph)
        onFrame(colors)
        this.rafId = requestAnimationFrame(tick)
      }
      this.rafId = requestAnimationFrame(tick)
    })
  }

  private async loadEngine(name: string): Promise<new () => EffectEngine> {
    switch (name) {
      case 'flow': return (await import('./engines/flow.engine')).FlowEngine
      case 'wheel': return (await import('./engines/wheel.engine')).WheelEngine
      case 'explode': return (await import('./engines/explode.engine')).ExplodeEngine
      case 'random': return (await import('./engines/random.engine')).RandomEngine
      case 'highlight': return (await import('./engines/highlight.engine')).HighlightEngine
      case 'fade':
      default: return (await import('./engines/fade.engine')).FadeEngine
    }
  }

  stop(): void {
    this._playing = false
    if (this.rafId) {
      cancelAnimationFrame(this.rafId)
      this.rafId = 0
    }
    this.engine = null
    this._elapsedMs = 0
  }

  get playing(): boolean { return this._playing }
  get elapsedMs(): number { return this._elapsedMs }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/simulation/SimulationEngine.ts
git commit -m "feat(simulation): add SimulationEngine with RAF loop and engine dispatch"
```

---

### Task 4: 简单引擎 — Fade + Wheel + Random

**Files:**
- Create: `src/renderer/simulation/engines/fade.engine.ts`
- Create: `src/renderer/simulation/engines/wheel.engine.ts`
- Create: `src/renderer/simulation/engines/random.engine.ts`

- [ ] **Step 1: 创建 fade.engine.ts**

```typescript
import type { EffectEngine, FrameColors, HsbColor, PanelGraphReader } from '../types'
import { paletteIndex } from '../color-utils'

export class FadeEngine implements EffectEngine {
  private palette: HsbColor[] = []
  private transTime = 30 // in 0.1s units

  init(palette: HsbColor[], options: Record<string, unknown>): void {
    this.palette = palette
    if (typeof options.transTime === 'number') this.transTime = options.transTime
  }

  getColors(elapsedMs: number, graph: PanelGraphReader): FrameColors {
    const colors: FrameColors = new Map()
    const cycleMs = this.transTime * 100
    const t = (elapsedMs % cycleMs) / cycleMs

    const color = paletteIndex(this.palette, t)
    for (const id of graph.nodes.keys()) {
      colors.set(id, color)
    }
    return colors
  }
}
```

- [ ] **Step 2: 创建 wheel.engine.ts**

```typescript
import type { EffectEngine, FrameColors, HsbColor, PanelGraphReader } from '../types'
import { hsbToRgb } from '../color-utils'

export class WheelEngine implements EffectEngine {
  private palette: HsbColor[] = []
  private transTime = 30

  init(palette: HsbColor[], options: Record<string, unknown>): void {
    this.palette = palette
    if (typeof options.transTime === 'number') this.transTime = options.transTime
  }

  getColors(elapsedMs: number, _graph: PanelGraphReader): FrameColors {
    const colors: FrameColors = new Map()
    const intervalMs = this.transTime * 100
    const idx = Math.floor(elapsedMs / intervalMs) % this.palette.length
    const color = hsbToRgb(
      this.palette[idx].hue,
      this.palette[idx].saturation,
      this.palette[idx].brightness,
    )
    for (const id of _graph.nodes.keys()) {
      colors.set(id, color)
    }
    return colors
  }
}
```

- [ ] **Step 3: 创建 random.engine.ts**

```typescript
import type { EffectEngine, FrameColors, HsbColor, PanelGraphReader } from '../types'
import { hsbToRgb } from '../color-utils'

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297
  return x - Math.floor(x)
}

export class RandomEngine implements EffectEngine {
  private palette: HsbColor[] = []
  private transTime = 30

  init(palette: HsbColor[], options: Record<string, unknown>): void {
    this.palette = palette
    if (typeof options.transTime === 'number') this.transTime = options.transTime
  }

  getColors(elapsedMs: number, graph: PanelGraphReader): FrameColors {
    const colors: FrameColors = new Map()
    const intervalMs = this.transTime * 100
    const phase = elapsedMs / intervalMs

    for (const [id] of graph.nodes) {
      const seed = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
      const r = seededRandom(seed + Math.floor(phase))
      const idx = Math.floor(r * this.palette.length) % this.palette.length
      colors.set(id, hsbToRgb(
        this.palette[idx].hue,
        this.palette[idx].saturation,
        this.palette[idx].brightness,
      ))
    }
    return colors
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/renderer/simulation/engines/fade.engine.ts src/renderer/simulation/engines/wheel.engine.ts src/renderer/simulation/engines/random.engine.ts
git commit -m "feat(simulation): add Fade, Wheel, and Random effect engines"
```

---

### Task 5: Flow 引擎

**Files:**
- Create: `src/renderer/simulation/engines/flow.engine.ts`

- [ ] **Step 1: 创建 flow.engine.ts**

```typescript
import type { EffectEngine, FrameColors, HsbColor, PanelGraphReader } from '../types'
import { paletteIndex } from '../color-utils'

const DEFAULT_TRANS_TIME = 30 // 0.1s units

export class FlowEngine implements EffectEngine {
  private palette: HsbColor[] = []
  private transTime = DEFAULT_TRANS_TIME
  private loop = true

  init(palette: HsbColor[], options: Record<string, unknown>): void {
    this.palette = palette
    if (typeof options.transTime === 'number') this.transTime = options.transTime
    if (typeof options.loop === 'boolean') this.loop = options.loop
  }

  getColors(elapsedMs: number, graph: PanelGraphReader): FrameColors {
    const colors: FrameColors = new Map()
    // init all to dark
    for (const id of graph.nodes.keys()) {
      colors.set(id, { r: 0, g: 0, b: 0 })
    }

    const path = graph.getFlowPath()
    if (path.length === 0) return colors

    const waveSpeed = 200 / (this.transTime || DEFAULT_TRANS_TIME) // panels per ms
    const wavePos = (elapsedMs * waveSpeed) % (path.length + 4)

    for (let i = 0; i < path.length; i++) {
      const dist = Math.abs(i - wavePos)
      if (dist < 4) {
        const t = dist / 4
        const brightness = Math.cos(t * Math.PI / 2)
        const ci = Math.floor(i / path.length * this.palette.length) % this.palette.length
        const base = paletteIndex(this.palette, ci / this.palette.length)
        colors.set(path[i], {
          r: Math.round(base.r * brightness),
          g: Math.round(base.g * brightness),
          b: Math.round(base.b * brightness),
        })
      }
    }

    return colors
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/simulation/engines/flow.engine.ts
git commit -m "feat(simulation): add Flow effect engine with BFS path propagation"
```

---

### Task 6: 空间引擎 — Explode + Highlight

**Files:**
- Create: `src/renderer/simulation/engines/explode.engine.ts`
- Create: `src/renderer/simulation/engines/highlight.engine.ts`

- [ ] **Step 1: 创建 explode.engine.ts**

```typescript
import type { EffectEngine, FrameColors, HsbColor, PanelGraphReader } from '../types'
import { paletteIndex } from '../color-utils'

export class ExplodeEngine implements EffectEngine {
  private palette: HsbColor[] = []
  private transTime = 30

  init(palette: HsbColor[], options: Record<string, unknown>): void {
    this.palette = palette
    if (typeof options.transTime === 'number') this.transTime = options.transTime
  }

  getColors(elapsedMs: number, graph: PanelGraphReader): FrameColors {
    const colors: FrameColors = new Map()

    // Calculate geometric center
    let cx = 0, cy = 0, count = 0
    for (const [, node] of graph.nodes) {
      cx += node.x; cy += node.y; count++
    }
    cx /= count; cy /= count

    // Find max distance for normalization
    let maxDist = 0
    const dists = new Map<string, number>()
    for (const [id, node] of graph.nodes) {
      const d = Math.hypot(node.x - cx, node.y - cy)
      dists.set(id, d)
      if (d > maxDist) maxDist = d
    }

    const speed = 0.5 / (this.transTime * 100) // waves per ms
    const wavePhase = (elapsedMs * speed) % 1

    for (const [id, node] of graph.nodes) {
      const normDist = dists.get(id)! / (maxDist || 1)
      const t = ((normDist - wavePhase) % 1 + 1) % 1
      const brightness = Math.max(0, 1 - t * 3)
      if (brightness > 0.02) {
        const base = paletteIndex(this.palette, normDist)
        colors.set(id, {
          r: Math.round(base.r * brightness),
          g: Math.round(base.g * brightness),
          b: Math.round(base.b * brightness),
        })
      } else {
        colors.set(id, { r: 0, g: 0, b: 0 })
      }
    }

    return colors
  }
}
```

- [ ] **Step 2: 创建 highlight.engine.ts**

```typescript
import type { EffectEngine, FrameColors, HsbColor, PanelGraphReader } from '../types'
import { hsbToRgb } from '../color-utils'

export class HighlightEngine implements EffectEngine {
  private palette: HsbColor[] = []
  private transTime = 30

  init(palette: HsbColor[], options: Record<string, unknown>): void {
    this.palette = palette
    if (typeof options.transTime === 'number') this.transTime = options.transTime
  }

  getColors(elapsedMs: number, graph: PanelGraphReader): FrameColors {
    const colors: FrameColors = new Map()
    const path = graph.getFlowPath()
    if (path.length === 0) return colors

    const highlightMs = this.transTime * 100
    const idx = Math.floor(elapsedMs / highlightMs) % path.length

    for (let i = 0; i < path.length; i++) {
      if (i === idx) {
        const ci = i % this.palette.length
        colors.set(path[i], hsbToRgb(
          this.palette[ci].hue,
          this.palette[ci].saturation,
          this.palette[ci].brightness,
        ))
      } else {
        colors.set(path[i], { r: 8, g: 8, b: 8 })
      }
    }

    return colors
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/simulation/engines/explode.engine.ts src/renderer/simulation/engines/highlight.engine.ts
git commit -m "feat(simulation): add Explode and Highlight effect engines"
```

---

### Task 7: CanvasStage 改造 — panelOverrides / 连接标记 / simMode

**Files:**
- Modify: `src/renderer/components/CanvasStage.tsx`

- [ ] **Step 1: 修改 CanvasStage.tsx**

添加 3 个新 props 到 Props 接口，并更新 `getPanelGeometry` 导入：

```typescript
import { panelsOverlap, findBestSnap, connectionToEdgeIndices, getPanelGeometry } from '../utils/panelGeometry'

interface Props {
  // ... 现有 props
  panelOverrides?: Map<string, string>   // panelId → hex color override
  showConnectionMarks?: boolean           // show connection tick marks
  simMode?: boolean                       // disable interaction in sim mode
}
```

在函数签名中解构新 props：

```typescript
export default function CanvasStage({
  design, toolMode, selectedIds, ghostColor, stageRef,
  onPanelClick, onPanelDragStart, onPanelDragEnd, onPanelRotate, onStageClick, onBlankClick,
  panelOverrides,
  showConnectionMarks = false,
  simMode = false,
}: Props) {
```

修改面板渲染循环，应用 panelOverrides：

```typescript
// 在 return 的 JSX 中，替换原来的 panel 渲染
{design?.panels.map(p => (
  <CanvasShapePanel
    key={p.id}
    panel={{ ...p, color: panelOverrides?.get(p.id) ?? p.color }}
    isSelected={selectedIds.has(p.id) && !simMode}
    highlightedEdges={highlightEdgesFor(p.id)}
    onDragStart={simMode ? undefined : () => onPanelDragStart(p.id)}
    onDragMove={simMode ? undefined : (x, y, r) => handleDragMove(p.id, p.type, x, y, r)}
    onDragEnd={simMode ? undefined : (x, y) => wrappedDragEnd(p.id, x, y)}
    onClick={simMode ? undefined : () => onPanelClick(p.id, false)}
    onRotate={(!simMode && onPanelRotate) ? () => onPanelRotate(p.id) : undefined}
  />
))}
```

添加连接标记层（在 CanvasGrid 层之后）：

```typescript
{showConnectionMarks && design && (
  <Layer listening={false}>
    {design.panels.filter(p => p.snappedTo).map(p => {
      const target = design.panels.find(op => op.id === p.snappedTo!.panelId)
      if (!target) return null
      // Get connection point world position
      const cp = getConnectionWorldPos(p, p.type, p.snappedTo!.connectionIndex)
      if (!cp) return null
      // Get edge indices for this connection point
      const edgeIndices = connectionToEdgeIndices(p.type, p.snappedTo!.connectionIndex)
      if (edgeIndices.length === 0) return null
      // Get edge vertices to compute direction
      const geo = getPanelGeometry(p.type)
      const ei = edgeIndices[0]
      const v1 = geo.vertices[ei]
      const v2 = geo.vertices[(ei + 1) % geo.vertices.length]
      const edgeAngle = Math.atan2(v2.y - v1.y, v2.x - v1.x) + (p.rotation * Math.PI / 180)
      const perpAngle = edgeAngle + Math.PI / 2
      const tickLen = 8
      return (
        <Line
          key={`conn-${p.id}-${p.snappedTo!.panelId}`}
          points={[
            cp.x - Math.cos(perpAngle) * tickLen,
            cp.y - Math.sin(perpAngle) * tickLen,
            cp.x + Math.cos(perpAngle) * tickLen,
            cp.y + Math.sin(perpAngle) * tickLen,
          ]}
          stroke="#ffffff"
          strokeWidth={2}
          listening={false}
        />
      )
    })}
  </Layer>
)}
```

添加 `Line` 导入（如果尚未导入）：

```typescript
import { Stage, Layer, Rect, Line } from 'react-konva'
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/CanvasStage.tsx
git commit -m "feat(canvas): add panelOverrides, connection marks, and simMode to CanvasStage"
```

---

### Task 8: CanvasToolbar 模式切换

**Files:**
- Modify: `src/renderer/components/CanvasToolbar.tsx`

- [ ] **Step 1: 修改 CanvasToolbar.tsx**

```typescript
import Paper from '@mui/material/Paper'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import ToggleButton from '@mui/material/ToggleButton'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import DeleteIcon from '@mui/icons-material/Delete'
import UndoIcon from '@mui/icons-material/Undo'
import ImageIcon from '@mui/icons-material/Image'
import NearMeIcon from '@mui/icons-material/NearMe'
import EditIcon from '@mui/icons-material/Edit'
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline'

type ToolMode = 'select' | 'hexagon' | 'triangle' | 'mini-triangle'
type CanvasMode = 'edit' | 'sim'

interface Props {
  toolMode: ToolMode
  onToolChange: (m: ToolMode) => void
  onDelete: () => void
  onUndo: () => void
  onExport: () => void
  canvasMode: CanvasMode
  onCanvasModeChange: (m: CanvasMode) => void
}

export default function CanvasToolbar({
  toolMode, onToolChange, onDelete, onUndo, onExport,
  canvasMode, onCanvasModeChange,
}: Props) {
  return (
    <Paper elevation={1} sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1, borderBottom: 1, borderColor: 'divider' }}>
      <ToggleButtonGroup value={canvasMode} exclusive onChange={(_, v) => v && onCanvasModeChange(v)} size="small">
        <ToggleButton value="edit"><Tooltip title="编辑模式"><EditIcon fontSize="small" /></Tooltip></ToggleButton>
        <ToggleButton value="sim"><Tooltip title="仿真模式"><PlayCircleOutlineIcon fontSize="small" /></Tooltip></ToggleButton>
      </ToggleButtonGroup>

      <span style={{ width: 1, height: 24, background: 'divider', margin: '0 4px' }} />

      {canvasMode === 'edit' && (
        <>
          <ToggleButtonGroup value={toolMode} exclusive onChange={(_, v) => v && onToolChange(v)} size="small">
            <ToggleButton value="select"><NearMeIcon fontSize="small" /></ToggleButton>
            <ToggleButton value="hexagon">⬡</ToggleButton>
            <ToggleButton value="triangle">△</ToggleButton>
            <ToggleButton value="mini-triangle">▽</ToggleButton>
          </ToggleButtonGroup>
          <Tooltip title="删除选中 (Delete)"><IconButton size="small" onClick={onDelete}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="撤销 (Ctrl+Z)"><IconButton size="small" onClick={onUndo}><UndoIcon fontSize="small" /></IconButton></Tooltip>
        </>
      )}
      <Tooltip title="导出图片"><IconButton size="small" onClick={onExport}><ImageIcon fontSize="small" /></IconButton></Tooltip>
    </Paper>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/CanvasToolbar.tsx
git commit -m "feat(canvas): add edit/sim mode toggle to CanvasToolbar"
```

---

### Task 9: SimEffectPanel — 仿真效果浏览器

**Files:**
- Create: `src/renderer/components/SimEffectPanel.tsx`

- [ ] **Step 1: 创建 SimEffectPanel.tsx**

```typescript
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Box from '@mui/material/Box'
import ColorBar from './ColorBar'
import type { Skill } from '../types'

interface Props {
  skills: Skill[]
  activeSkillId: string | null
  onPlay: (skill: Skill) => void
  onStop: () => void
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!m) return null
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) }
}

function hsbToRgb(h: number, s: number, br: number): { r: number; g: number; b: number } {
  const sn = s / 100; const bn = br / 100
  const c = bn * sn; const x = c * (1 - Math.abs(((h / 60) % 2) - 1)); const m = bn - c
  let rn = 0, gn = 0, bn2 = 0
  if (h < 60) { rn = c; gn = x }
  else if (h < 120) { rn = x; gn = c }
  else if (h < 180) { gn = c; bn2 = x }
  else if (h < 240) { gn = x; bn2 = c }
  else if (h < 300) { rn = x; bn2 = c }
  else { rn = c; bn2 = x }
  return { r: Math.round((rn + m) * 255), g: Math.round((gn + m) * 255), b: Math.round((bn2 + m) * 255) }
}

interface HsbColor { hue: number; saturation: number; brightness: number }

function extractPalette(skill: Skill) {
  const bodyPalette = (skill.mapping?.bodyTemplate as Record<string, unknown>)?.write as Record<string, unknown> | undefined
  const hsbPalette = bodyPalette?.palette as HsbColor[] | undefined
  if (hsbPalette && hsbPalette.length > 0) {
    return hsbPalette.map(c => hsbToRgb(c.hue ?? 0, c.saturation ?? 100, c.brightness ?? 100))
  }
  return skill.params
    .filter(p => p.type === 'color' && p.default)
    .map(p => hexToRgb(String(p.default)))
    .filter((c): c is { r: number; g: number; b: number } => c !== null)
}

export default function SimEffectPanel({ skills, activeSkillId, onPlay, onStop }: Props) {
  if (skills.length === 0) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>灯效列表</Typography>
        <Typography variant="caption" color="text.disabled">暂无可用灯效</Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 1.5 }}>灯效列表</Typography>
      <Stack spacing={1.5}>
        {skills.map(skill => {
          const isActive = skill.meta.id === activeSkillId
          const palette = extractPalette(skill)
          return (
            <Box
              key={skill.meta.id}
              sx={{
                bgcolor: 'action.hover',
                borderRadius: 2,
                p: 1.5,
                border: 1,
                borderColor: isActive ? '#10B981' : 'divider',
                transition: 'border-color 0.15s',
              }}
            >
              <Stack direction="row" sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {skill.meta.name}
                    {isActive && (
                      <Chip label="播放中" size="small" sx={{ ml: 0.5, fontSize: '0.6rem', height: 18, bgcolor: '#10B98122', color: '#10B981' }} />
                    )}
                  </Typography>
                  <Typography variant="caption" color="text.disabled" sx={{ mt: 0.25, display: 'block' }}>
                    {skill.meta.description || '暂无描述'}
                  </Typography>
                  {skill.meta.tags.length > 0 && (
                    <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', mt: 0.5 }}>
                      {skill.meta.tags.map(tag => (
                        <Chip key={tag} label={tag} size="small" sx={{ fontSize: '0.6rem', height: 18 }} />
                      ))}
                    </Stack>
                  )}
                </Box>
                <Button
                  variant={isActive ? 'outlined' : 'contained'}
                  size="small"
                  color={isActive ? 'error' : 'primary'}
                  onClick={() => isActive ? onStop() : onPlay(skill)}
                  sx={{ fontSize: '0.7rem', px: 1, py: 0.3, ml: 1, flexShrink: 0, minWidth: 44 }}
                >
                  {isActive ? '停止' : '播放'}
                </Button>
              </Stack>

              <ColorBar palette={palette} />

              <Typography variant="caption" sx={{ mt: 0.5, display: 'block', color: 'text.disabled', fontFamily: 'monospace', fontSize: '0.6rem' }}>
                {skill.mapping?.endpoint ?? 'PUT /effects'} · {palette.length} 颜色
              </Typography>
            </Box>
          )
        })}
      </Stack>
    </Box>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/SimEffectPanel.tsx
git commit -m "feat(canvas): add SimEffectPanel for browsing and playing effects in sim mode"
```

---

### Task 10: CanvasPage 集成

**Files:**
- Modify: `src/renderer/components/CanvasPage.tsx`

- [ ] **Step 1: 修改 CanvasPage.tsx — 添加 state、effects 和模式管理

新增 import：

```typescript
import { useEffect, useCallback, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import TextField from '@mui/material/TextField'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import type Konva from 'konva'
import CanvasToolbar from './CanvasToolbar'
import CanvasStage from './CanvasStage'
import ColorPanel from './ColorPanel'
import SimEffectPanel from './SimEffectPanel'
import { useCanvasDesign } from '../hooks/useCanvasDesign'
import { panelsOverlap, findBestSnap } from '../utils/panelGeometry'
import type { SnappedTo } from '../../shared/canvas-types'
import type { Skill } from '../types'
import { api } from '../api'
import { useSkills } from '../hooks/useSkills'
import { SimulationEngine } from '../simulation/SimulationEngine'
```

新增 state 变量和 engine ref：

```typescript
const [canvasMode, setCanvasMode] = useState<'edit' | 'sim'>('edit')
const [activeSkillId, setActiveSkillId] = useState<string | null>(null)
const [panelColors, setPanelColors] = useState<Map<string, string>>(new Map())
const engineRef = useRef<SimulationEngine | null>(null)
const { skills } = useSkills()
```

新增 Tab 键切换模式：

```typescript
// 在 useEffect 键盘快捷键中追加：
if (e.key === 'Tab') {
  e.preventDefault()
  setCanvasMode(prev => prev === 'edit' ? 'sim' : 'edit')
}
```

新增模式切换回调：

```typescript
const handleCanvasModeChange = useCallback((mode: 'edit' | 'sim') => {
  setCanvasMode(mode)
  if (mode === 'edit') {
    // 切换到编辑模式时停止仿真
    engineRef.current?.stop()
    setActiveSkillId(null)
    setPanelColors(new Map())
  }
}, [])
```

新增播放/停止回调：

```typescript
const handleSimPlay = useCallback((skill: Skill) => {
  if (!design) return
  engineRef.current?.stop()

  const engine = new SimulationEngine()
  engineRef.current = engine

  setActiveSkillId(skill.meta.id)
  engine.start(
    skill.mapping.bodyTemplate,
    design.panels,
    (colors) => {
      const hexMap = new Map<string, string>()
      for (const [id, rgb] of colors) {
        const r = rgb.r.toString(16).padStart(2, '0')
        const g = rgb.g.toString(16).padStart(2, '0')
        const b = rgb.b.toString(16).padStart(2, '0')
        hexMap.set(id, `#${r}${g}${b}`)
      }
      setPanelColors(hexMap)
    },
  )
}, [design])

const handleSimStop = useCallback(() => {
  engineRef.current?.stop()
  setActiveSkillId(null)
  setPanelColors(new Map())
}, [])
```

修改 CanvasToolbar 传递新 props：

```typescript
<CanvasToolbar
  toolMode={toolMode}
  onToolChange={setToolMode}
  onDelete={deleteSelected}
  onUndo={undo}
  onExport={handleExport}
  canvasMode={canvasMode}
  onCanvasModeChange={handleCanvasModeChange}
/>
```

修改 CanvasStage 传递新 props：

```typescript
<CanvasStage
  design={design}
  toolMode={toolMode}
  selectedIds={selectedIds}
  ghostColor={selectedColor}
  stageRef={stageRef}
  onPanelClick={handlePanelClick}
  onPanelRotate={handlePanelRotate}
  onPanelDragStart={/*...*/}
  onPanelDragEnd={/*...*/}
  onStageClick={handleStageClick}
  onBlankClick={() => setSelectedIds(new Set())}
  panelOverrides={canvasMode === 'sim' ? panelColors : undefined}
  showConnectionMarks={canvasMode === 'edit'}
  simMode={canvasMode === 'sim'}
/>
```

在 CanvasStage 下方添加效果浏览器（仅在 sim 模式）：

```typescript
{canvasMode === 'sim' && (
  <SimEffectPanel
    skills={skills}
    activeSkillId={activeSkillId}
    onPlay={handleSimPlay}
    onStop={handleSimStop}
  />
)}
```

注意：由于左侧已有设计列表，SimEffectPanel 需要放在右侧画布区域的合适位置。建议将布局改为：左侧设计列表 + 中间画布 + 右侧效果浏览器。或者效果浏览器放在画布右侧。

修改布局为三栏（sim 模式下）：

```typescript
return (
  <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
    {/* Left: Design list */}
    <Paper square elevation={0} sx={{ width: canvasMode === 'sim' ? 160 : 200, borderRight: 1, borderColor: 'divider', display: 'flex', flexDirection: 'column' }}>
      {/* ... existing design list ... */}
    </Paper>

    {/* Center: Canvas area */}
    <Box sx={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
      <CanvasToolbar ... />
      <Box sx={{ flex: 1, position: 'relative' }}>
        <CanvasStage ... />
        {canvasMode === 'edit' && selectedIds.size > 0 && (
          <ColorPanel ... />
        )}
      </Box>
    </Box>

    {/* Right: Effect browser (sim mode only) */}
    {canvasMode === 'sim' && (
      <Paper square elevation={0} sx={{ width: 280, borderLeft: 1, borderColor: 'divider', overflow: 'auto' }}>
        <SimEffectPanel ... />
      </Paper>
    )}
  </Box>
)
```

- [ ] **Step 2: 清理 worktree（如果适用）并测试构建**

Run: `npm run build`
Expected: 编译成功，无错误

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/CanvasPage.tsx
git commit -m "feat(canvas): integrate simulation engine, mode management, and SimEffectPanel"
```
