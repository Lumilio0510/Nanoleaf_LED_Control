import { useState } from 'react'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Collapse from '@mui/material/Collapse'
import Divider from '@mui/material/Divider'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import CodeIcon from '@mui/icons-material/Code'
import PaletteIcon from '@mui/icons-material/Palette'
import { api } from '../api'

interface EffectDef {
  command?: string
  animName?: string
  animType?: string
  colorType?: string
  version?: string
  palette?: Array<{ hue: number; saturation: number; brightness: number }>
  pluginUuid?: string
  pluginType?: string
  pluginOptions?: Array<{ name: string; value: number | string | boolean }>
  loop?: boolean
  transTime?: number
  linDirection?: string
  [key: string]: unknown
}

function hsbToHex(h: number, s: number, br: number): string {
  const sn = s / 100
  const bn = br / 100
  const c = bn * sn
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = bn - c

  let rn = 0, gn = 0, bn2 = 0
  if (h < 60) { rn = c; gn = x }
  else if (h < 120) { rn = x; gn = c }
  else if (h < 180) { rn = 0; gn = c; bn2 = x }
  else if (h < 240) { rn = 0; gn = x; bn2 = c }
  else if (h < 300) { rn = x; gn = 0; bn2 = c }
  else { rn = c; gn = 0; bn2 = x }

  const r = Math.round((rn + m) * 255)
  const g = Math.round((gn + m) * 255)
  const b = Math.round((bn2 + m) * 255)
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
}

const PLUGIN_NAMES: Record<string, string> = {
  '027842e4-e1d6-4a4c-a731-be74a1ebd4cf': 'Flow 流动渐变',
  '6970681a-20b5-4c5e-8813-bdaebc4ee4fa': 'Wheel 旋转渐变',
  '713518c1-d560-47db-8991-de780af71d1e': 'Explode 爆炸扩散',
  'b3fd723a-aae8-4c99-bf2b-087159e0ef53': 'Fade 同步渐变',
  'ba632d3e-9c2b-4413-a965-510c839b3f71': 'Random 随机变化',
  '70b7c636-6bf8-491f-89c1-f4103508d642': 'Highlight 高亮',
}

function pluginName(uuid: string): string {
  return PLUGIN_NAMES[uuid] || uuid
}

export default function EffectCard({ effectDef, onApplied }: {
  effectDef: EffectDef
  onApplied?: () => void
}) {
  const [applying, setApplying] = useState(false)
  const [applied, setApplied] = useState(false)
  const [showApi, setShowApi] = useState(false)

  const palette = effectDef.palette || []
  const pluginOpts = effectDef.pluginOptions || []

  async function handleApply() {
    setApplying(true)
    try {
      await api.writeEffect(effectDef as Record<string, unknown>)
      setApplied(true)
      onApplied?.()
    } catch (e) {
      console.error('应用灯效失败:', e)
    } finally {
      setApplying(false)
    }
  }

  const apiRequestBody = {
    write: {
      command: effectDef.command || 'add',
      animName: effectDef.animName,
      animType: effectDef.animType,
      colorType: effectDef.colorType || 'HSB',
      version: effectDef.version || '2.0',
      ...Object.fromEntries(
        Object.entries(effectDef).filter(([k]) =>
          !['command', 'animName', 'animType', 'colorType', 'version'].includes(k)
        )
      )
    }
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        mt: 1,
        mb: 0.5,
        overflow: 'hidden',
        borderColor: applied ? 'success.main' : 'primary.main',
        borderWidth: applied ? 1 : 1,
        bgcolor: 'background.paper',
      }}
    >
      {/* Header */}
      <Box sx={{ px: 2, py: 1.5, bgcolor: 'rgba(16,185,129,0.06)' }}>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
            <PaletteIcon sx={{ fontSize: 18, color: 'primary.main' }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              {effectDef.animName || '未命名灯效'}
            </Typography>
            {effectDef.animType && (
              <Chip
                size="small"
                label={effectDef.animType === 'plugin' ? '动态特效' : effectDef.animType === 'solid' ? '纯色' : effectDef.animType}
                color="primary"
                variant="outlined"
                sx={{ fontSize: '0.6rem', height: 18 }}
              />
            )}
          </Stack>
          <Button
            variant="contained"
            size="small"
            onClick={handleApply}
            disabled={applying || applied}
            startIcon={applied ? undefined : <PlayArrowIcon sx={{ fontSize: 16 }} />}
            sx={{
              fontSize: '0.75rem',
              px: 2,
              py: 0.5,
              minWidth: 'auto',
              bgcolor: applied ? 'success.main' : 'primary.main',
              '&:hover': { bgcolor: applied ? 'success.dark' : 'primary.dark' },
            }}
          >
            {applying ? '应用中...' : applied ? '已应用' : '应用此灯效'}
          </Button>
        </Stack>
      </Box>

      <Box sx={{ px: 2, py: 1.5 }}>
        {/* Plugin info */}
        {effectDef.animType === 'plugin' && effectDef.pluginUuid && (
          <Stack spacing={1}>
            <Typography variant="caption" color="text.secondary">
              插件类型：{pluginName(effectDef.pluginUuid)}
            </Typography>

            {/* Plugin options */}
            {pluginOpts.length > 0 && (
              <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                {pluginOpts.map(opt => (
                  <Chip
                    key={opt.name}
                    size="small"
                    label={`${opt.name}: ${opt.value}`}
                    variant="outlined"
                    sx={{ fontSize: '0.6rem', height: 20, fontFamily: 'monospace' }}
                  />
                ))}
              </Stack>
            )}
          </Stack>
        )}

        {/* Color palette */}
        {palette.length > 0 && (
          <Box sx={{ mt: 1.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.75, display: 'block' }}>
              色彩方案（{palette.length} 色）
            </Typography>
            <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
              {palette.map((c, i) => {
                const hex = hsbToHex(c.hue, c.saturation, c.brightness)
                return (
                  <Stack key={i} sx={{ alignItems: 'center' }}>
                    <Box
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: 2,
                        bgcolor: hex,
                        border: '2px solid',
                        borderColor: 'divider',
                        boxShadow: `0 0 8px ${hex}40`,
                        transition: 'transform 0.15s',
                        '&:hover': { transform: 'scale(1.15)' },
                      }}
                    />
                    <Typography variant="caption" sx={{ fontSize: '0.55rem', mt: 0.25, fontFamily: 'monospace', color: 'text.disabled' }}>
                      H:{c.hue}
                    </Typography>
                  </Stack>
                )
              })}
            </Stack>
          </Box>
        )}

        {/* Effect description */}
        {effectDef.animType === 'plugin' && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', lineHeight: 1.5 }}>
            {buildDescription(effectDef)}
          </Typography>
        )}

        <Divider sx={{ my: 1.5 }} />

        {/* API request toggle */}
        <Button
          size="small"
          variant="text"
          onClick={() => setShowApi(!showApi)}
          startIcon={<CodeIcon sx={{ fontSize: 14 }} />}
          sx={{ fontSize: '0.7rem', color: 'text.secondary', minWidth: 'auto', py: 0 }}
        >
          {showApi ? '隐藏' : '查看'} API 请求
        </Button>
        <Collapse in={showApi}>
          <Box
            component="pre"
            sx={{
              mt: 1,
              p: 1.5,
              fontSize: '0.65rem',
              fontFamily: 'monospace',
              bgcolor: 'grey.900',
              color: 'grey.200',
              borderRadius: 2,
              overflow: 'auto',
              maxHeight: 240,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}
          >
            PUT /api/v1/{'{auth_token}'}/effects
            {'\n'}
            {JSON.stringify(apiRequestBody, null, 2)}
          </Box>
        </Collapse>
      </Box>
    </Paper>
  )
}

function buildDescription(def: EffectDef): string {
  const parts: string[] = []
  const plugin = def.pluginUuid ? pluginName(def.pluginUuid) : ''
  const transTime = def.transTime ?? def.pluginOptions?.find(o => o.name === 'transTime')?.value
  const loop = def.loop ?? def.pluginOptions?.find(o => o.name === 'loop')?.value
  const dir = def.linDirection ?? def.pluginOptions?.find(o => o.name === 'linDirection')?.value

  if (plugin) parts.push(`使用 ${plugin} 插件`)
  if (transTime !== undefined) parts.push(`过渡时间 ${transTime} (0.1秒/单位)`)
  if (loop) parts.push('循环播放')
  if (dir) parts.push(`方向: ${dir}`)
  if (def.palette && def.palette.length > 0) {
    parts.push(`${def.palette.length} 色调色板`)
  }

  return parts.join(' · ')
}
