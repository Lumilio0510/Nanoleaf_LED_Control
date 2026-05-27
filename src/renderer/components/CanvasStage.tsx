import { useRef, useState, useCallback, useEffect } from 'react'
import { Stage, Layer, Rect } from 'react-konva'
import type Konva from 'konva'
import CanvasGrid from './CanvasGrid'
import CanvasShapePanel from './CanvasShapePanel'
import type { PanelType, PlacedPanel, CanvasDesign } from '../../shared/canvas-types'

interface Props {
  design: CanvasDesign | null
  toolMode: 'select' | PanelType
  selectedIds: Set<string>
  ghostColor: string
  stageRef: React.MutableRefObject<Konva.Stage | null>
  onPanelClick: (id: string, shiftKey: boolean) => void
  onPanelDragStart: (id: string) => void
  onPanelDragEnd: (id: string, x: number, y: number) => void
  onStageClick: (x: number, y: number) => void
  onBlankClick: () => void
}

export default function CanvasStage({
  design, toolMode, selectedIds, ghostColor, stageRef,
  onPanelClick, onPanelDragStart, onPanelDragEnd, onStageClick, onBlankClick,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 800, h: 600 })
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [ghostPos, setGhostPos] = useState<{ x: number; y: number } | null>(null)
  const panning = useRef(false)
  const lastP = useRef({ x: 0, y: 0 })
  const spaceHeld = useRef(false)

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

  const handleMove = useCallback(() => {
    if (toolMode === 'select') { setGhostPos(null); return }
    setGhostPos(getPos())
  }, [toolMode, getPos])

  const handleMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.evt.button === 1 || spaceHeld.current) { panning.current = true; lastP.current = { x: e.evt.clientX, y: e.evt.clientY }; return }
    if (toolMode !== 'select') { const p = getPos(); onStageClick(p.x, p.y); return }
    if (e.target === e.target.getStage()) onBlankClick()
  }, [toolMode, getPos, onStageClick, onBlankClick])

  const handleMouseMovePan = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (panning.current) { const dx = e.evt.clientX - lastP.current.x; const dy = e.evt.clientY - lastP.current.y; lastP.current = { x: e.evt.clientX, y: e.evt.clientY }; setOffset(o => ({ x: o.x + dx, y: o.y + dy })); return }
    handleMove()
  }, [handleMove])

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', overflow: 'hidden', background: '#1a1a1a' }}>
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
          <Rect x={-5000} y={-5000} width={10000} height={10000} fill="#1a1a1a" />
          <CanvasGrid width={size.w} height={size.h} offsetX={offset.x} offsetY={offset.y} scale={scale} />
        </Layer>
        <Layer>
          {design?.panels.map(p => (
            <CanvasShapePanel
              key={p.id} panel={p}
              isSelected={selectedIds.has(p.id)}
              onDragStart={() => onPanelDragStart(p.id)}
              onDragEnd={(x, y) => onPanelDragEnd(p.id, x, y)}
              onClick={() => onPanelClick(p.id, false)}
            />
          ))}
          {ghostPos && toolMode !== 'select' && (
            <CanvasShapePanel
              panel={{ id: '__ghost__', type: toolMode as PanelType, x: ghostPos.x, y: ghostPos.y, rotation: 0, color: ghostColor, snappedTo: null }}
              isSelected={false} isGhost
            />
          )}
        </Layer>
      </Stage>
    </div>
  )
}
