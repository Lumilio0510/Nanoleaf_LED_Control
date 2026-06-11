import type { PanelType, PlacedPanel } from './canvas-types'

export interface PanelGeometry {
  type: PanelType
  sideLength: number
  vertices: Array<{ x: number; y: number }>
  connectionPoints: Array<{ x: number; y: number }>
  /** Number of edges (= number of connection points for hexagon/mini; 2× for triangle) */
  edgeCount: number
}

const DEG = (d: number) => (d * Math.PI) / 180

function hexGeometry(): PanelGeometry {
  const s = 67
  const v: PanelGeometry['vertices'] = []
  for (let i = 0; i < 6; i++) v.push({ x: s * Math.cos(DEG(60 * i)), y: s * Math.sin(DEG(60 * i)) })
  const a = s * Math.sqrt(3) / 2
  const cp: PanelGeometry['connectionPoints'] = []
  for (let i = 0; i < 6; i++) cp.push({ x: a * Math.cos(DEG(30 + 60 * i)), y: a * Math.sin(DEG(30 + 60 * i)) })
  return { type: 'hexagon', sideLength: s, vertices: v, connectionPoints: cp, edgeCount: 6 }
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
  return { type: 'triangle', sideLength: s, vertices: v, connectionPoints: cp, edgeCount: 3 }
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
  return { type: 'mini-triangle', sideLength: s, vertices: v, connectionPoints: cp, edgeCount: 3 }
}

const CACHE: Record<PanelType, PanelGeometry> = {
  hexagon: hexGeometry(),
  triangle: triGeometry(),
  'mini-triangle': miniTriGeometry(),
}

export function getPanelGeometry(type: PanelType): PanelGeometry {
  return CACHE[type]
}

function rotateVec(x: number, y: number, deg: number): { x: number; y: number } {
  const a = DEG(deg)
  const c = Math.cos(a), s = Math.sin(a)
  return { x: x * c - y * s, y: x * s + y * c }
}

export function getConnectionWorldPos(
  panel: { x: number; y: number; rotation: number },
  type: PanelType,
  index: number,
): { x: number; y: number } | null {
  const geo = getPanelGeometry(type)
  if (index < 0 || index >= geo.connectionPoints.length) return null
  const r = rotateVec(geo.connectionPoints[index].x, geo.connectionPoints[index].y, panel.rotation)
  return { x: panel.x + r.x, y: panel.y + r.y }
}

export function computeSnappedPosition(
  panel: { rotation: number },
  type: PanelType,
  connectionIndex: number,
  targetWorld: { x: number; y: number },
): { x: number; y: number } | null {
  const geo = getPanelGeometry(type)
  if (connectionIndex < 0 || connectionIndex >= geo.connectionPoints.length) return null
  const cp = geo.connectionPoints[connectionIndex]
  const r = rotateVec(cp.x, cp.y, panel.rotation)
  return { x: targetWorld.x - r.x, y: targetWorld.y - r.y }
}

/** Get world-space midpoint and outward normal of an edge */
export function getEdgeInfo(
  panel: { x: number; y: number; rotation: number },
  type: PanelType,
  edgeIndex: number,
): { midpoint: { x: number; y: number }; normal: { x: number; y: number } } | null {
  const geo = getPanelGeometry(type)
  const n = geo.vertices.length
  if (edgeIndex < 0 || edgeIndex >= geo.edgeCount) return null

  const i = edgeIndex % n
  const j = (i + 1) % n

  const vi = rotateVec(geo.vertices[i].x, geo.vertices[i].y, panel.rotation)
  const vj = rotateVec(geo.vertices[j].x, geo.vertices[j].y, panel.rotation)

  const mx = (vi.x + vj.x) / 2
  const my = (vi.y + vj.y) / 2

  const edx = vj.x - vi.x
  const edy = vj.y - vi.y
  let nx = edy
  let ny = -edx
  const nl = Math.sqrt(nx * nx + ny * ny)
  if (nl < 1e-9) return null
  nx /= nl
  ny /= nl
  const toCenter = { x: -mx, y: -my }
  if (nx * toCenter.x + ny * toCenter.y > 0) {
    nx = -nx
    ny = -ny
  }

  return { midpoint: { x: panel.x + mx, y: panel.y + my }, normal: { x: nx, y: ny } }
}

/**
 * Align child to parent's edge.
 * Picks the child edge whose outward normal most opposes the parent edge's outward normal,
 * then aligns their midpoints.
 */
export function alignToEdge(
  parent: { x: number; y: number; rotation: number; type: PanelType },
  parentEdge: number,
  childType: PanelType,
  childRotation: number,
): { x: number; y: number; childEdge: number; parentCp: number; childCp: number; dot: number } | null {
  const pInfo = getEdgeInfo(parent, parent.type, parentEdge)
  if (!pInfo) return null

  const childGeo = getPanelGeometry(childType)
  const n = childGeo.vertices.length

  let best: { childEdge: number; dot: number; midpoint: { x: number; y: number } } | null = null

  for (let ce = 0; ce < childGeo.edgeCount; ce++) {
    const ci = ce % n
    const cj = (ci + 1) % n
    const cvi = rotateVec(childGeo.vertices[ci].x, childGeo.vertices[ci].y, childRotation)
    const cvj = rotateVec(childGeo.vertices[cj].x, childGeo.vertices[cj].y, childRotation)
    const cmx = (cvi.x + cvj.x) / 2
    const cmy = (cvi.y + cvj.y) / 2
    const cdx = cvj.x - cvi.x
    const cdy = cvj.y - cvi.y
    let cnx = cdy
    let cny = -cdx
    const cnl = Math.sqrt(cnx * cnx + cny * cny)
    if (cnl < 1e-9) continue
    cnx /= cnl
    cny /= cnl

    if (cnx * cmx + cny * cmy < 0) {
      cnx = -cnx
      cny = -cny
    }

    const dot = pInfo.normal.x * cnx + pInfo.normal.y * cny
    const cx = pInfo.midpoint.x - cmx
    const cy = pInfo.midpoint.y - cmy
    if (!best || dot < best.dot) {
      best = { childEdge: ce, dot, midpoint: { x: cx, y: cy } }
    }
  }

  const parentCp = parentEdge * (parent.type === 'triangle' ? 2 : 1)
  const childCp = best!.childEdge * (childType === 'triangle' ? 2 : 1)

  return {
    x: best!.midpoint.x,
    y: best!.midpoint.y,
    childEdge: best!.childEdge,
    parentCp,
    childCp,
    dot: best!.dot,
  }
}

// ── Overlap detection ──────────────────────────────────────────────

export function getWorldVertices(
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

function pointInConvexPolygon(p: { x: number; y: number }, verts: Array<{ x: number; y: number }>): boolean {
  let sign = 0
  for (let i = 0; i < verts.length; i++) {
    const j = (i + 1) % verts.length
    const cross = (verts[j].x - verts[i].x) * (p.y - verts[i].y) - (verts[j].y - verts[i].y) * (p.x - verts[i].x)
    if (Math.abs(cross) < 1e-9) return false
    const s = Math.sign(cross)
    if (sign === 0) sign = s
    else if (s !== sign) return false
  }
  return true
}

function convexOverlap(
  va: Array<{ x: number; y: number }>,
  vb: Array<{ x: number; y: number }>,
  centerA: { x: number; y: number },
  centerB: { x: number; y: number },
): boolean {
  for (let i = 0; i < va.length; i++) {
    const j = (i + 1) % va.length
    for (let k = 0; k < vb.length; k++) {
      const l = (k + 1) % vb.length
      if (segmentsCross(va[i], va[j], vb[k], vb[l])) return true
    }
  }
  for (const v of va) { if (pointInConvexPolygon(v, vb)) return true }
  for (const v of vb) { if (pointInConvexPolygon(v, va)) return true }
  if (pointInConvexPolygon(centerA, vb)) return true
  if (pointInConvexPolygon(centerB, va)) return true
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

/**
 * Check whether two panels share a full edge (not just touch at a vertex).
 * Returns true if any edge of panel A and any edge of panel B are coincident
 * (both endpoints match within tolerance).
 */
export function panelsShareEdge(
  a: { type: PanelType; x: number; y: number; rotation: number },
  b: { type: PanelType; x: number; y: number; rotation: number },
): boolean {
  const va = getWorldVertices(a)
  const vb = getWorldVertices(b)
  const tol = 2

  for (let i = 0; i < va.length; i++) {
    const j = (i + 1) % va.length
    for (let k = 0; k < vb.length; k++) {
      const l = (k + 1) % vb.length
      // Edge (i,j) matches edge (k,l) if endpoints coincide in either order
      const d1 = Math.hypot(va[i].x - vb[k].x, va[i].y - vb[k].y)
      const d2 = Math.hypot(va[j].x - vb[l].x, va[j].y - vb[l].y)
      const d3 = Math.hypot(va[i].x - vb[l].x, va[i].y - vb[l].y)
      const d4 = Math.hypot(va[j].x - vb[k].x, va[j].y - vb[k].y)
      if ((d1 < tol && d2 < tol) || (d3 < tol && d4 < tol)) return true
    }
  }
  return false
}

// ── Layout resolution ──────────────────────────────────────────────

export interface RawPanelSpec {
  type: PanelType
  rotation: number
  color: string
  connectTo?: number
  /** Optional hint: which parent edge to prefer. System auto-selects best edge to avoid overlap. */
  edge?: number
}

export function resolveLayout(rawPanels: RawPanelSpec[]): PlacedPanel[] {
  const ids: string[] = rawPanels.map(() => crypto.randomUUID())
  const result: PlacedPanel[] = []

  for (let i = 0; i < rawPanels.length; i++) {
    const rp = rawPanels[i]
    const id = ids[i]

    if (rp.connectTo === undefined || rp.connectTo >= result.length) {
      const v = getWorldVertices({ type: rp.type, x: 0, y: 0, rotation: rp.rotation })
      result.push({ id, type: rp.type, x: 0, y: 0, rotation: rp.rotation, color: rp.color, snappedTo: null, vertices: v })
      continue
    }

    const parent = result[rp.connectTo]
    const parentGeo = getPanelGeometry(parent.type)

    // Build ordered list of parent edges to try: LLM hint first (if given), then the rest
    const edgeOrder: number[] = []
    if (rp.edge !== undefined && rp.edge >= 0 && rp.edge < parentGeo.edgeCount) {
      edgeOrder.push(rp.edge)
    }
    for (let e = 0; e < parentGeo.edgeCount; e++) {
      if (!edgeOrder.includes(e)) edgeOrder.push(e)
    }

    // Find first non-overlapping placement
    let chosen: { x: number; y: number; parentCp: number; childCp: number } | null = null

    for (const parentEdge of edgeOrder) {
      const placement = alignToEdge(
        { x: parent.x, y: parent.y, rotation: parent.rotation, type: parent.type },
        parentEdge,
        rp.type,
        rp.rotation,
      )
      if (!placement) continue

      const candidate = {
        id,
        type: rp.type,
        x: placement.x,
        y: placement.y,
        rotation: rp.rotation,
      }

      if (!result.some(p => panelsOverlap(p, candidate))) {
        chosen = { x: placement.x, y: placement.y, parentCp: placement.parentCp, childCp: placement.childCp }
        break
      }
    }

    // Fallback: if all edges overlap, use the hint edge (or first edge)
    if (!chosen) {
      const fallback = alignToEdge(
        { x: parent.x, y: parent.y, rotation: parent.rotation, type: parent.type },
        edgeOrder[0],
        rp.type,
        rp.rotation,
      )
      if (fallback) {
        chosen = { x: fallback.x, y: fallback.y, parentCp: fallback.parentCp, childCp: fallback.childCp }
      }
    }

    if (!chosen) {
      const v = getWorldVertices({ type: rp.type, x: 0, y: 0, rotation: rp.rotation })
      result.push({ id, type: rp.type, x: 0, y: 0, rotation: rp.rotation, color: rp.color, snappedTo: null, vertices: v })
      continue
    }

    const snappedVertices = getWorldVertices({ type: rp.type, x: chosen.x, y: chosen.y, rotation: rp.rotation })
    result.push({
      id,
      type: rp.type,
      x: chosen.x,
      y: chosen.y,
      rotation: rp.rotation,
      color: rp.color,
      snappedTo: { panelId: parent.id, connectionIndex: chosen.parentCp },
      vertices: snappedVertices,
    })
  }

  return result
}
