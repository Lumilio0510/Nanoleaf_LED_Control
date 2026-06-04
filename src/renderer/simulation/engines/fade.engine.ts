import type { EffectEngine, FrameColors, HsbColor, PanelGraphReader } from '../types'
import { PLUGIN_TICK_MS } from '../types'
import { paletteIndex } from '../color-utils'

const DEFAULT_TRANS_TIME = 30
const DEFAULT_DELAY_TIME = 0

/**
 * Fade engine — matches Nanoleaf "Fade" plugin behavior.
 *
 * A color wave propagates through panels along a spatial direction.
 * Timeline for one palette step (k → k+1):
 *   1. Panel 0 transitions palette[k]→palette[k+1] over transTime/N ms
 *   2. Panel 1 starts after panel 0 finishes, same duration
 *   3. ...continues through all N panels
 *   4. After the last panel finishes, all panels hold at palette[k+1] for delayTime
 *   5. Next step begins: palette[k+1]→palette[k+2]
 *
 * When delayTime > 0, there is a visible pause between waves where all panels
 * show the same target color before the next wave starts.
 */
export class FadeEngine implements EffectEngine {
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
    const N = path.length
    const P = this.palette.length

    // Fallback: no path or single color — show first palette entry on all panels
    if (N === 0 || P <= 1) {
      const c = P === 0 ? { r: 0, g: 0, b: 0 } : paletteIndex(this.palette, 0)
      for (const id of graph.nodes.keys()) colors.set(id, c)
      return colors
    }

    const transMs = this.transTime * PLUGIN_TICK_MS   // total wave time
    const delayMs = this.delayTime * PLUGIN_TICK_MS    // hold after wave
    const stepMs = transMs + delayMs                   // one full palette step

    const stepIdx = Math.floor(elapsedMs / stepMs) % P
    const stepElapsed = elapsedMs % stepMs

    const tFrom = stepIdx / P
    const tTo = (stepIdx + 1) / P

    // Hold phase: wave is done, all panels show target color
    if (stepElapsed >= transMs) {
      const holdColor = paletteIndex(this.palette, tTo)
      for (const id of graph.nodes.keys()) colors.set(id, holdColor)
      return colors
    }

    // Wave phase: panels transition sequentially along the path
    const panelDuration = transMs / N   // each panel's transition window

    for (let i = 0; i < N; i++) {
      const panelStart = i * panelDuration
      const panelEnd = panelStart + panelDuration

      if (stepElapsed < panelStart) {
        colors.set(path[i], paletteIndex(this.palette, tFrom))
      } else if (stepElapsed < panelEnd) {
        const frac = (stepElapsed - panelStart) / panelDuration
        const t = tFrom + (tTo - tFrom) * frac
        colors.set(path[i], paletteIndex(this.palette, t))
      } else {
        colors.set(path[i], paletteIndex(this.palette, tTo))
      }
    }

    // Any panels not on the spatial path get the first path panel's color
    const fallback = colors.get(path[0]) ?? paletteIndex(this.palette, tFrom)
    for (const id of graph.nodes.keys()) {
      if (!colors.has(id)) colors.set(id, fallback)
    }

    return colors
  }

  destroy(): void {}
}
