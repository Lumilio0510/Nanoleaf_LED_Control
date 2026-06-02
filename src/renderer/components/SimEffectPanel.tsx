import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Box from '@mui/material/Box'
import ColorBar from './ColorBar'
import type { Skill } from '../types'

interface Props {
  skills: Skill[]
  activeSkillId: string | null
  onPlay: (skill: Skill) => void
  onStop: () => void
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!m) return null
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) }
}

function hsbToRgb(h: number, s: number, br: number): { r: number; g: number; b: number } {
  const sn = s / 100; const bn = br / 100
  const c = bn * sn; const x = c * (1 - Math.abs(((h / 60) % 2) - 1)); const m = bn - c
  let rn = 0, gn = 0, bn2 = 0
  if (h < 60) { rn = c; gn = x }
  else if (h < 120) { rn = x; gn = c }
  else if (h < 180) { gn = c; bn2 = x }
  else if (h < 240) { gn = x; bn2 = c }
  else if (h < 300) { rn = x; bn2 = c }
  else { rn = c; bn2 = x }
  return { r: Math.round((rn + m) * 255), g: Math.round((gn + m) * 255), b: Math.round((bn2 + m) * 255) }
}

interface HsbColor { hue: number; saturation: number; brightness: number }

function extractPalette(skill: Skill) {
  const bodyPalette = (skill.mapping?.bodyTemplate as Record<string, unknown>)?.write as Record<string, unknown> | undefined
  const hsbPalette = bodyPalette?.palette as HsbColor[] | undefined
  if (hsbPalette && hsbPalette.length > 0) {
    return hsbPalette.map(c => hsbToRgb(c.hue ?? 0, c.saturation ?? 100, c.brightness ?? 100))
  }
  return skill.params
    .filter(p => p.type === 'color' && p.default)
    .map(p => hexToRgb(String(p.default)))
    .filter((c): c is { r: number; g: number; b: number } => c !== null)
}

export default function SimEffectPanel({ skills, activeSkillId, onPlay, onStop }: Props) {
  if (skills.length === 0) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>灯效列表</Typography>
        <Typography variant="caption" color="text.disabled">暂无可用灯效</Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 1.5 }}>灯效列表</Typography>
      <Stack spacing={1.5}>
        {skills.map(skill => {
          const isActive = skill.meta.id === activeSkillId
          const palette = extractPalette(skill)
          return (
            <Box
              key={skill.meta.id}
              sx={{
                bgcolor: 'action.hover',
                borderRadius: 2,
                p: 1.5,
                border: 1,
                borderColor: isActive ? '#10B981' : 'divider',
                transition: 'border-color 0.15s',
              }}
            >
              <Stack direction="row" sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {skill.meta.name}
                    {isActive && (
                      <Chip label="播放中" size="small" sx={{ ml: 0.5, fontSize: '0.6rem', height: 18, bgcolor: '#10B98122', color: '#10B981' }} />
                    )}
                  </Typography>
                  <Typography variant="caption" color="text.disabled" sx={{ mt: 0.25, display: 'block' }}>
                    {skill.meta.description || '暂无描述'}
                  </Typography>
                  {skill.meta.tags.length > 0 && (
                    <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', mt: 0.5 }}>
                      {skill.meta.tags.map(tag => (
                        <Chip key={tag} label={tag} size="small" sx={{ fontSize: '0.6rem', height: 18 }} />
                      ))}
                    </Stack>
                  )}
                </Box>
                <Button
                  variant={isActive ? 'outlined' : 'contained'}
                  size="small"
                  color={isActive ? 'error' : 'primary'}
                  onClick={() => isActive ? onStop() : onPlay(skill)}
                  sx={{ fontSize: '0.7rem', px: 1, py: 0.3, ml: 1, flexShrink: 0, minWidth: 44 }}
                >
                  {isActive ? '停止' : '播放'}
                </Button>
              </Stack>

              <ColorBar palette={palette} />

              <Typography variant="caption" sx={{ mt: 0.5, display: 'block', color: 'text.disabled', fontFamily: 'monospace', fontSize: '0.6rem' }}>
                {skill.mapping?.endpoint ?? 'PUT /effects'} · {palette.length} 颜色
              </Typography>
            </Box>
          )
        })}
      </Stack>
    </Box>
  )
}
