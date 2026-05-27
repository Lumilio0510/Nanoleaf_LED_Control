import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs'
import { join, resolve } from 'path'
import { v4 as uuid } from 'uuid'
import type { CanvasDesign, CanvasDesignMeta } from '../shared/canvas-types'

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
  return JSON.parse(readFileSync(fp, 'utf-8'))
}

export function saveDesign(design: CanvasDesign): CanvasDesignMeta {
  design.updatedAt = new Date().toISOString()
  writeFileSync(join(getDesignsDir(), `${design.id}.json`), JSON.stringify(design, null, 2), 'utf-8')
  return { id: design.id, name: design.name, updatedAt: design.updatedAt }
}

export function deleteDesign(id: string): void {
  const fp = join(getDesignsDir(), `${id}.json`)
  if (existsSync(fp)) unlinkSync(fp)
}

export function createDesign(name: string): CanvasDesign {
  return { id: uuid(), name, panels: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
}
