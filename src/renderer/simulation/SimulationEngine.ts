import type { PlacedPanel } from '../../shared/canvas-types'
import type { EffectEngine, FrameColors, HsbColor } from './types'
import { PanelGraph } from './PanelGraph'
import { upsamplePalette } from './color-utils'

const PLUGIN_ENGINE_MAP: Record<string, string> = {
  '027842e4-e1d6-4a4c-a731-be74a1ebd4cf': 'flow',
  '6970681a-20b5-4c5e-8813-bdaebc4ee4fa': 'wheel',
  '713518c1-d560-47db-8991-de780af71d1e': 'explode',
  'b3fd723a-aae8-4c99-bf2b-087159e0ef53': 'fade',
  'ba632d3e-9c2b-4413-a965-510c839b3f71': 'random',
  '70b7c636-6bf8-491f-89c1-f4103508d642': 'highlight',
}

interface SkillBodyWrite {
  command?: string
  animName?: string
  version?: string
  animType?: string
  colorType?: string
  pluginUuid?: string
  pluginType?: string
  pluginOptions?: Record<string, unknown> | Array<{ name: string; value: unknown }>
  palette?: Array<{ hue?: number; saturation?: number; brightness?: number }>
}

interface ParsedSkillBody {
  pluginUuid: string
  palette: HsbColor[]
  options: Record<string, unknown>
}

export class SimulationEngine {
  private engine: EffectEngine | null = null
  private rafId = 0
  private startTime = 0
  private _elapsedMs = 0
  private _playing = false

  /** Parse raw skill body into structured engine parameters */
  private static parseSkillBody(bodyTemplate: Record<string, unknown>): ParsedSkillBody {
    const write = bodyTemplate?.write as SkillBodyWrite | undefined
    const effectDef = (write ?? bodyTemplate) as SkillBodyWrite

    const pluginUuid = effectDef.pluginUuid ?? ''
    const palette: HsbColor[] = (effectDef.palette ?? []).map(p => ({
      hue: p.hue ?? 0,
      saturation: p.saturation ?? 100,
      brightness: p.brightness ?? 100,
    }))

    // Convert Nanoleaf-style [{name, value}] pluginOptions to {key: value} object
    let options: Record<string, unknown> = {}
    const po = effectDef.pluginOptions
    if (Array.isArray(po)) {
      for (const item of po) {
        if (item && typeof item === 'object' && 'name' in item && 'value' in item) {
          options[item.name as string] = item.value
        }
      }
    } else if (po && typeof po === 'object') {
      options = po as Record<string, unknown>
    }

    return { pluginUuid, palette, options }
  }

  start(
    bodyTemplate: Record<string, unknown>,
    panels: PlacedPanel[],
    onFrame: (colors: FrameColors) => void,
  ): void {
    this.stop()

    const { pluginUuid, palette, options } = SimulationEngine.parseSkillBody(bodyTemplate)
    const engineName = PLUGIN_ENGINE_MAP[pluginUuid] ?? 'fade'

    // Palette upsampling: insert intermediate colors for smoother gradient transitions
    const paletteSubSteps = typeof options.paletteSubSteps === 'number' ? options.paletteSubSteps : 0
    const effectivePalette = paletteSubSteps > 0 ? upsamplePalette(palette, paletteSubSteps) : palette

    this.loadEngine(engineName).then(EngineClass => {
      this.engine = new EngineClass()
      this.engine.init(effectivePalette, options)

      const graph = new PanelGraph(panels)
      this._playing = true
      this.startTime = performance.now()
      this._elapsedMs = 0

      const tick = (now: number) => {
        if (!this._playing || !this.engine) return
        this._elapsedMs = now - this.startTime
        const colors = this.engine.getColors(this._elapsedMs, graph)
        onFrame(colors)
        this.rafId = requestAnimationFrame(tick)
      }
      this.rafId = requestAnimationFrame(tick)
    }).catch(err => {
      console.error('[Simulation] Failed to load engine:', err)
    })
  }

  /** Engine loader — uses statically-analyzable imports for Vite bundling.
   *  Adding a new engine: add an entry here + map its UUID in PLUGIN_ENGINE_MAP. */
  private async loadEngine(name: string): Promise<new () => EffectEngine> {
    const registry: Record<string, () => Promise<new () => EffectEngine>> = {
      flow: () => import('./engines/flow.engine').then(m => m.FlowEngine),
      wheel: () => import('./engines/wheel.engine').then(m => m.WheelEngine),
      explode: () => import('./engines/explode.engine').then(m => m.ExplodeEngine),
      random: () => import('./engines/random.engine').then(m => m.RandomEngine),
      highlight: () => import('./engines/highlight.engine').then(m => m.HighlightEngine),
      fade: () => import('./engines/fade.engine').then(m => m.FadeEngine),
    }
    const loader = registry[name] ?? registry.fade!
    return loader()
  }

  stop(): void {
    this._playing = false
    if (this.rafId) {
      cancelAnimationFrame(this.rafId)
      this.rafId = 0
    }
    if (this.engine) {
      this.engine.destroy()
      this.engine = null
    }
    this._elapsedMs = 0
  }

  get playing(): boolean { return this._playing }
  get elapsedMs(): number { return this._elapsedMs }
}
