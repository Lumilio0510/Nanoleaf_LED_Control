import type { PanelType } from '../../shared/canvas-types'

export interface PanelGeometry {
  type: PanelType
  sideLength: number
  vertices: Array<{ x: number; y: number }>
  connectionPoints: Array<{ x: number; y: number }>
}

const DEG = (d: number) => (d * Math.PI) / 180

function hexGeometry(): PanelGeometry {
  const s = 67
  const v: PanelGeometry['vertices'] = []
  for (let i = 0; i < 6; i++) v.push({ x: s * Math.cos(DEG(60 * i)), y: s * Math.sin(DEG(60 * i)) })
  const a = s * Math.sqrt(3) / 2
  const cp: PanelGeometry['connectionPoints'] = []
  for (let i = 0; i < 6; i++) cp.push({ x: a * Math.cos(DEG(30 + 60 * i)), y: a * Math.sin(DEG(30 + 60 * i)) })
  return { type: 'hexagon', sideLength: s, vertices: v, connectionPoints: cp }
}

function triGeometry(): PanelGeometry {
  const s = 134
  const R = s / Math.sqrt(3)
  const v = [
    { x: 0, y: -R },
    { x: R * Math.cos(DEG(30)), y: R * Math.sin(DEG(30)) },
    { x: -R * Math.cos(DEG(30)), y: R * Math.sin(DEG(30)) },
  ]
  const cp: PanelGeometry['connectionPoints'] = []
  const edges: [number, number][] = [[0, 1], [1, 2], [2, 0]]
  for (const [ai, bi] of edges) {
    for (let t = 1; t <= 2; t++) {
      const r = t / 3
      cp.push({ x: v[ai].x + (v[bi].x - v[ai].x) * r, y: v[ai].y + (v[bi].y - v[ai].y) * r })
    }
  }
  return { type: 'triangle', sideLength: s, vertices: v, connectionPoints: cp }
}

function miniTriGeometry(): PanelGeometry {
  const s = 67
  const R = s / Math.sqrt(3)
  const r = s / (2 * Math.sqrt(3))
  const v = [
    { x: 0, y: -R },
    { x: R * Math.cos(DEG(30)), y: R * Math.sin(DEG(30)) },
    { x: -R * Math.cos(DEG(30)), y: R * Math.sin(DEG(30)) },
  ]
  const cp = [
    { x: 0, y: r },
    { x: r * Math.cos(DEG(-30)), y: r * Math.sin(DEG(-30)) },
    { x: -r * Math.cos(DEG(-30)), y: r * Math.sin(DEG(-30)) },
  ]
  return { type: 'mini-triangle', sideLength: s, vertices: v, connectionPoints: cp }
}

const CACHE: Record<PanelType, PanelGeometry> = {
  hexagon: hexGeometry(),
  triangle: triGeometry(),
  'mini-triangle': miniTriGeometry(),
}

export function getPanelGeometry(type: PanelType): PanelGeometry {
  return CACHE[type]
}

export function getConnectionWorldPos(
  panel: { x: number; y: number; rotation: number },
  type: PanelType,
  index: number,
): { x: number; y: number } | null {
  const geo = getPanelGeometry(type)
  if (index < 0 || index >= geo.connectionPoints.length) return null
  const cp = geo.connectionPoints[index]
  const a = DEG(panel.rotation)
  const c = Math.cos(a)
  const s = Math.sin(a)
  return { x: panel.x + cp.x * c - cp.y * s, y: panel.y + cp.x * s + cp.y * c }
}

export function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}
