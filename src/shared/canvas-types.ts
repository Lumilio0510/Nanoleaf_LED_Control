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
}

export interface CanvasDesign {
  id: string
  name: string
  panels: PlacedPanel[]
  createdAt: string
  updatedAt: string
}

export interface CanvasDesignMeta {
  id: string
  name: string
  updatedAt: string
}
