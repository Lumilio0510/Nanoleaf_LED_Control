import { useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'

interface Props {
  open: boolean
  onClose: () => void
  onGenerate: (description: string) => Promise<void>
}

export default function CanvasAIDialog({ open, onClose, onGenerate }: Props) {
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleGenerate = async () => {
    const trimmed = description.trim()
    if (!trimmed) return
    setLoading(true)
    setError('')
    try {
      await onGenerate(trimmed)
      setDescription('')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setDescription('')
      setError('')
      onClose()
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>创造性 AI</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          multiline
          minRows={3}
          maxRows={6}
          fullWidth
          placeholder="描述你想要的形状，例如：一个爱心 / 一颗五角星 / 一棵圣诞树"
          value={description}
          onChange={e => setDescription(e.target.value)}
          disabled={loading}
          sx={{ mt: 1 }}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleGenerate()
            }
          }}
        />
        {error && (
          <Typography color="error" variant="body2" sx={{ mt: 1 }}>
            {error}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>取消</Button>
        <Button
          onClick={handleGenerate}
          disabled={loading || !description.trim()}
          variant="contained"
          startIcon={loading ? <CircularProgress size={16} /> : undefined}
        >
          {loading ? '生成中...' : '生成'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
