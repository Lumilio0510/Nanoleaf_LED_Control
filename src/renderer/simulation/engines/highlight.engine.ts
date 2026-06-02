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
