import { useState } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'

const PRESETS = [
  '#ff0000','#ff6b00','#ffd000','#00ff00','#00ffff',
  '#0066ff','#6600ff','#ff00ff','#ffffff','#cccccc',
  '#888888','#444444','#ff9999','#99ff99','#9999ff',
  '#ffff99','#ffcc99','#99ffff','#ff99ff','#000000',
]

interface Props {
  selectedCount: number
  currentColor: string
  onColorChange: (color: string) => void
  visible: boolean
}

export default function ColorPanel({ selectedCount, currentColor, onColorChange, visible }: Props) {
  const [hex, setHex] = useState(currentColor)

  if (!visible) return null

  return (
    <Paper elevation={2} sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, p: 2, display: 'flex', alignItems: 'center', gap: 2, borderTop: 1, borderColor: 'divider' }}>
      <Typography variant="body2" sx={{ minWidth: 120 }}>已选中 {selectedCount} 块灯板</Typography>
      <Box sx={{ width: 36, height: 36, bgcolor: currentColor, borderRadius: 1, border: 1, borderColor: 'divider', flexShrink: 0 }} />
      <TextField size="small" value={hex} onChange={e => { setHex(e.target.value); if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) onColorChange(e.target.value) }} sx={{ width: 100 }} placeholder="#ff0000" />
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
        {PRESETS.map(c => (
          <Box key={c} onClick={() => { setHex(c); onColorChange(c) }}
            sx={{ width: 24, height: 24, bgcolor: c, borderRadius: 0.5, border: c === currentColor ? 2 : 1,
              borderColor: c === currentColor ? 'primary.main' : 'divider', cursor: 'pointer', '&:hover': { transform: 'scale(1.2)' } }} />
        ))}
      </Box>
    </Paper>
  )
}
