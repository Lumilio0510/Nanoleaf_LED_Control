import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import ToggleButton from '@mui/material/ToggleButton'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import DeleteIcon from '@mui/icons-material/Delete'
import UndoIcon from '@mui/icons-material/Undo'
import ImageIcon from '@mui/icons-material/Image'
import NearMeIcon from '@mui/icons-material/NearMe'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'

type ToolMode = 'select' | 'hexagon' | 'triangle' | 'mini-triangle'

interface Props {
  toolMode: ToolMode
  onToolChange: (m: ToolMode) => void
  onDelete: () => void
  onUndo: () => void
  onExport: () => void
  onGenerateAI: () => void
}

export default function CanvasToolbar({ toolMode, onToolChange, onDelete, onUndo, onExport, onGenerateAI }: Props) {
  return (
    <Paper elevation={1} sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1, borderBottom: 1, borderColor: 'divider' }}>
      <ToggleButtonGroup value={toolMode} exclusive onChange={(_, v) => v && onToolChange(v)} size="small">
        <ToggleButton value="select"><NearMeIcon fontSize="small" /></ToggleButton>
        <ToggleButton value="hexagon">⬡</ToggleButton>
        <ToggleButton value="triangle">△</ToggleButton>
        <ToggleButton value="mini-triangle">▽</ToggleButton>
      </ToggleButtonGroup>
      <Tooltip title="删除选中 (Delete)"><IconButton size="small" onClick={onDelete}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
      <Tooltip title="撤销 (Ctrl+Z)"><IconButton size="small" onClick={onUndo}><UndoIcon fontSize="small" /></IconButton></Tooltip>
      <Tooltip title="导出图片"><IconButton size="small" onClick={onExport}><ImageIcon fontSize="small" /></IconButton></Tooltip>
      <Box sx={{ flex: 1 }} />
      <Tooltip title="创造性 AI">
        <Button size="small" variant="outlined" startIcon={<AutoAwesomeIcon fontSize="small" />} onClick={onGenerateAI}>
          创造性 AI
        </Button>
      </Tooltip>
    </Paper>
  )
}
