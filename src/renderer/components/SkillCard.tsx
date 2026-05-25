import { useMemo } from 'react'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Box from '@mui/material/Box'
import ColorBar from './ColorBar'
import type { Skill } from '../types'

interface Props {
  skill: Skill
  onExecute: (skill: Skill) => void
  onEdit: (skill: Skill) => void
  onDelete: (id: string) => void
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!m) return null
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) }
}

function hsbToRgb(h: number, s: number, br: number): { r: number; g: number; b: number } {
  const sn = s / 100
  const bn = br / 100
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
    b: Math.round((bn2 + m) * 255)
  }
}

interface HsbColor { hue: number; saturation: number; brightness: number }

function extractPalette(skill: Skill) {
  // 从 bodyTemplate 提取 HSB palette（agent 生成的 skill）
  const bodyPalette = (skill.mapping?.bodyTemplate as Record<string, unknown>)?.write as Record<string, unknown> | undefined
  const hsbPalette = bodyPalette?.palette as HsbColor[] | undefined
  if (hsbPalette && hsbPalette.length > 0) {
    return hsbPalette.map(c => hsbToRgb(c.hue ?? 0, c.saturation ?? 100, c.brightness ?? 100))
  }
  // 回退: 从 params 提取 hex 颜色（手动创建的 skill）
  return skill.params
    .filter(p => p.type === 'color' && p.default)
    .map(p => hexToRgb(String(p.default)))
    .filter((c): c is { r: number; g: number; b: number } => c !== null)
}

export default function SkillCard({ skill, onExecute, onEdit, onDelete }: Props) {
  const palette = useMemo(() => extractPalette(skill), [skill])

  return (
    <Box
      sx={{
        bgcolor: 'action.hover',
        borderRadius: 3,
        p: 2,
        border: 1,
        borderColor: 'divider',
        '&:hover': { borderColor: 'grey.300' },
        transition: 'border-color 0.15s',
      }}
    >
      <Stack direction="row" sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>{skill.meta.name}</Typography>
          <Typography variant="caption" color="text.disabled" sx={{ mt: 0.25 }}>
            {skill.meta.description || '暂无描述'}
          </Typography>
          {skill.meta.tags.length > 0 && (
            <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', mt: 0.75 }}>
              {skill.meta.tags.map(tag => (
                <Chip key={tag} label={tag} size="small" sx={{ fontSize: '0.65rem', height: 20 }} />
              ))}
            </Stack>
          )}
        </Box>
        <Button
          variant="contained"
          size="small"
          onClick={() => onExecute(skill)}
          sx={{ fontSize: '0.75rem', px: 1.5, py: 0.5, ml: 1, flexShrink: 0 }}
        >
          执行
        </Button>
      </Stack>

      <ColorBar palette={palette} />

      <Stack direction="row" spacing={1} sx={{ mt: palette.length > 0 ? 1 : 1.5 }}>
        <Button
          variant="outlined"
          size="small"
          onClick={() => onEdit(skill)}
          sx={{ fontSize: '0.75rem', px: 1.5, py: 0.5 }}
        >
          编辑
        </Button>
        <Button
          variant="text"
          size="small"
          onClick={() => onDelete(skill.meta.id)}
          sx={{ fontSize: '0.75rem', px: 1.5, py: 0.5, color: 'text.disabled', '&:hover': { color: 'error.main' } }}
        >
          删除
        </Button>
      </Stack>
    </Box>
  )
}
