import { useState, useEffect } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { api } from '../api'
import type { DeviceState } from '../types'

const statusConfig: Record<string, { color: string; label: string }> = {
  disconnected: { color: '#D0D4DA', label: '未连接' },
  connecting: { color: '#F59E0B', label: '连接中' },
  connected: { color: '#10B981', label: '已连接' },
  auth_required: { color: '#F59E0B', label: '需认证' },
  error: { color: '#EF4444', label: '错误' },
}

export default function StatusBar() {
  const [device, setDevice] = useState<DeviceState>({ config: null, status: 'disconnected' })

  useEffect(() => {
    api.getDeviceStatus().then(setDevice)
    return api.onDeviceStatusChange(setDevice)
  }, [])

  const s = statusConfig[device.status]

  return (
    <Box
      component="footer"
      sx={{
        height: 28,
        borderTop: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        display: 'flex',
        alignItems: 'center',
        px: 2,
      }}
    >
      <Box
        sx={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          bgcolor: s.color,
          mr: 1,
        }}
      />
      <Typography variant="caption" color="text.secondary">
        {device.config
          ? `${device.config.name}  ·  ${device.config.host}:${device.config.port}`
          : s.label}
      </Typography>
      <Typography variant="caption" color="text.disabled" sx={{ ml: 'auto' }}>
        v1.0
      </Typography>
    </Box>
  )
}
