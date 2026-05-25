import Box from '@mui/material/Box'

interface Props {
  palette: { r: number; g: number; b: number }[]
}

export default function ColorBar({ palette }: Props) {
  if (!palette || palette.length === 0) return null
  const stops = palette.map((c, i) => {
    const pct = (i / Math.max(palette.length - 1, 1)) * 100
    return `rgb(${c.r},${c.g},${c.b}) ${pct}%`
  })
  return (
    <Box
      sx={{
        width: '100%',
        height: 8,
        borderRadius: 2,
        mt: 1,
        background: `linear-gradient(to right, ${stops.join(', ')})`,
      }}
    />
  )
}
