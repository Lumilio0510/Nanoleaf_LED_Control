import type { HsbColor, RgbColor } from './types'

export function hsbToRgb(h: number, s: number, b: number): RgbColor {
  const hNormalized = ((h % 360) + 360) % 360
  const sn = s / 100
  const bn = b / 100
  const c = bn * sn
  const x = c * (1 - Math.abs(((hNormalized / 60) % 2) - 1))
  const m = bn - c
  let rn = 0, gn = 0, bn2 = 0
  if (hNormalized < 60) { rn = c; gn = x }
  else if (hNormalized < 120) { rn = x; gn = c }
  else if (hNormalized < 180) { gn = c; bn2 = x }
  else if (hNormalized < 240) { gn = x; bn2 = c }
  else if (hNormalized < 300) { rn = x; bn2 = c }
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

/**
 * Interpolate between two HSB colors.
 *
 * For complementary pairs (hue diff near 180°), neither direction around the hue
 * circle produces natural intermediates — going through green (120°) looks wrong
 * for warm→cool transitions, and going through red (0°) also looks wrong because
 * real Nanoleaf hardware interpolates in device RGBW space, yielding purplish
 * midpoints (e.g. Yellow→Lavender→Purple→Blue).
 *
 * To approximate this, we route complementary transitions through a purple
 * midpoint (~280°) and dip saturation by ~35% at the midpoint, which masks the
 * warm-color segment (orange/pink in the first half) and produces a lavender
 * intermediate that much better matches physical panel behavior.
 */
export function lerpHsb(a: HsbColor, b: HsbColor, t: number): HsbColor {
  let hueDiff = b.hue - a.hue
  if (hueDiff > 180) hueDiff -= 360
  else if (hueDiff < -180) hueDiff += 360

  let hue: number
  let sat: number

  if (Math.abs(hueDiff) > 150) {
    // Two-segment path through purple (280°), with saturation dip at midpoint
    const midHue = 280
    if (t <= 0.5) {
      const lt = t * 2
      let segDiff = midHue - a.hue
      if (segDiff > 180) segDiff -= 360
      else if (segDiff < -180) segDiff += 360
      hue = ((a.hue + segDiff * lt) % 360 + 360) % 360
    } else {
      const lt = (t - 0.5) * 2
      let segDiff = b.hue - midHue
      if (segDiff > 180) segDiff -= 360
      else if (segDiff < -180) segDiff += 360
      hue = ((midHue + segDiff * lt) % 360 + 360) % 360
    }
    const satDip = Math.sin(Math.PI * t) * 0.35
    sat = a.saturation + (b.saturation - a.saturation) * t - satDip * 100
    sat = Math.max(0, Math.min(100, sat))
  } else {
    hue = ((a.hue + hueDiff * t) % 360 + 360) % 360
    sat = a.saturation + (b.saturation - a.saturation) * t
  }

  return {
    hue,
    saturation: sat,
    brightness: a.brightness + (b.brightness - a.brightness) * t,
  }
}

/** Get color from palette by t:0-1, interpolating in HSB space for accurate color transitions */
export function paletteIndex(palette: HsbColor[], t: number): RgbColor {
  if (palette.length === 0) return { r: 0, g: 0, b: 0 }
  if (palette.length === 1) return hsbToRgb(palette[0].hue, palette[0].saturation, palette[0].brightness)
  const total = palette.length
  const idx = (t - Math.floor(t)) * total
  const i0 = Math.floor(idx) % total
  const i1 = (i0 + 1) % total
  const frac = idx - Math.floor(idx)
  const c = lerpHsb(palette[i0], palette[i1], frac)
  return hsbToRgb(c.hue, c.saturation, c.brightness)
}

export function hsbToHex(h: number, s: number, b: number): string {
  return rgbToHex(hsbToRgb(h, s, b))
}

/**
 * Upsample a palette by inserting interpolated intermediate colors between each adjacent pair.
 * The palette is treated as circular (last→first segment included).
 * @param subSteps — number of intermediate colors per segment (0 or 1 = no-op)
 */
export function upsamplePalette(palette: HsbColor[], subSteps: number): HsbColor[] {
  if (subSteps <= 0 || palette.length <= 1) return [...palette]

  const result: HsbColor[] = []
  const N = palette.length

  for (let i = 0; i < N; i++) {
    const a = palette[i]
    const b = palette[(i + 1) % N]
    result.push({ ...a })
    for (let j = 1; j <= subSteps; j++) {
      const t = j / (subSteps + 1)
      result.push(lerpHsb(a, b, t))
    }
  }

  return result
}
