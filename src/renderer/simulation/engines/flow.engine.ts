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
