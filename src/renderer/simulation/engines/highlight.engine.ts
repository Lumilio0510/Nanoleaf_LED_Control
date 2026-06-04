import type { EffectEngine, FrameColors, HsbColor, PanelGraphReader } from '../types'
import { PLUGIN_TICK_MS } from '../types'
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

    const highlightMs = this.transTime * PLUGIN_TICK_MS
    const cycleMs = highlightMs * path.length
    const pos = (elapsedMs % cycleMs) / highlightMs // continuous position 0..path.length

    for (let i = 0; i < path.length; i++) {
      const dist = Math.abs(i - pos)
      const brightness = dist < 1.5
        ? Math.cos(dist / 1.5 * Math.PI / 2)
        : 0.03

      // Discrete palette cycle per panel — each panel shows a distinct palette color
      const ci = i % this.palette.length
      const base = hsbToRgb(
        this.palette[ci].hue,
        this.palette[ci].saturation,
        this.palette[ci].brightness,
      )
      colors.set(path[i], {
        r: Math.round(base.r * brightness),
        g: Math.round(base.g * brightness),
        b: Math.round(base.b * brightness),
      })
    }

    return colors
  }

  destroy(): void {}
}
