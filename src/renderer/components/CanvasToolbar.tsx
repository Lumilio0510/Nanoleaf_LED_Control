import Paper from '@mui/material/Paper'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import ToggleButton from '@mui/material/ToggleButton'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import DeleteIcon from '@mui/icons-material/Delete'
import UndoIcon from '@mui/icons-material/Undo'
import ImageIcon from '@mui/icons-material/Image'
import NearMeIcon from '@mui/icons-material/NearMe'
import EditIcon from '@mui/icons-material/Edit'
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline'

type ToolMode = 'select' | 'hexagon' | 'triangle' | 'mini-triangle'
type CanvasMode = 'edit' | 'sim'

interface Props {
  toolMode: ToolMode
  onToolChange: (m: ToolMode) => void
  onDelete: () => void
  onUndo: () => void
  onExport: () => void
  canvasMode: CanvasMode
  onCanvasModeChange: (m: CanvasMode) => void
}

export default function CanvasToolbar({
  toolMode, onToolChange, onDelete, onUndo, onExport,
  canvasMode, onCanvasModeChange,
}: Props) {
  return (
    <Paper elevation={1} sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1, borderBottom: 1, borderColor: 'divider' }}>
      <ToggleButtonGroup value={canvasMode} exclusive onChange={(_, v) => v && onCanvasModeChange(v)} size="small">
        <ToggleButton value="edit"><Tooltip title="编辑模式"><EditIcon fontSize="small" /></Tooltip></ToggleButton>
        <ToggleButton value="sim"><Tooltip title="仿真模式"><PlayCircleOutlineIcon fontSize="small" /></Tooltip></ToggleButton>
      </ToggleButtonGroup>

      <Paper elevation={0} sx={{ width: 1, height: 24, bgcolor: 'divider', mx: 0.5 }} />

      {canvasMode === 'edit' && (
        <>
          <ToggleButtonGroup value={toolMode} exclusive onChange={(_, v) => v && onToolChange(v)} size="small">
            <ToggleButton value="select"><NearMeIcon fontSize="small" /></ToggleButton>
            <ToggleButton value="hexagon">⬡</ToggleButton>
            <ToggleButton value="triangle">△</ToggleButton>
            <ToggleButton value="mini-triangle">▽</ToggleButton>
          </ToggleButtonGroup>
          <Tooltip title="删除选中 (Delete)"><IconButton size="small" onClick={onDelete}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="撤销 (Ctrl+Z)"><IconButton size="small" onClick={onUndo}><UndoIcon fontSize="small" /></IconButton></Tooltip>
        </>
      )}
      <Tooltip title="导出图片"><IconButton size="small" onClick={onExport}><ImageIcon fontSize="small" /></IconButton></Tooltip>
    </Paper>
  )
}
