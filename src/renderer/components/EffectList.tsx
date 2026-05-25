import { useState } from 'react'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Grid from '@mui/material/Grid'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Alert from '@mui/material/Alert'
import { useEffects, useDeviceStatus } from '../hooks/useDevices'
import { api } from '../api'
import ColorBar from './ColorBar'
import type { EffectInfo } from '../types'

export default function EffectList() {
  const effects = useEffects()
  const device = useDeviceStatus()
  const [error, setError] = useState<string | null>(null)

  const isConnected = device.status === 'connected'

  if (effects.length === 0) return null

  async function apply(effect: EffectInfo) {
    if (!isConnected) {
      setError('请先连接设备')
      return
    }
    setError(null)
    try {
      await api.applyEffect(effect.id, {})
    } catch (e) {
      setError(e instanceof Error ? e.message : '应用灯效失败')
    }
  }

  return (
    <Card>
      <CardHeader title="灯效列表" slotProps={{ title: { variant: 'h6' } }} />
      <CardContent sx={{ pt: 0 }}>
        {!isConnected && (
          <Alert severity="warning" sx={{ mb: 1.5, fontSize: '0.75rem', py: 0 }}>
            未连接设备，请先在"设备连接"中选择并连接设备
          </Alert>
        )}

        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 1.5, fontSize: '0.75rem', py: 0 }}>
            {error}
          </Alert>
        )}

        <Grid container spacing={2}>
          {effects.map(effect => (
            <Grid size={6} key={effect.id}>
              <Box
                sx={{
                  bgcolor: 'action.hover',
                  borderRadius: 3,
                  p: 2,
                  border: 1,
                  borderColor: 'divider',
                  '&:hover': { borderColor: 'grey.300' },
                  transition: 'border-color 0.15s',
                }}
              >
                <Stack direction="row" sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{effect.name}</Typography>
                    <Typography variant="caption" color="text.disabled" sx={{ mt: 0.25 }}>
                      {effect.description || '内置灯效'}
                    </Typography>
                  </Box>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => apply(effect)}
                    disabled={!isConnected}
                    sx={{ fontSize: '0.75rem', px: 1.5, py: 0.5, ml: 1, flexShrink: 0 }}
                  >
                    应用
                  </Button>
                </Stack>
                <ColorBar palette={effect.palette ?? []} />
              </Box>
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  )
}
