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
