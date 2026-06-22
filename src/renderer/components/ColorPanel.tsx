import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import ColorizeIcon from '@mui/icons-material/Colorize'
import CloseIcon from '@mui/icons-material/Close'

const PRESETS = [
  '#ff0000', '#ff6b00', '#ffd000', '#00ff00', '#00ffff',
  '#0066ff', '#6600ff', '#ff00ff', '#ffffff', '#cccccc',
  '#888888', '#444444', '#ff9999', '#99ff99', '#9999ff',
  '#ffff99', '#ffcc99', '#99ffff', '#ff99ff', '#000000',
]

interface Props {
  selectedCount: number
  currentColor: string
  onColorChange: (color: string) => void
  onPickFromPanel: () => void
  onCancelPick: () => void
  pickingFromPanel: boolean
  visible: boolean
}

function normalizeHex(value: string): string | null {
  const trimmed = value.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toLowerCase()
  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) return `#${trimmed.toLowerCase()}`
  return null
}

export default function ColorPanel({
  selectedCount,
  currentColor,
  onColorChange,
  onPickFromPanel,
  onCancelPick,
  pickingFromPanel,
  visible,
}: Props) {
  const [hex, setHex] = useState(currentColor)

  useEffect(() => {
    setHex(currentColor)
  }, [currentColor])

  if (!visible) return null

  const applyHex = (value: string) => {
    const normalized = normalizeHex(value)
    if (!normalized) return
    setHex(normalized)
    onColorChange(normalized)
  }

  return (
    <Paper elevation={2} sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, p: 2, display: 'flex', alignItems: 'center', gap: 1.5, borderTop: 1, borderColor: 'divider' }}>
      <Typography variant="body2" sx={{ minWidth: 96 }}>Selected {selectedCount}</Typography>
      <Box sx={{ width: 36, height: 36, bgcolor: currentColor, borderRadius: 1, border: 1, borderColor: 'divider', flexShrink: 0 }} />
      <Box
        component="input"
        type="color"
        value={normalizeHex(hex) ?? currentColor}
        onChange={e => applyHex(e.target.value)}
        sx={{ width: 38, height: 32, p: 0, border: 0, bgcolor: 'transparent', cursor: 'pointer' }}
      />
      <TextField
        size="small"
        value={hex}
        onChange={e => {
          setHex(e.target.value)
          const normalized = normalizeHex(e.target.value)
          if (normalized) onColorChange(normalized)
        }}
        onBlur={() => applyHex(hex)}
        onKeyDown={e => {
          e.stopPropagation()
          if (e.key === 'Enter') applyHex(hex)
          if (e.key === 'Escape') setHex(currentColor)
        }}
        error={Boolean(hex) && !normalizeHex(hex)}
        sx={{ width: 110 }}
        placeholder="#ff0000"
      />
      <Tooltip title={pickingFromPanel ? 'Cancel pick' : 'Pick color from panel'}>
        <IconButton
          size="small"
          color={pickingFromPanel ? 'primary' : 'default'}
          onClick={pickingFromPanel ? onCancelPick : onPickFromPanel}
        >
          {pickingFromPanel ? <CloseIcon fontSize="small" /> : <ColorizeIcon fontSize="small" />}
        </IconButton>
      </Tooltip>
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
        {PRESETS.map(c => (
          <Box
            key={c}
            onClick={() => applyHex(c)}
            sx={{
              width: 24,
              height: 24,
              bgcolor: c,
              borderRadius: 0.5,
              border: c === currentColor ? 2 : 1,
              borderColor: c === currentColor ? 'primary.main' : 'divider',
              cursor: 'pointer',
              '&:hover': { transform: 'scale(1.2)' },
            }}
          />
        ))}
      </Box>
    </Paper>
  )
}
