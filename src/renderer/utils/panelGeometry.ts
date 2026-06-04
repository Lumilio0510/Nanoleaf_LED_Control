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
    for (let t = 1; t <= 3; t += 2) {
      const r = t / 4
      cp.push({ x: v[ai].x + (v[bi].x - v[ai].x) * r, y: v[ai].y + (v[bi].y - v[ai].y) * r })
    }
  }
  return { type: 'triangle', sideLength: s, vertices: v, connectionPoints: cp }
}

function miniTriGeometry(): PanelGeometry {
  const s = 67
  const R = s / Math.sqrt(3)
  const v = [
    { x: 0, y: -R },
    { x: R * Math.cos(DEG(30)), y: R * Math.sin(DEG(30)) },
    { x: -R * Math.cos(DEG(30)), y: R * Math.sin(DEG(30)) },
  ]
  const cp: PanelGeometry['connectionPoints'] = []
  const edges: [number, number][] = [[0, 1], [1, 2], [2, 0]]
  for (const [ai, bi] of edges) {
    cp.push({ x: (v[ai].x + v[bi].x) / 2, y: (v[ai].y + v[bi].y) / 2 })
  }
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

/** Get world position of the midpoint of edge `edgeIndex` (edge between vertices[edgeIndex] and vertices[edgeIndex+1]). */
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

/** Inverse of getConnectionWorldPos: given a target connection point world position,
 *  compute the panel origin (x, y) so its connectionPoint[index] lands at targetWorld. */
export function computeSnappedPosition(
  panel: { rotation: number },
  type: PanelType,
  connectionIndex: number,
  targetWorld: { x: number; y: number },
): { x: number; y: number } | null {
  const geo = getPanelGeometry(type)
  if (connectionIndex < 0 || connectionIndex >= geo.connectionPoints.length) return null
  const cp = geo.connectionPoints[connectionIndex]
  const a = DEG(panel.rotation)
  const c = Math.cos(a)
  const s = Math.sin(a)
  return {
    x: targetWorld.x - (cp.x * c - cp.y * s),
    y: targetWorld.y - (cp.x * s + cp.y * c),
  }
}

export interface SnapCandidate {
  targetPanelId: string
  targetConnectionIndex: number
  draggedConnectionIndex: number
  distance: number
  snapX: number
  snapY: number
  /** true when this is a vertex→edge-midpoint snap (rather than connection→connection) */
  isVertexSnap?: boolean
}

/** Find the closest pair of connection points between a dragged panel and all
 *  other panels. Returns null if no pair is within `threshold` pixels.
 *  Also checks vertex→edge-midpoint pairs as a secondary snap mode. */
export function findBestSnap(
  dragged: { type: PanelType; x: number; y: number; rotation: number },
  allPanels: Array<{ id: string; type: PanelType; x: number; y: number; rotation: number }>,
  excludedIds: Set<string>,
  threshold = 20,
): SnapCandidate | null {
  const draggedGeo = getPanelGeometry(dragged.type)
  let best: SnapCandidate | null = null

  // Pass 1: connection-point → connection-point (existing)
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

  // Pass 2: dragged vertex → other panel's edge midpoint
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

/** Map a connection/vertex index to the edge index(es) to highlight during snap preview.
 *  For connection-point snaps (isVertexSnap=false):
 *    hexagon/mini-triangle → connectionIndex = edgeIndex (1 cp per edge)
 *    triangle → edgeIndex = Math.floor(connectionIndex / 2) (2 cp per edge)
 *  For vertex snaps (isVertexSnap=true):
 *    returns the two edges sharing the vertex at connectionIndex. */
export function connectionToEdgeIndices(
  type: PanelType,
  connectionIndex: number,
  isVertexSnap?: boolean,
): number[] {
  const nv = getPanelGeometry(type).vertices.length
  if (isVertexSnap) {
    // connectionIndex is a vertex index — return the two edges sharing it
    return [(connectionIndex + nv - 1) % nv, connectionIndex]
  }
  if (type === 'triangle') {
    return [Math.floor(connectionIndex / 2)]
  }
  // hexagon & mini-triangle: 1 connection point per edge
  return [connectionIndex]
}

function getWorldVertices(
  panel: { type: PanelType; x: number; y: number; rotation: number },
): Array<{ x: number; y: number }> {
  const geo = getPanelGeometry(panel.type)
  const a = DEG(panel.rotation)
  const c = Math.cos(a)
  const s = Math.sin(a)
  return geo.vertices.map(v => ({
    x: panel.x + v.x * c - v.y * s,
    y: panel.y + v.x * s + v.y * c,
  }))
}

/** Check if two line segments intersect (excluding shared endpoints with tolerance) */
const EPS = 2e-3
function segmentsCross(
  a: { x: number; y: number }, b: { x: number; y: number },
  c: { x: number; y: number }, d: { x: number; y: number },
): boolean {
  const d1x = b.x - a.x, d1y = b.y - a.y
  const d2x = d.x - c.x, d2y = d.y - c.y
  const cross = d1x * d2y - d1y * d2x
  if (Math.abs(cross) < 1e-9) return false
  const t = ((c.x - a.x) * d2y - (c.y - a.y) * d2x) / cross
  const u = ((c.x - a.x) * d1y - (c.y - a.y) * d1x) / cross
  return t > EPS && t < 1 - EPS && u > EPS && u < 1 - EPS
}

/** Check if a point is strictly inside a convex polygon using cross-product sign test */
function pointInConvexPolygon(p: { x: number; y: number }, verts: Array<{ x: number; y: number }>): boolean {
  let sign = 0
  for (let i = 0; i < verts.length; i++) {
    const j = (i + 1) % verts.length
    const cross = (verts[j].x - verts[i].x) * (p.y - verts[i].y) - (verts[j].y - verts[i].y) * (p.x - verts[i].x)
    if (Math.abs(cross) < 1e-9) return false // on the edge — touching, not overlapping
    const s = Math.sign(cross)
    if (sign === 0) sign = s
    else if (s !== sign) return false
  }
  return true
}

/** Check if two convex polygons overlap by testing edge crossings and vertex containment */
function convexOverlap(
  va: Array<{ x: number; y: number }>,
  vb: Array<{ x: number; y: number }>,
  centerA: { x: number; y: number },
  centerB: { x: number; y: number },
): boolean {
  // Edge crossing test
  for (let i = 0; i < va.length; i++) {
    const j = (i + 1) % va.length
    for (let k = 0; k < vb.length; k++) {
      const l = (k + 1) % vb.length
      if (segmentsCross(va[i], va[j], vb[k], vb[l])) return true
    }
  }
  // Vertex containment test (strict interior, excludes boundary)
  for (const v of va) { if (pointInConvexPolygon(v, vb)) return true }
  for (const v of vb) { if (pointInConvexPolygon(v, va)) return true }
  // Center containment test (catches one polygon entirely inside another)
  if (pointInConvexPolygon(centerA, vb)) return true
  if (pointInConvexPolygon(centerB, va)) return true
  // Identical position — centers coincide or are extremely close
  const dx = centerA.x - centerB.x, dy = centerA.y - centerB.y
  if (dx * dx + dy * dy < 1) return true
  return false
}

export function panelsOverlap(
  a: { type: PanelType; x: number; y: number; rotation: number },
  b: { type: PanelType; x: number; y: number; rotation: number },
): boolean {
  return convexOverlap(getWorldVertices(a), getWorldVertices(b), a, b)
}
