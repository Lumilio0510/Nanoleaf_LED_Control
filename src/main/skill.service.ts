import { Skill } from '../shared/types'
import { ensureDir, listDir, deleteFile } from './storage'
import { join } from 'path'
import electron from 'electron'
const { app } = electron
import { readFileSync, writeFileSync, existsSync } from 'fs'

const SKILLS_DIR = 'skills'

export function getSkills(): Skill[] {
  const files = listDir(SKILLS_DIR)
  const dir = ensureDir(SKILLS_DIR)
  return files
    .map(f => {
      try {
        return JSON.parse(readFileSync(join(dir, f), 'utf-8')) as Skill
      } catch { return null }
    })
    .filter((s): s is Skill => s !== null)
}

export function getSkill(id: string): Skill | null {
  const skills = getSkills()
  return skills.find(s => s.meta.id === id) || null
}

export function saveSkill(skill: Skill): void {
  ensureDir(SKILLS_DIR)
  const filepath = join(app.getPath('userData'), 'data', SKILLS_DIR, `${skill.meta.id}.json`)
  writeFileSync(filepath, JSON.stringify(skill, null, 2), 'utf-8')
}

export function deleteSkill(id: string): void {
  deleteFile(`${SKILLS_DIR}/${id}.json`)
}

export function exportSkill(id: string): Skill | null {
  return getSkill(id)
}
