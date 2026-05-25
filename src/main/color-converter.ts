import type { ColorHSB } from '../shared/types'

export function rgbToHsb(r: number, g: number, b: number): ColorHSB {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const delta = max - min

  let h = 0
  if (delta !== 0) {
    if (max === rn) h = 60 * (((gn - bn) / delta) % 6)
    else if (max === gn) h = 60 * ((bn - rn) / delta + 2)
    else h = 60 * ((rn - gn) / delta + 4)
  }
  if (h < 0) h += 360

  const s = max === 0 ? 0 : (delta / max) * 100
  const br = max * 100

  return { h: Math.round(h), s: Math.round(s), b: Math.round(br) }
}

export function hsbToRgb(h: number, s: number, br: number): { r: number; g: number; b: number } {
  const sn = s / 100
  const bn = br / 100
  const c = bn * sn
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = bn - c

  let rn = 0, gn = 0, bn2 = 0
  if (h < 60) { rn = c; gn = x; bn2 = 0 }
  else if (h < 120) { rn = x; gn = c; bn2 = 0 }
  else if (h < 180) { rn = 0; gn = c; bn2 = x }
  else if (h < 240) { rn = 0; gn = x; bn2 = c }
  else if (h < 300) { rn = x; gn = 0; bn2 = c }
  else { rn = c; gn = 0; bn2 = x }

  return {
    r: Math.round((rn + m) * 255),
    g: Math.round((gn + m) * 255),
    b: Math.round((bn2 + m) * 255)
  }
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16)
  }
}

export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
}
