import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs'
import { join } from 'path'

function getDataDir(): string {
  const dir = join(app.getPath('userData'), 'data')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

export function readJSON<T>(filename: string, fallback: T): T {
  const filepath = join(getDataDir(), filename)
  try {
    if (!existsSync(filepath)) return fallback
    return JSON.parse(readFileSync(filepath, 'utf-8')) as T
  } catch {
    return fallback
  }
}

export function writeJSON<T>(filename: string, data: T): void {
  const filepath = join(getDataDir(), filename)
  writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8')
}

export function fileExists(filename: string): boolean {
  return existsSync(join(getDataDir(), filename))
}

export function ensureDir(dirname: string): string {
  const dir = join(getDataDir(), dirname)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

export function listDir(dirname: string): string[] {
  const dir = join(getDataDir(), dirname)
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter((f: string) => f.endsWith('.json'))
}

export function deleteFile(filename: string): void {
  const filepath = join(getDataDir(), filename)
  if (existsSync(filepath)) unlinkSync(filepath)
}
