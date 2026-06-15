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

function rotateVec(x: number, y: number, deg: number): { x: number; y: number } {
  const a = DEG(deg)
  const c = Math.cos(a)
  const s = Math.sin(a)
  return { x: x * c - y * s, y: x * s + y * c }
}

export function getVertexWorldPos(
  panel: { x: number; y: number; rotation: number },
  type: PanelType,
  index: number,
): { x: number; y: number } | null {
  const geo = getPanelGeometry(type)
  if (index < 0 || index >= geo.vertices.length) return null
  const v = geo.vertices[index]
  const r = rotateVec(v.x, v.y, panel.rotation)
  return { x: panel.x + r.x, y: panel.y + r.y }
}

export interface SnapPoint {
  index: number
  x: number
  y: number
}

export interface SnapCandidate {
  targetPanelId: string
  targetConnectionIndex: number
  draggedConnectionIndex: number
  distance: number
  snapX: number
  snapY: number
}

export function getSnapPointsLocal(type: PanelType): SnapPoint[] {
  const geo = getPanelGeometry(type)
  const points: SnapPoint[] = geo.vertices.map((v, index) => ({ index, x: v.x, y: v.y }))

  if (type === 'triangle') {
    for (let i = 0; i < geo.vertices.length; i++) {
      const a = geo.vertices[i]
      const b = geo.vertices[(i + 1) % geo.vertices.length]
      points.push({
        index: geo.vertices.length + i,
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
      })
    }
  }

  return points
}

export function getSnapPointsWorld(
  panel: { type: PanelType; x: number; y: number; rotation: number },
): SnapPoint[] {
  return getSnapPointsLocal(panel.type).map(point => {
    const r = rotateVec(point.x, point.y, panel.rotation)
    return { index: point.index, x: panel.x + r.x, y: panel.y + r.y }
  })
}

export function getSnapPointWorldPos(
  panel: { type: PanelType; x: number; y: number; rotation: number },
  index: number,
): { x: number; y: number } | null {
  return getSnapPointsWorld(panel).find(point => point.index === index) ?? null
}

function compareSnapCandidates(a: SnapCandidate, b: SnapCandidate): number {
  return a.distance - b.distance
}

export function findSnapCandidates(
  dragged: { type: PanelType; x: number; y: number; rotation: number },
  allPanels: Array<{ id: string; type: PanelType; x: number; y: number; rotation: number }>,
  excludedIds: Set<string>,
  threshold = 20,
): SnapCandidate[] {
  const candidates: SnapCandidate[] = []
  const seen = new Set<string>()
  const snapDistance = Math.max(34, threshold * 1.7)
  const draggedPoints = getSnapPointsWorld(dragged)

  for (const other of allPanels) {
    if (excludedIds.has(other.id)) continue
    const otherPoints = getSnapPointsWorld(other)

    for (const draggedPoint of draggedPoints) {
      for (const otherPoint of otherPoints) {
        const distance = dist(draggedPoint, otherPoint)
        if (distance > snapDistance) continue

        const snapX = dragged.x + (otherPoint.x - draggedPoint.x)
        const snapY = dragged.y + (otherPoint.y - draggedPoint.y)
        const key = `${other.id}|${otherPoint.index}|${draggedPoint.index}|${snapX.toFixed(2)}|${snapY.toFixed(2)}`
        if (seen.has(key)) continue
        seen.add(key)

        candidates.push({
          targetPanelId: other.id,
          targetConnectionIndex: otherPoint.index,
          draggedConnectionIndex: draggedPoint.index,
          distance,
          snapX,
          snapY,
        })
      }
    }
  }

  return candidates.sort(compareSnapCandidates)
}

export function findBestSnap(
  dragged: { type: PanelType; x: number; y: number; rotation: number },
  allPanels: Array<{ id: string; type: PanelType; x: number; y: number; rotation: number }>,
  excludedIds: Set<string>,
  threshold = 20,
): SnapCandidate | null {
  return findSnapCandidates(dragged, allPanels, excludedIds, threshold)[0] ?? null
}
