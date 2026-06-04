import type { EffectEngine, FrameColors, HsbColor, PanelGraphReader } from '../types'
import { PLUGIN_TICK_MS } from '../types'
import { paletteIndex } from '../color-utils'

const DEFAULT_TRANS_TIME = 30
const DEFAULT_DELAY_TIME = 0

/**
 * Wheel engine — continuous rotating gradient across panels.
 * Unlike Flow (discrete steps), Wheel maintains a continuous gradient at all times.
 */
export class WheelEngine implements EffectEngine {
  private palette: HsbColor[] = []
  private transTime = DEFAULT_TRANS_TIME
  private delayTime = DEFAULT_DELAY_TIME
  private linDirection = 'right'

  init(palette: HsbColor[], options: Record<string, unknown>): void {
    this.palette = palette
    if (typeof options.transTime === 'number') this.transTime = options.transTime
    if (typeof options.delayTime === 'number') this.delayTime = options.delayTime
    if (typeof options.linDirection === 'string') this.linDirection = options.linDirection
  }

  getColors(elapsedMs: number, graph: PanelGraphReader): FrameColors {
    const colors: FrameColors = new Map()
    const path = graph.getSpatialPath(this.linDirection)
    if (path.length === 0) return colors

    const cycleMs = this.transTime * PLUGIN_TICK_MS
    const delayMs = this.delayTime * PLUGIN_TICK_MS

    const isHorizontal = this.linDirection === 'left' || this.linDirection === 'right'
    let minPos = Infinity, maxPos = -Infinity
    for (const id of path) {
      const node = graph.nodes.get(id)
      if (!node) continue
      const pos = isHorizontal ? node.x : node.y
      if (pos < minPos) minPos = pos
      if (pos > maxPos) maxPos = pos
    }
    const range = maxPos - minPos || 1

    for (let i = 0; i < path.length; i++) {
      const id = path[i]
      const node = graph.nodes.get(id)
      if (!node) continue
      const pos = isHorizontal ? node.x : node.y
      const normalized = (pos - minPos) / range

      const panelElapsed = elapsedMs - i * delayMs
      let progress = (panelElapsed % cycleMs) / cycleMs
      if (progress < 0) progress += 1

      // Continuous rotation: palette scrolls across panels
      let t = (normalized + progress) % 1
      if (t < 0) t += 1
      colors.set(id, paletteIndex(this.palette, t))
    }
    return colors
  }

  destroy(): void {}
}
