/**
 * One-time migration: add description field to all existing design files.
 * Uses the design name as the description.
 * Run with: node scripts/backfill-descriptions.js
 */
const { readFileSync, writeFileSync, readdirSync, existsSync } = require('fs')
const { join, resolve } = require('path')

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

  if (design.description && design.description.length > 0) {
    continue // already has description
  }

  design.description = design.name
  writeFileSync(fp, JSON.stringify(design, null, 2), 'utf-8')
  updated++
  console.log(`  Updated: ${file} → "${design.description}"`)
}

console.log(`\nDone. ${updated} / ${files.length} design files updated with descriptions.`)
