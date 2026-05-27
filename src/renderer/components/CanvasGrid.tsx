import { useMemo } from 'react'
import { Line } from 'react-konva'

interface Props {
  width: number; height: number; offsetX: number; offsetY: number; scale: number; gridSize?: number
}

export default function CanvasGrid({ width, height, offsetX, offsetY, scale, gridSize = 40 }: Props) {
  const lines = useMemo(() => {
    const r: number[][] = []
    const sx = Math.floor(-offsetX / scale / gridSize) * gridSize
    const sy = Math.floor(-offsetY / scale / gridSize) * gridSize
    const ex = sx + width / scale + gridSize * 2
    const ey = sy + height / scale + gridSize * 2
    for (let x = sx; x <= ex; x += gridSize) r.push([x, sy, x, ey])
    for (let y = sy; y <= ey; y += gridSize) r.push([sx, y, ex, y])
    return r
  }, [width, height, offsetX, offsetY, scale, gridSize])

  return (
    <>
      {lines.map((pts, i) => (
        <Line key={i} points={pts} stroke="#333" strokeWidth={1 / scale} listening={false} />
      ))}
    </>
  )
}
