import { Group, Line, Circle } from 'react-konva'
import { getPanelGeometry } from '../utils/panelGeometry'
import type { PlacedPanel } from '../../shared/canvas-types'

interface Props {
  panel: PlacedPanel
  isSelected: boolean
  isGhost?: boolean
  simMode?: boolean
  highlightedEdges?: number[]
  onDragStart?: () => void
  onDragMove?: (x: number, y: number, rotation: number) => void
  onDragEnd?: (x: number, y: number) => { x: number; y: number } | null
  onClick?: () => void
  onRotate?: () => void
}

export default function CanvasShapePanel({ panel, isSelected, isGhost, simMode = false, highlightedEdges = [], onDragStart, onDragMove, onDragEnd, onClick, onRotate }: Props) {
  const geo = getPanelGeometry(panel.type)
  const pts = geo.vertices.flatMap(v => [v.x, v.y])

  return (
    <Group
      x={panel.x} y={panel.y} rotation={panel.rotation}
      opacity={isGhost ? 0.4 : 1} draggable={!isGhost} listening={!isGhost}
      onDragStart={onDragStart}
      onDragMove={(e) => {
        onDragMove?.(e.target.x(), e.target.y(), panel.rotation)
      }}
      onDragEnd={(e) => {
        const result = onDragEnd?.(e.target.x(), e.target.y())
        if (!result) {
          e.target.x(panel.x)
          e.target.y(panel.y)
        } else {
          e.target.x(result.x)
          e.target.y(result.y)
        }
        e.target.getLayer()?.batchDraw()
      }}
      onClick={onClick} onTap={onClick}
    >
      {/* Fill polygon — provides hit area for drag */ }
      <Line
        points={pts}
        closed
        fill={panel.color}
        shadowEnabled={simMode && panel.color !== '#000000'}
        shadowColor={panel.color}
        shadowBlur={20}
        shadowOpacity={0.7}
      />
      {/* Individual edge lines with highlight support */ }
      {geo.vertices.map((v, i) => {
        const j = (i + 1) % geo.vertices.length
        const isHigh = highlightedEdges.includes(i)
        return (
          <Line
            key={i}
            points={[v.x, v.y, geo.vertices[j].x, geo.vertices[j].y]}
            stroke={isHigh ? '#10B981' : (isSelected ? '#10B981' : '#555')}
            strokeWidth={isHigh ? 5 : (isSelected ? 3 : 1)}
            lineCap="round"
          />
        )
      })}
      {isSelected && !isGhost && onRotate && (
        <Circle
          x={0} y={0} radius={14}
          fill="#10B981"
          stroke="#ffffff"
          strokeWidth={2.5}
          onClick={(e) => { e.cancelBubble = true; onRotate() }}
          onTap={(e) => { e.cancelBubble = true; onRotate() }}
          onMouseEnter={(e) => { const s = e.target.getStage(); if (s) s.container().style.cursor = 'pointer' }}
          onMouseLeave={(e) => { const s = e.target.getStage(); if (s) s.container().style.cursor = 'default' }}
        />
      )}
    </Group>
  )
}
