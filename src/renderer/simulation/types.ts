import type { PanelType } from '../../shared/canvas-types'

export interface HsbColor {
  hue: number
  saturation: number
  brightness: number
}

export interface RgbColor {
  r: number
  g: number
  b: number
}

export type FrameColors = Map<string, RgbColor>

export interface PanelNode {
  id: string
  type: PanelType
  x: number
  y: number
  rotation: number
  neighbors: string[]
}

/** Minimal graph interface engines depend on — avoids circular dep with PanelGraph.ts */
export interface PanelGraphReader {
  nodes: Map<string, PanelNode>
  getFlowPath(startId?: string): string[]
  getConnectedComponents(): string[][]
  getDistancesFrom(centerId: string): Map<string, number>
}

export interface EffectEngine {
  init(palette: HsbColor[], options: Record<string, unknown>): void
  getColors(elapsedMs: number, graph: PanelGraphReader): FrameColors
}
