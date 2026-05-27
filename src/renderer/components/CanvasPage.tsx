import { useEffect, useCallback, useRef } from 'react'
import Box from '@mui/material/Box'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import type Konva from 'konva'
import CanvasToolbar from './CanvasToolbar'
import CanvasStage from './CanvasStage'
import ColorPanel from './ColorPanel'
import { useCanvasDesign } from '../hooks/useCanvasDesign'
import { api } from '../api'

export default function CanvasPage() {
  const stageRef = useRef<Konva.Stage | null>(null)
  const {
    design, designs, toolMode, selectedIds, setToolMode, setSelectedIds,
    refreshDesigns, newDesign, loadDesign, saveDesign, deleteDesign,
    addPanel, movePanelEnd, updatePanelColor, deleteSelected, selectAll, undo,
  } = useCanvasDesign()

  useEffect(() => { refreshDesigns() }, [refreshDesigns])

  // Keyboard shortcuts
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected()
      if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo() }
      if (e.ctrlKey && e.key === 'a') { e.preventDefault(); selectAll() }
      if (e.ctrlKey && e.key === 's') { e.preventDefault(); saveDesign() }
      if (e.key === 'v' || e.key === 'V') setToolMode('select')
      if (e.key === '1') setToolMode('hexagon')
      if (e.key === '2') setToolMode('triangle')
      if (e.key === '3') setToolMode('mini-triangle')
      if (e.key === 'g' || e.key === 'G') {
        const stage = stageRef.current
        if (stage) { stage.scale({ x: 1, y: 1 }); stage.position({ x: 0, y: 0 }); stage.batchDraw() }
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [deleteSelected, undo, selectAll, saveDesign, setToolMode])

  const handleStageClick = useCallback((x: number, y: number) => {
    if (toolMode !== 'select') {
      addPanel(toolMode as 'hexagon' | 'triangle' | 'mini-triangle', x, y)
    }
  }, [toolMode, addPanel])

  const handlePanelClick = useCallback((id: string, shiftKey: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (shiftKey) { next.has(id) ? next.delete(id) : next.add(id) }
      else { next.clear(); next.add(id) }
      return next
    })
  }, [setSelectedIds])

  const handleExport = useCallback(async () => {
    const stage = stageRef.current
    if (!stage) return
    const dataUrl = stage.toDataURL({ pixelRatio: 2, mimeType: 'image/png' })
    await api.exportDesignImage(dataUrl)
  }, [])

  const selectedColor = design && selectedIds.size > 0
    ? design.panels.find(p => selectedIds.has(p.id))?.color ?? '#ffffff'
    : '#ffffff'

  return (
    <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Left: Design list */}
      <Paper square elevation={0} sx={{ width: 200, borderRight: 1, borderColor: 'divider', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1.5 }}>
          <Typography variant="subtitle2" sx={{ flex: 1 }}>方案列表</Typography>
          <IconButton size="small" onClick={newDesign}><AddIcon fontSize="small" /></IconButton>
        </Box>
        <List dense sx={{ flex: 1, overflow: 'auto' }}>
          {designs.map(d => (
            <ListItemButton key={d.id} selected={design?.id === d.id} onClick={() => loadDesign(d.id)} sx={{ gap: 1 }}>
              <ListItemText primary={d.name} primaryTypographyProps={{ variant: 'body2', noWrap: true }} />
              <IconButton size="small" onClick={e => { e.stopPropagation(); deleteDesign(d.id) }}><DeleteIcon fontSize="small" /></IconButton>
            </ListItemButton>
          ))}
        </List>
      </Paper>

      {/* Right: Canvas area */}
      <Box sx={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
        <CanvasToolbar
          toolMode={toolMode}
          onToolChange={setToolMode}
          onDelete={deleteSelected}
          onUndo={undo}
          onExport={handleExport}
        />
        <Box sx={{ flex: 1, position: 'relative' }}>
          <CanvasStage
            design={design}
            toolMode={toolMode}
            selectedIds={selectedIds}
            ghostColor={selectedColor}
            stageRef={stageRef}
            onPanelClick={handlePanelClick}
            onPanelDragStart={() => {}}
            onPanelDragEnd={(id, x, y) => movePanelEnd(id, x, y)}
            onStageClick={handleStageClick}
            onBlankClick={() => setSelectedIds(new Set())}
          />
          <ColorPanel
            selectedCount={selectedIds.size}
            currentColor={selectedColor}
            onColorChange={color => updatePanelColor([...selectedIds], color)}
            visible={selectedIds.size > 0}
          />
        </Box>
      </Box>
    </Box>
  )
}
