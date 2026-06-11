import type { PanelType } from '../../shared/canvas-types'
import {
  getPanelGeometry,
  getConnectionWorldPos,
  computeSnappedPosition,
  panelsOverlap,
  panelsShareEdge,
  getWorldVertices,
} from '../../shared/panelGeometry'

export { getPanelGeometry, getConnectionWorldPos, computeSnappedPosition, panelsOverlap, panelsShareEdge, getWorldVertices }
export type { PanelGeometry } from '../../shared/panelGeometry'

const DEG = (d: number) => (d * Math.PI) / 180

export function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}

export function getVertexWorldPos(
  panel: { x: number; y: number; rotation: number },
  type: PanelType,
  index: number,
): { x: number; y: number } | null {
  const geo = getPanelGeometry(type)
  if (index < 0 || index >= geo.vertices.length) return null
  const v = geo.vertices[index]
  const a = DEG(panel.rotation)
  const c = Math.cos(a)
  const s = Math.sin(a)
  return { x: panel.x + v.x * c - v.y * s, y: panel.y + v.x * s + v.y * c }
}

function getEdgeMidpointWorldPos(
  panel: { type: PanelType; x: number; y: number; rotation: number },
  edgeIndex: number,
): { x: number; y: number } | null {
  const geo = getPanelGeometry(panel.type)
  const nv = geo.vertices.length
  if (edgeIndex < 0 || edgeIndex >= nv) return null
  const vi = geo.vertices[edgeIndex]
  const vj = geo.vertices[(edgeIndex + 1) % nv]
  const mid = { x: (vi.x + vj.x) / 2, y: (vi.y + vj.y) / 2 }
  const a = DEG(panel.rotation)
  const c = Math.cos(a)
  const s = Math.sin(a)
  return { x: panel.x + mid.x * c - mid.y * s, y: panel.y + mid.x * s + mid.y * c }
}

export interface SnapCandidate {
  targetPanelId: string
  targetConnectionIndex: number
  draggedConnectionIndex: number
  distance: number
  snapX: number
  snapY: number
  isVertexSnap?: boolean
}

export function findBestSnap(
  dragged: { type: PanelType; x: number; y: number; rotation: number },
  allPanels: Array<{ id: string; type: PanelType; x: number; y: number; rotation: number }>,
  excludedIds: Set<string>,
  threshold = 20,
): SnapCandidate | null {
  const draggedGeo = getPanelGeometry(dragged.type)
  let best: SnapCandidate | null = null

  for (const other of allPanels) {
    if (excludedIds.has(other.id)) continue
    const otherGeo = getPanelGeometry(other.type)

    for (let di = 0; di < draggedGeo.connectionPoints.length; di++) {
      const dp = getConnectionWorldPos(dragged, dragged.type, di)
      if (!dp) continue

      for (let oi = 0; oi < otherGeo.connectionPoints.length; oi++) {
        const op = getConnectionWorldPos(other, other.type, oi)
        if (!op) continue

        const d = dist(dp, op)
        if (d > threshold) continue

        if (!best || d < best.distance) {
          const snapped = computeSnappedPosition(dragged, dragged.type, di, op)
          if (!snapped) continue
          best = {
            targetPanelId: other.id,
            targetConnectionIndex: oi,
            draggedConnectionIndex: di,
            distance: d,
            snapX: snapped.x,
            snapY: snapped.y,
          }
        }
      }
    }
  }

  for (const other of allPanels) {
    if (excludedIds.has(other.id)) continue
    const otherGeo = getPanelGeometry(other.type)

    for (let vi = 0; vi < draggedGeo.vertices.length; vi++) {
      const vp = getVertexWorldPos(dragged, dragged.type, vi)
      if (!vp) continue

      for (let ei = 0; ei < otherGeo.vertices.length; ei++) {
        const ep = getEdgeMidpointWorldPos(other, ei)
        if (!ep) continue

        const d = dist(vp, ep)
        if (d > threshold) continue

        if (!best || d < best.distance) {
          best = {
            targetPanelId: other.id,
            targetConnectionIndex: ei,
            draggedConnectionIndex: vi,
            distance: d,
            snapX: dragged.x + (ep.x - vp.x),
            snapY: dragged.y + (ep.y - vp.y),
            isVertexSnap: true,
          }
        }
      }
    }
  }

  return best
}

export function connectionToEdgeIndices(
  type: PanelType,
  connectionIndex: number,
  isVertexSnap?: boolean,
): number[] {
  const nv = getPanelGeometry(type).vertices.length
  if (isVertexSnap) {
    return [(connectionIndex + nv - 1) % nv, connectionIndex]
  }
  if (type === 'triangle') {
    return [Math.floor(connectionIndex / 2)]
  }
  return [connectionIndex]
}
