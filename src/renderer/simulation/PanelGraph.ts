import type { PlacedPanel } from '../../shared/canvas-types'
import type { PanelNode } from './types'

export class PanelGraph {
  private _nodes: Map<string, PanelNode> = new Map()

  constructor(panels: PlacedPanel[]) {
    // 1. 创建所有节点
    for (const p of panels) {
      this._nodes.set(p.id, {
        id: p.id,
        type: p.type,
        x: p.x,
        y: p.y,
        rotation: p.rotation,
        neighbors: [],
      })
    }

    // 2. 从 snappedTo 建立边
    for (const p of panels) {
      if (p.snappedTo) {
        this.addEdge(p.id, p.snappedTo.panelId)
      }
    }

    // 3. 对孤立节点按空间最近距离连接
    const components = this.getConnectedComponents()
    if (components.length > 1) {
      for (let ci = 0; ci < components.length - 1; ci++) {
        let bestDist = Infinity
        let bestA = ''
        let bestB = ''
        for (const idA of components[ci]) {
          const nodeA = this._nodes.get(idA)!
          for (const idB of components[ci + 1]) {
            const nodeB = this._nodes.get(idB)!
            const d = Math.hypot(nodeA.x - nodeB.x, nodeA.y - nodeB.y)
            if (d < bestDist) {
              bestDist = d
              bestA = idA
              bestB = idB
            }
          }
        }
        if (bestA && bestB) this.addEdge(bestA, bestB)
      }
    }
  }

  private addEdge(a: string, b: string) {
    const na = this._nodes.get(a)
    const nb = this._nodes.get(b)
    if (!na || !nb) return
    if (!na.neighbors.includes(b)) na.neighbors.push(b)
    if (!nb.neighbors.includes(a)) nb.neighbors.push(a)
  }

  get nodes(): Map<string, PanelNode> {
    return this._nodes
  }

  /** BFS flow path starting from the most connected node */
  getFlowPath(startId?: string): string[] {
    if (this._nodes.size === 0) return []
    const start = startId ?? this.findCenterNode()
    const visited = new Set<string>()
    const queue: string[] = [start]
    const path: string[] = []
    while (queue.length > 0) {
      const id = queue.shift()!
      if (visited.has(id)) continue
      visited.add(id)
      path.push(id)
      const node = this._nodes.get(id)
      if (node) {
        for (const nid of node.neighbors) {
          if (!visited.has(nid)) queue.push(nid)
        }
      }
    }
    return path
  }

  /** Spatial path: sort panels by geometric position matching Nanoleaf's linDirection.
   *  Direction indicates gradient orientation: "right" = gradient left→right (leftmost first). */
  getSpatialPath(direction: string): string[] {
    const entries = Array.from(this._nodes.entries())
    if (entries.length === 0) return []

    const sorted = entries.sort(([, a], [, b]) => {
      switch (direction) {
        case 'left':  return b.x - a.x          // gradient right→left: rightmost first
        case 'right': return a.x - b.x          // gradient left→right: leftmost first
        case 'up':    return b.y - a.y          // gradient bottom→top: bottommost first (Y↓)
        case 'down':  return a.y - b.y          // gradient top→bottom: topmost first (Y↓)
        default:      return a.x - b.x
      }
    })
    return sorted.map(([id]) => id)
  }

  /** Find the node with the most connections */
  private findCenterNode(): string {
    let best = ''
    let max = -1
    for (const [id, node] of this._nodes) {
      if (node.neighbors.length > max) {
        max = node.neighbors.length
        best = id
      }
    }
    return best || (this._nodes.keys().next().value ?? '')
  }

  getConnectedComponents(): string[][] {
    const visited = new Set<string>()
    const components: string[][] = []
    for (const id of this._nodes.keys()) {
      if (visited.has(id)) continue
      const comp: string[] = []
      const stack = [id]
      while (stack.length > 0) {
        const nid = stack.pop()!
        if (visited.has(nid)) continue
        visited.add(nid)
        comp.push(nid)
        const node = this._nodes.get(nid)
        if (node) {
          for (const neighbor of node.neighbors) {
            if (!visited.has(neighbor)) stack.push(neighbor)
          }
        }
      }
      components.push(comp)
    }
    return components
  }

  getDistancesFrom(centerId: string): Map<string, number> {
    const dists = new Map<string, number>()
    for (const id of this._nodes.keys()) dists.set(id, Infinity)
    dists.set(centerId, 0)
    const queue = [centerId]
    while (queue.length > 0) {
      const id = queue.shift()!
      const d = dists.get(id)!
      const node = this._nodes.get(id)
      if (node) {
        for (const nid of node.neighbors) {
          if ((dists.get(nid) ?? Infinity) > d + 1) {
            dists.set(nid, d + 1)
            queue.push(nid)
          }
        }
      }
    }
    return dists
  }
}
