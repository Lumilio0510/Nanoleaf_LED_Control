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
