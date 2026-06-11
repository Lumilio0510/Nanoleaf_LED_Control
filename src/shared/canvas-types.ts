export type PanelType = 'hexagon' | 'triangle' | 'mini-triangle'

export interface SnappedTo {
  panelId: string
  connectionIndex: number
}

export interface PlacedPanel {
  id: string
  type: PanelType
  x: number
  y: number
  rotation: number
  color: string
  snappedTo: SnappedTo | null
  /** World-space vertex coordinates — computed on save for LLM reference */
  vertices: Array<{ x: number; y: number }>
}

export interface CanvasDesign {
  id: string
  name: string
  /** User's description of what this design represents (e.g., "一颗五角星", "圣诞树") */
  description: string
  panels: PlacedPanel[]
  createdAt: string
  updatedAt: string
}

export interface CanvasDesignMeta {
  id: string
  name: string
  updatedAt: string
}
