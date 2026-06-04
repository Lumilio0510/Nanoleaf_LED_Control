import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import { useSavedDevices } from '../hooks/useDevices'
import { api } from '../api'

export default function DeviceSettings() {
  const { devices, refresh } = useSavedDevices()

  async function handleRemove(id: string) {
    await api.removeDevice(id)
    refresh()
  }

  return (
    <Card>
      <CardHeader title="已保存设备" slotProps={{ title: { variant: 'h6' } }} />
      <CardContent sx={{ pt: 0 }}>
        {devices.length === 0 ? (
          <Typography variant="body2" color="text.disabled" sx={{ textAlign: 'center', py: 4 }}>
            暂无设备，请到控制面板添加
          </Typography>
        ) : (
          <Stack spacing={1}>
            {devices.map(d => (
              <Paper
                key={d.id}
                variant="outlined"
                sx={{
                  p: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  bgcolor: 'action.hover',
                  borderRadius: 3,
                  '&:hover': { borderColor: 'grey.300' },
                  transition: 'border-color 0.15s',
                }}
              >
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>{d.name}</Typography>
                  <Typography variant="caption" color="text.disabled" sx={{ mt: 0.25 }}>
                    {d.host}:{d.port}
                    {d.note && <span> — {d.note}</span>}
                  </Typography>
                </Box>
                <Button
                  variant="outlined"
                  color="secondary"
                  size="small"
                  onClick={() => handleRemove(d.id)}
                  sx={{
                    fontSize: '0.75rem',
                    px: 1.5,
                    py: 0.5,
                    '&:hover': { color: 'error.main', borderColor: 'error.main', bgcolor: 'rgba(239,68,68,0.06)' },
                  }}
                >
                  删除
                </Button>
              </Paper>
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  )
}
