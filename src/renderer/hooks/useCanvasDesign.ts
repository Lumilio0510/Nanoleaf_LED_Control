import { useState, useEffect, useCallback, useRef } from 'react'
import { v4 as uuid } from 'uuid'
import { api } from '../api'
import type { PanelType, PlacedPanel, CanvasDesign, CanvasDesignMeta } from '../../shared/canvas-types'

export function useCanvasDesign() {
  const [design, setDesign] = useState<CanvasDesign | null>(null)
  const [designs, setDesigns] = useState<CanvasDesignMeta[]>([])
  const [toolMode, setToolMode] = useState<'select' | PanelType>('select')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const undoStack = useRef<PlacedPanel[][]>([])
  const redoStack = useRef<PlacedPanel[][]>([])

  const pushUndo = useCallback(() => {
    if (!design) return
    undoStack.current.push(design.panels.map(p => ({ ...p })))
    redoStack.current = []
  }, [design])

  const refreshDesigns = useCallback(async () => {
    setDesigns(await api.listDesigns())
  }, [])

  useEffect(() => { refreshDesigns() }, [refreshDesigns])

  const newDesign = useCallback(() => {
    const now = new Date().toISOString()
    const d: CanvasDesign = {
      id: uuid(),
      name: 'New Design',
      panels: [],
      createdAt: now,
      updatedAt: now,
    }
    setDesign(d)
    undoStack.current = []
    redoStack.current = []
    setSelectedIds(new Set())
  }, [])

  const loadDesign = useCallback(async (id: string) => {
    const d = await api.loadDesign(id)
    if (d) {
      setDesign(d)
      undoStack.current = []
      redoStack.current = []
      setSelectedIds(new Set())
    }
  }, [])

  const saveDesign = useCallback(async () => {
    if (!design) return
    const saved = await api.saveDesign(design)
    setDesign(prev => prev ? { ...prev, ...saved, updatedAt: saved.updatedAt } : prev)
    await refreshDesigns()
  }, [design, refreshDesigns])

  const deleteDesign = useCallback(async (id: string) => {
    await api.deleteDesign(id)
    await refreshDesigns()
    if (design?.id === id) {
      setDesign(null)
    }
  }, [design, refreshDesigns])

  const addPanel = useCallback((type: PanelType, x: number, y: number) => {
    if (!design) return
    pushUndo()
    const panel: PlacedPanel = {
      id: uuid(),
      type,
      x,
      y,
      rotation: 0,
      color: '#ffffff',
      snappedTo: null,
    }
    setDesign({
      ...design,
      panels: [...design.panels, panel],
      updatedAt: new Date().toISOString(),
    })
  }, [design, pushUndo])

  const movePanel = useCallback((id: string, x: number, y: number) => {
    if (!design) return
    setDesign({
      ...design,
      panels: design.panels.map(p => p.id === id ? { ...p, x, y } : p),
    })
  }, [design])

  const movePanelEnd = useCallback((id: string, x: number, y: number) => {
    if (!design) return
    pushUndo()
    setDesign({
      ...design,
      panels: design.panels.map(p => p.id === id ? { ...p, x, y } : p),
    })
  }, [design, pushUndo])

  const updatePanelColor = useCallback((ids: string[], color: string) => {
    if (!design) return
    pushUndo()
    const idSet = new Set(ids)
    setDesign({
      ...design,
      panels: design.panels.map(p => idSet.has(p.id) ? { ...p, color } : p),
      updatedAt: new Date().toISOString(),
    })
  }, [design, pushUndo])

  const deleteSelected = useCallback(() => {
    if (!design) return
    pushUndo()
    setDesign({
      ...design,
      panels: design.panels.filter(p => !selectedIds.has(p.id)),
      updatedAt: new Date().toISOString(),
    })
    setSelectedIds(new Set())
  }, [design, selectedIds, pushUndo])

  const selectAll = useCallback(() => {
    if (!design) return
    setSelectedIds(new Set(design.panels.map(p => p.id)))
  }, [design])

  const undo = useCallback(() => {
    if (!design) return
    const prevPanels = undoStack.current.pop()
    if (!prevPanels) return
    redoStack.current.push(design.panels.map(p => ({ ...p })))
    setDesign({
      ...design,
      panels: prevPanels,
      updatedAt: new Date().toISOString(),
    })
  }, [design])

  return {
    design, designs, toolMode, selectedIds, setDesign, setToolMode, setSelectedIds,
    refreshDesigns, newDesign, loadDesign, saveDesign, deleteDesign,
    addPanel, movePanel, movePanelEnd, updatePanelColor, deleteSelected, selectAll, undo,
  }
}
