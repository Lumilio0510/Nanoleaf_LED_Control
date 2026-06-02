import type { HsbColor, RgbColor } from './types'

export function hsbToRgb(h: number, s: number, b: number): RgbColor {
  const sn = s / 100
  const bn = b / 100
  const c = bn * sn
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = bn - c
  let rn = 0, gn = 0, bn2 = 0
  if (h < 60) { rn = c; gn = x }
  else if (h < 120) { rn = x; gn = c }
  else if (h < 180) { gn = c; bn2 = x }
  else if (h < 240) { gn = x; bn2 = c }
  else if (h < 300) { rn = x; bn2 = c }
  else { rn = c; bn2 = x }
  return {
    r: Math.round((rn + m) * 255),
    g: Math.round((gn + m) * 255),
    b: Math.round((bn2 + m) * 255),
  }
}

export function rgbToHex(c: RgbColor): string {
  const r = c.r.toString(16).padStart(2, '0')
  const g = c.g.toString(16).padStart(2, '0')
  const b = c.b.toString(16).padStart(2, '0')
  return `#${r}${g}${b}`
}

export function lerpColor(a: RgbColor, b: RgbColor, t: number): RgbColor {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)))
  return {
    r: clamp(a.r + (b.r - a.r) * t),
    g: clamp(a.g + (b.g - a.g) * t),
    b: clamp(a.b + (b.b - a.b) * t),
  }
}

/** Get color from palette by t:0-1, cycling through palette colors */
export function paletteIndex(palette: HsbColor[], t: number): RgbColor {
  if (palette.length === 0) return { r: 0, g: 0, b: 0 }
  if (palette.length === 1) return hsbToRgb(palette[0].hue, palette[0].saturation, palette[0].brightness)
  const total = palette.length
  const idx = ((t % 1) + 1) % 1 * total
  const i0 = Math.floor(idx) % total
  const i1 = (i0 + 1) % total
  const frac = idx - Math.floor(idx)
  const c0 = hsbToRgb(palette[i0].hue, palette[i0].saturation, palette[i0].brightness)
  const c1 = hsbToRgb(palette[i1].hue, palette[i1].saturation, palette[i1].brightness)
  return lerpColor(c0, c1, frac)
}

export function hsbToHex(h: number, s: number, b: number): string {
  return rgbToHex(hsbToRgb(h, s, b))
}
