import { Group, Line } from 'react-konva'
import { getPanelGeometry } from '../utils/panelGeometry'
import type { PlacedPanel } from '../../shared/canvas-types'

interface Props {
  panel: PlacedPanel
  isSelected: boolean
  isGhost?: boolean
  onDragStart?: () => void
  onDragEnd?: (x: number, y: number) => void
  onClick?: () => void
}

export default function CanvasShapePanel({ panel, isSelected, isGhost, onDragStart, onDragEnd, onClick }: Props) {
  const geo = getPanelGeometry(panel.type)
  const pts = geo.vertices.flatMap(v => [v.x, v.y])

  return (
    <Group
      x={panel.x} y={panel.y} rotation={panel.rotation}
      opacity={isGhost ? 0.4 : 1} draggable={!isGhost}
      onDragStart={onDragStart}
      onDragEnd={(e) => onDragEnd?.(e.target.x(), e.target.y())}
      onClick={onClick} onTap={onClick}
    >
      <Line
        points={pts} closed fill={panel.color}
        stroke={isSelected ? '#10B981' : '#555'} strokeWidth={isSelected ? 3 : 1}
      />
    </Group>
  )
}
