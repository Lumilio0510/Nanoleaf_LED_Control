import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs'
import { join, resolve } from 'path'
import { randomUUID } from 'crypto'
import type { CanvasDesign, CanvasDesignMeta } from '../shared/canvas-types'
import { getWorldVertices } from '../shared/panelGeometry'

function getDesignsDir(): string {
  const dir = resolve(process.cwd(), 'designs')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

export function listDesigns(): CanvasDesignMeta[] {
  const files = readdirSync(getDesignsDir()).filter(f => f.endsWith('.json'))
  return files.map(f => {
    const design: CanvasDesign = JSON.parse(readFileSync(join(getDesignsDir(), f), 'utf-8'))
    return { id: design.id, name: design.name, updatedAt: design.updatedAt }
  }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function loadDesign(id: string): CanvasDesign | null {
  const fp = join(getDesignsDir(), `${id}.json`)
  if (!existsSync(fp)) return null
  const design: CanvasDesign = JSON.parse(readFileSync(fp, 'utf-8'))
  // Ensure all panels have vertices (backward compat with old files)
  design.panels = design.panels.map(p => ({
    ...p,
    vertices: p.vertices && p.vertices.length > 0 ? p.vertices : getWorldVertices(p),
  }))
  // Ensure description exists (backward compat)
  if (!design.description) {
    design.description = design.name
  }
  return design
}

export function saveDesign(design: CanvasDesign): CanvasDesignMeta {
  design.updatedAt = new Date().toISOString()
  // Compute world-space vertices for all panels
  design.panels = design.panels.map(p => ({
    ...p,
    vertices: getWorldVertices(p),
  }))
  writeFileSync(join(getDesignsDir(), `${design.id}.json`), JSON.stringify(design, null, 2), 'utf-8')
  return { id: design.id, name: design.name, updatedAt: design.updatedAt }
}

export function renameDesign(id: string, newName: string): CanvasDesignMeta {
  const design = loadDesign(id)
  if (!design) throw new Error(`Design ${id} not found`)
  design.name = newName
  return saveDesign(design)
}

export function deleteDesign(id: string): void {
  const fp = join(getDesignsDir(), `${id}.json`)
  if (existsSync(fp)) unlinkSync(fp)
}

export function createDesign(name: string): CanvasDesign {
  return { id: randomUUID(), name, description: name, panels: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
}
