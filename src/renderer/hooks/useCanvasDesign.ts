import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../api'
import { panelsOverlap } from '../utils/panelGeometry'
import type { PanelType, PlacedPanel, CanvasDesign, CanvasDesignMeta } from '../../shared/canvas-types'

export function useCanvasDesign() {
  const createDefaultDesign = (): CanvasDesign => {
    const now = new Date().toISOString()
    return { id: crypto.randomUUID(), name: 'New Design', panels: [], createdAt: now, updatedAt: now }
  }
  const [design, setDesign] = useState<CanvasDesign | null>(createDefaultDesign)
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
    const d = createDefaultDesign()
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

  const renameDesign = useCallback(async (id: string, newName: string) => {
    await api.renameDesign(id, newName)
    await refreshDesigns()
    setDesign(prev => prev?.id === id && prev ? { ...prev, name: newName } : prev)
  }, [refreshDesigns])

  const addPanel = useCallback((type: PanelType, x: number, y: number) => {
    if (!design) return
    const newPanel: PlacedPanel = {
      id: crypto.randomUUID(),
      type,
      x,
      y,
      rotation: 0,
      color: '#cccccc',
      snappedTo: null,
    }
    if (design.panels.some(p => panelsOverlap(p, newPanel))) return
    pushUndo()
    setDesign({
      ...design,
      panels: [...design.panels, newPanel],
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

  const batchUpdatePanels = useCallback((
    updater: (panels: PlacedPanel[]) => PlacedPanel[],
  ) => {
    if (!design) return
    pushUndo()
    setDesign({
      ...design,
      panels: updater(design.panels),
      updatedAt: new Date().toISOString(),
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

  const rotatePanel = useCallback((id: string, degrees: number) => {
    if (!design) return
    pushUndo()
    setDesign({
      ...design,
      panels: design.panels.map(p =>
        p.id === id
          ? { ...p, rotation: (p.rotation + degrees) % 360, snappedTo: null }
          : p.snappedTo?.panelId === id
            ? { ...p, snappedTo: null }
            : p
      ),
      updatedAt: new Date().toISOString(),
    })
  }, [design, pushUndo])

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
    refreshDesigns, newDesign, loadDesign, saveDesign, deleteDesign, renameDesign,
    addPanel, movePanel, movePanelEnd, batchUpdatePanels, updatePanelColor, deleteSelected, rotatePanel, selectAll, undo,
  }
}
