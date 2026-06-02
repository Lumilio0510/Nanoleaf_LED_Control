import { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import { Stage, Layer, Rect, Line } from 'react-konva'
import type Konva from 'konva'
import CanvasGrid from './CanvasGrid'
import CanvasShapePanel from './CanvasShapePanel'
import { panelsOverlap, findBestSnap, connectionToEdgeIndices, getPanelGeometry, getConnectionWorldPos } from '../utils/panelGeometry'
import type { PanelType, PlacedPanel, CanvasDesign } from '../../shared/canvas-types'

interface Props {
  design: CanvasDesign | null
  toolMode: 'select' | PanelType
  selectedIds: Set<string>
  ghostColor: string
  stageRef: React.MutableRefObject<Konva.Stage | null>
  onPanelClick: (id: string, shiftKey: boolean) => void
  onPanelDragStart: (id: string) => void
  onPanelDragEnd: (id: string, x: number, y: number) => { x: number; y: number } | null
  onPanelRotate?: (id: string) => void
  onStageClick: (x: number, y: number) => void
  onBlankClick: () => void
  panelOverrides?: Map<string, string>
  showConnectionMarks?: boolean
  simMode?: boolean
}

interface SnapHighlight {
  draggedId: string
  draggedEdgeIndices: number[]
  targetId: string
  targetEdgeIndices: number[]
}

export default function CanvasStage({
  design, toolMode, selectedIds, ghostColor, stageRef,
  onPanelClick, onPanelDragStart, onPanelDragEnd, onPanelRotate, onStageClick, onBlankClick,
  panelOverrides,
  showConnectionMarks = false,
  simMode = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 800, h: 600 })
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [ghostPos, setGhostPos] = useState<{ x: number; y: number } | null>(null)
  const [snapHighlight, setSnapHighlight] = useState<SnapHighlight | null>(null)
  const panning = useRef(false)
  const lastP = useRef({ x: 0, y: 0 })
  const spaceHeld = useRef(false)
  /** Track the last snap key to avoid redundant re-renders during drag */
  const prevSnapKey = useRef<string | null>(null)

  useEffect(() => {
    const r = () => { if (containerRef.current) setSize({ w: containerRef.current.clientWidth, h: containerRef.current.clientHeight }) }
    r(); window.addEventListener('resize', r); return () => window.removeEventListener('resize', r)
  }, [])

  useEffect(() => {
    const d = (e: KeyboardEvent) => { if (e.code === 'Space') { e.preventDefault(); spaceHeld.current = true } }
    const u = (e: KeyboardEvent) => { if (e.code === 'Space') spaceHeld.current = false }
    window.addEventListener('keydown', d); window.addEventListener('keyup', u)
    return () => { window.removeEventListener('keydown', d); window.removeEventListener('keyup', u) }
  }, [])

  const getPos = useCallback((): { x: number; y: number } => {
    return stageRef.current?.getRelativePointerPosition() ?? { x: 0, y: 0 }
  }, [stageRef])

  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()
    const st = stageRef.current; if (!st) return
    const ptr = st.getPointerPosition(); if (!ptr) return
    const ns = e.evt.deltaY > 0 ? scale * 0.9 : scale * 1.1
    const cs = Math.max(0.1, Math.min(5, ns))
    const m = { x: (ptr.x - offset.x) / scale, y: (ptr.y - offset.y) / scale }
    setScale(cs)
    setOffset({ x: ptr.x - m.x * cs, y: ptr.y - m.y * cs })
  }, [scale, offset, stageRef])

  const ghostOverlaps = useMemo(() => {
    if (!ghostPos || toolMode === 'select' || !design) return false
    const ghost: PlacedPanel = { id: '__check__', type: toolMode as PanelType, x: ghostPos.x, y: ghostPos.y, rotation: 0, color: '', snappedTo: null }
    return design.panels.some(p => panelsOverlap(p, ghost))
  }, [ghostPos, toolMode, design])

  const handleMove = useCallback(() => {
    if (simMode) { setGhostPos(null); return }
    if (toolMode === 'select') { setGhostPos(null); return }
    setGhostPos(getPos())
  }, [simMode, toolMode, getPos])

  const handleMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (simMode) return
    if (e.evt.button === 1 || spaceHeld.current) { panning.current = true; lastP.current = { x: e.evt.clientX, y: e.evt.clientY }; return }
    if (toolMode !== 'select') {
      if (e.target === e.target.getStage()) {
        const p = getPos()
        if (design) {
          const ghost: PlacedPanel = { id: '__check__', type: toolMode as PanelType, x: p.x, y: p.y, rotation: 0, color: '', snappedTo: null }
          if (!design.panels.some(existing => panelsOverlap(existing, ghost))) {
            onStageClick(p.x, p.y)
          }
        }
      }
      return
    }
    if (e.target === e.target.getStage()) onBlankClick()
  }, [simMode, toolMode, getPos, onStageClick, onBlankClick, design])

  const handleMouseMovePan = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (panning.current) { const dx = e.evt.clientX - lastP.current.x; const dy = e.evt.clientY - lastP.current.y; lastP.current = { x: e.evt.clientX, y: e.evt.clientY }; setOffset(o => ({ x: o.x + dx, y: o.y + dy })); return }
    handleMove()
  }, [handleMove])

  /** Compute snap highlight during drag move — only updates state when candidate changes */
  const handleDragMove = useCallback((id: string, type: PanelType, x: number, y: number, rotation: number) => {
    if (!design) return
    const candidate = findBestSnap({ type, x, y, rotation }, design.panels, new Set([id]), 20)
    let key: string | null = null
    if (candidate) {
      key = `${candidate.targetPanelId}|${candidate.draggedConnectionIndex}|${candidate.targetConnectionIndex}|${candidate.isVertexSnap ?? false}`
    }
    if (key === prevSnapKey.current) return
    prevSnapKey.current = key

    if (!candidate) {
      setSnapHighlight(null)
      return
    }

    const draggedEdgeIndices = connectionToEdgeIndices(type, candidate.draggedConnectionIndex, candidate.isVertexSnap)
    const targetPanel = design.panels.find(p => p.id === candidate.targetPanelId)
    if (!targetPanel) { setSnapHighlight(null); return }
    const targetEdgeIndices = connectionToEdgeIndices(targetPanel.type, candidate.targetConnectionIndex, candidate.isVertexSnap)

    setSnapHighlight({
      draggedId: id,
      draggedEdgeIndices,
      targetId: candidate.targetPanelId,
      targetEdgeIndices,
    })
  }, [design])

  /** Clear highlight when drag ends */
  const wrappedDragEnd = useCallback((id: string, x: number, y: number) => {
    setSnapHighlight(null)
    prevSnapKey.current = null
    return onPanelDragEnd(id, x, y)
  }, [onPanelDragEnd])

  /** Resolve edge highlight indices for a given panel id */
  const highlightEdgesFor = useCallback((id: string): number[] => {
    if (!snapHighlight) return []
    if (id === snapHighlight.draggedId) return snapHighlight.draggedEdgeIndices
    if (id === snapHighlight.targetId) return snapHighlight.targetEdgeIndices
    return []
  }, [snapHighlight])

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', overflow: 'hidden', background: '#ffffff' }}>
      <Stage
        ref={stageRef}
        width={size.w} height={size.h}
        scaleX={scale} scaleY={scale} x={offset.x} y={offset.y}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMovePan}
        onMouseUp={() => { panning.current = false }}
      >
        <Layer listening={false}>
          <Rect x={-5000} y={-5000} width={10000} height={10000} fill="#ffffff" />
          <CanvasGrid width={size.w} height={size.h} offsetX={offset.x} offsetY={offset.y} scale={scale} />
        </Layer>
        {showConnectionMarks && design && (
          <Layer listening={false}>
            {design.panels.filter(p => p.snappedTo).map(p => {
              const target = design.panels.find(op => op.id === p.snappedTo!.panelId)
              if (!target) return null
              const cp = getConnectionWorldPos(p, p.type, p.snappedTo!.connectionIndex)
              if (!cp) return null
              const edgeIndices = connectionToEdgeIndices(p.type, p.snappedTo!.connectionIndex)
              if (edgeIndices.length === 0) return null
              const geo = getPanelGeometry(p.type)
              const ei = edgeIndices[0]
              const v1 = geo.vertices[ei]
              const v2 = geo.vertices[(ei + 1) % geo.vertices.length]
              const edgeAngle = Math.atan2(v2.y - v1.y, v2.x - v1.x) + (p.rotation * Math.PI / 180)
              const perpAngle = edgeAngle + Math.PI / 2
              const tickLen = 8
              return (
                <Line
                  key={`conn-${p.id}-${p.snappedTo!.panelId}`}
                  points={[
                    cp.x - Math.cos(perpAngle) * tickLen,
                    cp.y - Math.sin(perpAngle) * tickLen,
                    cp.x + Math.cos(perpAngle) * tickLen,
                    cp.y + Math.sin(perpAngle) * tickLen,
                  ]}
                  stroke="#ffffff"
                  strokeWidth={2}
                  listening={false}
                />
              )
            })}
          </Layer>
        )}
        <Layer>
          {design?.panels.map(p => (
            <CanvasShapePanel
              key={p.id}
              panel={{ ...p, color: panelOverrides?.get(p.id) ?? p.color }}
              isSelected={selectedIds.has(p.id) && !simMode}
              highlightedEdges={highlightEdgesFor(p.id)}
              onDragStart={simMode ? undefined : () => onPanelDragStart(p.id)}
              onDragMove={simMode ? undefined : (x, y, r) => handleDragMove(p.id, p.type, x, y, r)}
              onDragEnd={simMode ? undefined : (x, y) => wrappedDragEnd(p.id, x, y)}
              onClick={simMode ? undefined : () => onPanelClick(p.id, false)}
              onRotate={(!simMode && onPanelRotate) ? () => onPanelRotate(p.id) : undefined}
            />
          ))}
          {ghostPos && toolMode !== 'select' && (
            <CanvasShapePanel
              panel={{ id: '__ghost__', type: toolMode as PanelType, x: ghostPos.x, y: ghostPos.y, rotation: 0, color: ghostOverlaps ? '#ef4444' : ghostColor, snappedTo: null }}
              isSelected={false} isGhost
            />
          )}
        </Layer>
      </Stage>
    </div>
  )
}
