import { useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import { api } from '../api'

interface Props {
  deviceId: string
  host: string
  onSuccess: () => void
  onCancel: () => void
}

export default function AuthDialog({ deviceId, host, onSuccess, onCancel }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAuth() {
    setLoading(true)
    setError(null)
    try {
      await api.authenticate(deviceId)
      onSuccess()
    } catch (e) {
      setError(e instanceof Error ? e.message : '认证失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open maxWidth="sm" fullWidth onClose={onCancel}>
      <DialogTitle>设备认证</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          请按以下步骤操作以完成认证：
        </Typography>
        <Box component="ol" sx={{ pl: 2.5, mb: 2, '& li': { mb: 1, fontSize: '0.875rem', color: 'text.secondary' } }}>
          <li>按住 Nanoleaf 控制器上的 <strong>电源键</strong></li>
          <li>保持 <strong>5-7 秒</strong>，直到 LED 指示灯开始<strong>闪烁白光</strong></li>
          <li>点击下方"开始认证"按钮</li>
        </Box>
        <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 1 }}>
          目标设备：{host}
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 1.5, fontSize: '0.75rem', py: 0 }}>
            {error}
          </Alert>
        )}

        {loading && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">正在认证...</Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} size="small" color="secondary">取消</Button>
        <Button onClick={handleAuth} variant="contained" size="small" disabled={loading}>
          开始认证
        </Button>
      </DialogActions>
    </Dialog>
  )
}
