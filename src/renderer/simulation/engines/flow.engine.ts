import type { EffectEngine, FrameColors, HsbColor, PanelGraphReader } from '../types'
import { PLUGIN_TICK_MS } from '../types'
import { paletteIndex } from '../color-utils'

const DEFAULT_TRANS_TIME = 30
// Nanoleaf Flow plugin delayTime minimum is 1, use it as default so simulation
// matches hardware behavior — brief pause at each palette color before next step.
const DEFAULT_DELAY_TIME = 1

/**
 * Flow engine — matches Nanoleaf "Flow" plugin behavior.
 *
 * Each step:
 *   1. Wipe — panels transition from palette[k] to palette[k+1] with staggered timing
 *      (panel 0 starts immediately, panel i starts `delayMs` after panel i-1)
 *   2. Hold — ALL panels hold at palette[k+1] for `delayMs`
 *      (this is the difference from the old behavior: delay is after all panels turn to target color,
 *       not after individual panel transition starts)
 *   3. Next step starts after hold finishes
 */
export class FlowEngine implements EffectEngine {
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
    const P = this.palette.length
    const N = path.length
    if (N === 0 || P === 0) return colors

    const transMs = this.transTime * PLUGIN_TICK_MS
    const delayMs = this.delayTime * PLUGIN_TICK_MS

    // Step: wipe (staggered transition) + hold (all panels at target color)
    const wipeMs = transMs + (N - 1) * delayMs
    const stepMs = wipeMs + delayMs

    const totalCycleMs = stepMs * P
    const tCycle = ((elapsedMs % totalCycleMs) + totalCycleMs) % totalCycleMs
    const stepIdx = Math.floor(tCycle / stepMs) % P
    const stepTime = tCycle % stepMs

    const nextIdx = (stepIdx + 1) % P
    const tFrom = stepIdx / P
    const tTo = nextIdx === 0 ? 1.0 : nextIdx / P

    if (stepTime < wipeMs) {
      // Wipe phase — staggered transition from palette[stepIdx] to palette[nextIdx]
      for (let i = 0; i < N; i++) {
        const panelStart = i * delayMs
        const panelEnd = panelStart + transMs

        let t: number
        if (stepTime <= panelStart) {
          t = tFrom
        } else if (stepTime >= panelEnd) {
          t = tTo
        } else {
          t = tFrom + (tTo - tFrom) * ((stepTime - panelStart) / transMs)
        }

        colors.set(path[i], paletteIndex(this.palette, t))
      }
    } else {
      // Hold phase — all panels at target palette[nextIdx]
      const color = paletteIndex(this.palette, tTo)
      for (const id of path) colors.set(id, color)
    }

    return colors
  }

  destroy(): void {}
}
