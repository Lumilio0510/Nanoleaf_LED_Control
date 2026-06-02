import type { PlacedPanel } from '../../shared/canvas-types'
import type { EffectEngine, FrameColors, HsbColor } from './types'
import { PanelGraph } from './PanelGraph'

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
  pluginOptions?: Record<string, unknown>
  palette?: Array<{ hue?: number; saturation?: number; brightness?: number }>
}

export class SimulationEngine {
  private engine: EffectEngine | null = null
  private rafId = 0
  private startTime = 0
  private _elapsedMs = 0
  private _playing = false

  start(
    bodyTemplate: Record<string, unknown>,
    panels: PlacedPanel[],
    onFrame: (colors: FrameColors) => void,
  ): void {
    this.stop()

    const write = bodyTemplate?.write as SkillBodyWrite | undefined
    const effectDef = write ?? bodyTemplate
    const pluginUuid = effectDef.pluginUuid ?? ''
    const engineName = PLUGIN_ENGINE_MAP[pluginUuid]

    if (!engineName) {
      console.warn(`[Simulation] Unknown pluginUuid: ${pluginUuid}, defaulting to fade`)
    }

    const palette: HsbColor[] = (effectDef.palette ?? []).map(p => ({
      hue: p.hue ?? 0,
      saturation: p.saturation ?? 100,
      brightness: p.brightness ?? 100,
    }))
    const options = effectDef.pluginOptions ?? {}

    // Dynamic import of engine
    this.loadEngine(engineName ?? 'fade').then(EngineClass => {
      this.engine = new EngineClass()
      this.engine.init(palette, options)

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

  private async loadEngine(name: string): Promise<new () => EffectEngine> {
    switch (name) {
      case 'flow': return (await import('./engines/flow.engine')).FlowEngine
      case 'wheel': return (await import('./engines/wheel.engine')).WheelEngine
      case 'explode': return (await import('./engines/explode.engine')).ExplodeEngine
      case 'random': return (await import('./engines/random.engine')).RandomEngine
      case 'highlight': return (await import('./engines/highlight.engine')).HighlightEngine
      case 'fade':
      default: return (await import('./engines/fade.engine')).FadeEngine
    }
  }

  stop(): void {
    this._playing = false
    if (this.rafId) {
      cancelAnimationFrame(this.rafId)
      this.rafId = 0
    }
    this.engine = null
    this._elapsedMs = 0
  }

  get playing(): boolean { return this._playing }
  get elapsedMs(): number { return this._elapsedMs }
}
