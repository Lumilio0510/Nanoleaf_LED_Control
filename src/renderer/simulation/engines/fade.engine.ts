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
