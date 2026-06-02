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
