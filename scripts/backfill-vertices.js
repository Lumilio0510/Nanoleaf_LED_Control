/**
 * One-time migration: add world-space vertex coordinates to all existing design files.
 * Run with: node scripts/backfill-vertices.js
 */
const { readFileSync, writeFileSync, readdirSync, existsSync } = require('fs')
const { join, resolve } = require('path')

const DEG = d => (d * Math.PI) / 180

function getLocalVertices(type) {
  if (type === 'hexagon') {
    const s = 67
    return Array.from({ length: 6 }, (_, i) => ({
      x: s * Math.cos(DEG(60 * i)),
      y: s * Math.sin(DEG(60 * i)),
    }))
  }
  const side = type === 'triangle' ? 134 : 67
  const R = side / Math.sqrt(3)
  return [
    { x: 0, y: -R },
    { x: R * Math.cos(DEG(30)), y: R * Math.sin(DEG(30)) },
    { x: -R * Math.cos(DEG(30)), y: R * Math.sin(DEG(30)) },
  ]
}

function getWorldVertices(panel) {
  const a = DEG(panel.rotation)
  const c = Math.cos(a)
  const s = Math.sin(a)
  const local = getLocalVertices(panel.type)
  return local.map(v => ({
    x: Math.round((panel.x + v.x * c - v.y * s) * 100) / 100,
    y: Math.round((panel.y + v.x * s + v.y * c) * 100) / 100,
  }))
}

const designsDir = resolve(process.cwd(), 'designs')
if (!existsSync(designsDir)) {
  console.error('designs directory not found at', designsDir)
  process.exit(1)
}

const files = readdirSync(designsDir).filter(f => f.endsWith('.json'))
let updated = 0

for (const file of files) {
  const fp = join(designsDir, file)
  const design = JSON.parse(readFileSync(fp, 'utf-8'))

  if (!design.panels || !Array.isArray(design.panels)) continue

  let changed = false
  design.panels = design.panels.map(p => {
    const vertices = getWorldVertices(p)
    // Check if already has correct vertices
    if (p.vertices && p.vertices.length > 0) {
      const match = p.vertices.length === vertices.length &&
        p.vertices.every((v, i) => Math.abs(v.x - vertices[i].x) < 0.01 && Math.abs(v.y - vertices[i].y) < 0.01)
      if (match) return p
    }
    changed = true
    return { ...p, vertices }
  })

  if (changed) {
    writeFileSync(fp, JSON.stringify(design, null, 2), 'utf-8')
    updated++
    console.log(`  Updated: ${file} (${design.name})`)
  }
}

console.log(`\nDone. ${updated} / ${files.length} design files updated.`)
