import { useEffect, useCallback, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import TextField from '@mui/material/TextField'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import type Konva from 'konva'
import CanvasToolbar from './CanvasToolbar'
import CanvasStage from './CanvasStage'
import ColorPanel from './ColorPanel'
import { useCanvasDesign } from '../hooks/useCanvasDesign'
import { findSnapCandidates } from '../utils/panelGeometry'
import type { CanvasDesign, SnappedTo } from '../../shared/canvas-types'
import { api } from '../api'
import SimEffectPanel from './SimEffectPanel'
import CanvasAIDialog from './CanvasAIDialog'
import { useSkills } from '../hooks/useSkills'
import { SimulationEngine } from '../simulation/SimulationEngine'
import { rgbToHex } from '../simulation/color-utils'
import type { RgbColor } from '../simulation/types'
import type { Skill } from '../types'

const SNAP_THRESHOLD = 20

export default function CanvasPage() {
  const stageRef = useRef<Konva.Stage | null>(null)
  const dragOrigins = useRef<Map<string, { x: number; y: number }>>(new Map())
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const {
    design, designs, toolMode, selectedIds, setToolMode, setSelectedIds,
    refreshDesigns, newDesign, loadDesign, saveDesign, deleteDesign, renameDesign,
    addPanel, movePanelEnd, batchUpdatePanels, updatePanelColor, deleteSelected, duplicateSelected, rotatePanel, selectAll, undo,
  } = useCanvasDesign()
  const [canvasMode, setCanvasMode] = useState<'edit' | 'sim'>('edit')
  const [aiDialogOpen, setAiDialogOpen] = useState(false)
  const [activeSkillId, setActiveSkillId] = useState<string | null>(null)
  const [panelColors, setPanelColors] = useState<Map<string, string>>(new Map())
  const [pickingColorFromPanel, setPickingColorFromPanel] = useState(false)
  const engineRef = useRef<SimulationEngine | null>(null)
  const { skills } = useSkills()

  useEffect(() => { refreshDesigns() }, [refreshDesigns])
  useEffect(() => {
    if (selectedIds.size === 0) setPickingColorFromPanel(false)
  }, [selectedIds])

  // Cleanup engine on unmount
  useEffect(() => { return () => { engineRef.current?.stop() } }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected()
      if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo() }
      if (e.ctrlKey && e.key === 'a') { e.preventDefault(); selectAll() }
      if (e.ctrlKey && e.key === 's') { e.preventDefault(); saveDesign() }
      if (e.ctrlKey && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicateSelected() }
      if (e.key === 'Tab') { e.preventDefault(); setCanvasMode(m => m === 'edit' ? 'sim' : 'edit') }
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
  }, [deleteSelected, duplicateSelected, undo, selectAll, saveDesign, setToolMode])

  const handleStageClick = useCallback((x: number, y: number) => {
    if (toolMode !== 'select') {
      addPanel(toolMode as 'hexagon' | 'triangle' | 'mini-triangle', x, y)
      setToolMode('select')
    }
  }, [toolMode, addPanel, setToolMode])

  const handlePanelClick = useCallback((id: string, shiftKey: boolean) => {
    if (pickingColorFromPanel) {
      if (!design || selectedIds.size === 0) return
      const source = design.panels.find(p => p.id === id)
      if (!source) return
      updatePanelColor([...selectedIds], source.color)
      setPickingColorFromPanel(false)
      return
    }

    setSelectedIds(prev => {
      const next = new Set(prev)
      if (shiftKey) { next.has(id) ? next.delete(id) : next.add(id) }
      else { next.clear(); next.add(id) }
      return next
    })
  }, [design, pickingColorFromPanel, selectedIds, setSelectedIds, updatePanelColor])

  const handleExport = useCallback(async () => {
    const stage = stageRef.current
    if (!stage) return
    const dataUrl = stage.toDataURL({ pixelRatio: 2, mimeType: 'image/png' })
    await api.exportDesignImage(dataUrl)
  }, [])

  const handleCanvasModeChange = useCallback((m: 'edit' | 'sim') => {
    if (m === 'edit') {
      engineRef.current?.stop()
      setPanelColors(new Map())
      setActiveSkillId(null)
    }
    setCanvasMode(m)
  }, [])

  const handleSimPlay = useCallback((skill: Skill) => {
    if (!design) return
    engineRef.current?.stop()
    const engine = new SimulationEngine()
    engineRef.current = engine
    setActiveSkillId(skill.meta.id)
    const bodyTemplate = skill.mapping?.bodyTemplate ?? {}
    engine.start(bodyTemplate, design.panels, (colors: Map<string, RgbColor>) => {
      const hexMap = new Map<string, string>()
      colors.forEach((rgb, id) => { hexMap.set(id, rgbToHex(rgb)) })
      setPanelColors(hexMap)
    })
  }, [design])

  const handleAIGenerated = useCallback(async (design: CanvasDesign) => {
    await api.saveDesign(design)
    await refreshDesigns()
    loadDesign(design.id)
  }, [refreshDesigns, loadDesign])

  const handleSimStop = useCallback(() => {
    engineRef.current?.stop()
    engineRef.current = null
    setActiveSkillId(null)
    setPanelColors(new Map())
  }, [])

  const handlePanelRotate = useCallback((id: string) => {
    rotatePanel(id, 30)
  }, [rotatePanel])

  const startRename = useCallback((d: { id: string; name: string }) => {
    setRenamingId(d.id)
    setEditName(d.name)
  }, [])

  const confirmRename = useCallback(() => {
    if (!renamingId) return
    const trimmed = editName.trim()
    const id = renamingId
    setRenamingId(null)
    setEditName('')
    if (trimmed) renameDesign(id, trimmed)
  }, [renamingId, editName, renameDesign])

  const cancelRename = useCallback(() => {
    setRenamingId(null)
    setEditName('')
  }, [])

  const selectedColor = design && selectedIds.size > 0
    ? design.panels.find(p => selectedIds.has(p.id))?.color ?? '#cccccc'
    : '#cccccc'

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
              {renamingId === d.id ? (
                <TextField
                  variant="standard"
                  size="small"
                  value={editName}
                  autoFocus
                  fullWidth
                  sx={{ my: -0.5 }}
                  onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); confirmRename() } else if (e.key === 'Escape') cancelRename() }}
                  onChange={e => setEditName(e.target.value)}
                  onBlur={confirmRename}
                  onClick={e => e.stopPropagation()}
                />
              ) : (
                <ListItemText
                  primary={d.name}
                  slotProps={{ primary: { variant: 'body2', noWrap: true } }}
                  onDoubleClick={e => { e.stopPropagation(); startRename(d) }}
                  sx={{ cursor: 'text' }}
                />
              )}
              <IconButton size="small" onClick={e => { e.stopPropagation(); deleteDesign(d.id) }}><DeleteIcon fontSize="small" /></IconButton>
            </ListItemButton>
          ))}
        </List>
      </Paper>

      {/* Right: Canvas area */}
      <Box sx={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <CanvasToolbar
          toolMode={toolMode}
          onToolChange={setToolMode}
          onDelete={deleteSelected}
          onDuplicate={duplicateSelected}
          onUndo={undo}
          onExport={handleExport}
          onAIGenerate={() => setAiDialogOpen(true)}
          canvasMode={canvasMode}
          onCanvasModeChange={handleCanvasModeChange}
        />
        <Box sx={{ flex: 1, position: 'relative' }}>
          <CanvasStage
            design={design}
            toolMode={toolMode}
            selectedIds={selectedIds}
            ghostColor={selectedColor}
            stageRef={stageRef}
            panelOverrides={panelColors}
            showConnectionMarks={canvasMode === 'edit'}
            simMode={canvasMode === 'sim'}
            onPanelClick={handlePanelClick}
            onPanelRotate={handlePanelRotate}
            onPanelDragStart={(id) => {
              if (design) {
                const p = design.panels.find(pp => pp.id === id)
                if (p) dragOrigins.current.set(id, { x: p.x, y: p.y })
              }
            }}
            onPanelDragEnd={(id, x, y) => {
              if (!design) return null
              const panel = design.panels.find(p => p.id === id)
              if (!panel) return null

              const snapCandidates = findSnapCandidates(
                { type: panel.type, x, y, rotation: panel.rotation },
                design.panels,
                new Set([id]),
                SNAP_THRESHOLD,
              )

              for (const trySnap of snapCandidates) {
                const newSnappedTo: SnappedTo = {
                  panelId: trySnap.targetPanelId,
                  connectionIndex: trySnap.targetConnectionIndex,
                }
                const snappedUpdates: Record<string, SnappedTo | null> = { [id]: newSnappedTo }
                for (const p of design.panels) {
                  if (p.id !== id && p.snappedTo?.panelId === id) {
                    snappedUpdates[p.id] = null
                  }
                }
                batchUpdatePanels(panels =>
                  panels.map(p => {
                    const su = snappedUpdates[p.id]
                    return su !== undefined
                      ? { ...p, x: p.id === id ? trySnap.snapX : p.x, y: p.id === id ? trySnap.snapY : p.y, snappedTo: su }
                      : p.id === id
                        ? { ...p, x: trySnap.snapX, y: trySnap.snapY }
                        : p
                  }),
                )
                return { x: trySnap.snapX, y: trySnap.snapY }
              }

              // No snap — standard overlap check
              {
                const snappedUpdates: Record<string, SnappedTo | null> = {}
                if (panel.snappedTo) snappedUpdates[id] = null
                for (const p of design.panels) {
                  if (p.id !== id && p.snappedTo?.panelId === id) {
                    snappedUpdates[p.id] = null
                  }
                }
                if (Object.keys(snappedUpdates).length > 0) {
                  batchUpdatePanels(panels =>
                    panels.map(p => {
                      const su = snappedUpdates[p.id]
                      return p.id === id
                        ? { ...p, x, y, snappedTo: su !== undefined ? su : p.snappedTo }
                        : su !== undefined
                          ? { ...p, snappedTo: su }
                          : p
                    }),
                  )
                } else {
                  movePanelEnd(id, x, y)
                }
                return { x, y }
              }
            }}
            onStageClick={handleStageClick}
            onBlankClick={() => setSelectedIds(new Set())}
          />
          {canvasMode === 'edit' && (
            <ColorPanel
              selectedCount={selectedIds.size}
              currentColor={selectedColor}
              onColorChange={color => {
                setPickingColorFromPanel(false)
                updatePanelColor([...selectedIds], color)
              }}
              onPickFromPanel={() => setPickingColorFromPanel(true)}
              onCancelPick={() => setPickingColorFromPanel(false)}
              pickingFromPanel={pickingColorFromPanel}
              visible={selectedIds.size > 0}
            />
          )}
        </Box>
      </Box>
      {canvasMode === 'sim' && (
        <Paper square elevation={0} sx={{ width: 280, borderLeft: 1, borderColor: 'divider', overflow: 'auto' }}>
          <SimEffectPanel
            skills={skills}
            activeSkillId={activeSkillId}
            onPlay={handleSimPlay}
            onStop={handleSimStop}
          />
        </Paper>
      )}
      <CanvasAIDialog
        open={aiDialogOpen}
        onClose={() => setAiDialogOpen(false)}
        onGenerated={handleAIGenerated}
      />
    </Box>
  )
}
