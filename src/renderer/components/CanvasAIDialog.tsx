import { useState, useEffect, useRef } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate'
import CloseIcon from '@mui/icons-material/Close'
import { api } from '../api'
import type { CanvasDesign } from '../../shared/canvas-types'

interface GenProgress {
  step: 'generating' | 'validating' | 'fixing' | 'complete' | 'warning'
  attempt: number
  maxAttempts: number
  totalPanels: number
  overlaps: Array<{ a: number; b: number; desc: string }>
  disconnected: Array<{ indices: number[]; desc: string }>
}

interface StepInfo {
  id: string
  label: string
  detail: string
  status: 'pending' | 'active' | 'done' | 'error' | 'warn'
}

function buildSteps(progress: GenProgress | null, error: string): StepInfo[] {
  const steps: StepInfo[] = []

  // Step 1: Generate
  if (!progress) {
    steps.push({ id: 'gen', label: '正在生成初始方案...', detail: '', status: 'pending' })
    steps.push({ id: 'val', label: '验证方案', detail: '', status: 'pending' })
    return steps
  }

  const { step, attempt, maxAttempts, totalPanels, overlaps, disconnected, agentAction } = progress

  // Agent mode: show real-time action during generation
  if (agentAction !== undefined && step === 'generating') {
    const panelInfo = totalPanels > 0 ? `已放置 ${totalPanels} 块面板` : ''
    steps.push({ id: 'gen', label: agentAction, detail: panelInfo, status: 'active' })
    return steps
  }

  if (attempt === 1) {
    if (step === 'generating') {
      steps.push({ id: 'gen', label: '正在生成初始方案...', detail: '', status: 'active' })
      steps.push({ id: 'val', label: '验证方案', detail: '', status: 'pending' })
      return steps
    }
    steps.push({ id: 'gen', label: '初始方案已生成', detail: '', status: 'done' })
  } else {
    steps.push({ id: 'gen', label: '初始方案已生成', detail: '', status: 'done' })
    steps.push({ id: `fix${attempt - 1}`, label: `第 ${attempt - 1} 次修正完成`, detail: '', status: 'done' })
  }

  if (step === 'validating') {
    steps.push({ id: 'val', label: '正在验证方案...', detail: '', status: 'active' })
    return steps
  }

  if (step === 'fixing') {
    const issues: string[] = []
    if (overlaps.length > 0) issues.push(`${overlaps.length} 处重叠`)
    if (disconnected.length > 1) issues.push(`面板分 ${disconnected.length} 个独立组`)
    steps.push({
      id: `fix-detail-${attempt}`,
      label: `发现 ${issues.join('、')}，正在请求修正...`,
      detail: `(第 ${attempt}/${maxAttempts} 次)`,
      status: 'active',
    })
    return steps
  }

  if (step === 'complete') {
    steps.push({
      id: 'val',
      label: '方案验证通过！',
      detail: `共 ${totalPanels} 块面板，全部连通`,
      status: 'done',
    })
    return steps
  }

  if (step === 'warning') {
    const issues: string[] = []
    if (overlaps.length > 0) issues.push(`${overlaps.length} 处面板重叠`)
    if (disconnected.length > 1) issues.push(`面板分 ${disconnected.length} 个独立组`)
    steps.push({
      id: 'val',
      label: `方案已生成，但仍有 ${issues.join('、')}`,
      detail: `第 ${attempt} 次尝试 — 可在画板中手动调整`,
      status: 'warn',
    })
    return steps
  }

  if (error) {
    steps.push({ id: 'err', label: error, detail: '', status: 'error' })
  }

  return steps
}

interface Props {
  open: boolean
  onClose: () => void
  onGenerated: (design: CanvasDesign) => void
}

export default function CanvasAIDialog({ open, onClose, onGenerated }: Props) {
  const [description, setDescription] = useState('')
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<GenProgress | null>(null)
  const [error, setError] = useState('')
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const runningRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setDescription('')
      setProgress(null)
      setError('')
      setRunning(false)
      setImageBase64(null)
      setImagePreview(null)
      runningRef.current = false
    }
  }, [open])

  // Cleanup on unmount
  useEffect(() => {
    return () => { runningRef.current = false }
  }, [])

  const handleSelectImage = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Reset input so re-selecting same file triggers change
    e.target.value = ''

    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        // Resize to max 1024px on the longest side
        const MAX = 1024
        let { width, height } = img
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round(height * MAX / width); width = MAX }
          else { width = Math.round(width * MAX / height); height = MAX }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, width, height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
        setImageBase64(dataUrl)
        setImagePreview(dataUrl)
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveImage = () => {
    setImageBase64(null)
    setImagePreview(null)
  }

  const handleGenerate = async () => {
    const trimmed = description.trim()
    if (!trimmed && !imageBase64) return

    setRunning(true)
    setError('')
    setProgress(null)
    runningRef.current = true

    const unsub = api.onAiGenerateProgress((p: unknown) => {
      if (!runningRef.current) return
      setProgress(p as GenProgress)
    })

    try {
      const prompt = trimmed || '请根据参考图片生成灯板布局'
      const design = await api.aiGenerateDesign(prompt, imageBase64 ?? undefined)
      if (!runningRef.current) return
      // Don't overwrite 'warning' — the service already sent the final progress
      setProgress(prev => {
        if (prev?.step === 'warning') return prev
        return {
          step: 'complete',
          attempt: prev?.attempt ?? 1,
          maxAttempts: prev?.maxAttempts ?? 5,
          totalPanels: design.panels.length,
          overlaps: [],
          disconnected: [],
        }
      })
      // Brief pause so user sees result
      await new Promise(r => setTimeout(r, 1000))
      if (runningRef.current) {
        onGenerated(design)
        onClose()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误')
    } finally {
      unsub()
      setRunning(false)
      runningRef.current = false
    }
  }

  const handleClose = () => {
    if (!running) {
      onClose()
    }
  }

  const steps = buildSteps(progress, error)
  const isComplete = progress?.step === 'complete' || progress?.step === 'warning'

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>创造性 AI</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          multiline
          minRows={2}
          maxRows={4}
          fullWidth
          placeholder="描述你想要的形状，例如：一颗五角星 / 一棵圣诞树 / 一个爱心"
          value={description}
          onChange={e => setDescription(e.target.value)}
          disabled={running}
          sx={{ mb: 2 }}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey && !running) {
              e.preventDefault()
              handleGenerate()
            }
          }}
        />

        {/* Hidden file input */}
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        {/* Image upload area */}
        {!imagePreview ? (
          <Button
            variant="outlined"
            size="small"
            startIcon={<AddPhotoAlternateIcon />}
            onClick={handleSelectImage}
            disabled={running}
            sx={{ mb: 1.5 }}
          >
            上传参考图
          </Button>
        ) : (
          <Box sx={{ position: 'relative', display: 'inline-block', mb: 1.5 }}>
            <Box
              component="img"
              src={imagePreview}
              alt="参考图"
              sx={{
                maxWidth: 240, maxHeight: 120, borderRadius: 1,
                border: '1px solid', borderColor: 'divider',
              }}
            />
            <IconButton
              size="small"
              onClick={handleRemoveImage}
              disabled={running}
              sx={{ position: 'absolute', top: -8, right: -8, bgcolor: 'background.paper' }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        )}

        {steps.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {steps.map(s => (
              <Box key={s.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                {s.status === 'done' ? (
                  <CheckCircleIcon fontSize="small" color="success" />
                ) : s.status === 'error' ? (
                  <ErrorIcon fontSize="small" color="error" />
                ) : s.status === 'warn' ? (
                  <WarningAmberIcon fontSize="small" color="warning" />
                ) : s.status === 'active' ? (
                  <CircularProgress size={18} />
                ) : (
                  <RadioButtonUncheckedIcon fontSize="small" color="disabled" />
                )}
                <Box>
                  <Typography variant="body2" color={
                    s.status === 'error' ? 'error' :
                    s.status === 'active' ? 'textPrimary' :
                    s.status === 'done' ? 'success.main' :
                    s.status === 'warn' ? 'warning.main' :
                    'textSecondary'
                  }>
                    {s.label}
                  </Typography>
                  {s.detail && (
                    <Typography variant="caption" color="textSecondary">
                      {s.detail}
                    </Typography>
                  )}
                </Box>
              </Box>
            ))}
            {/* Issue details */}
            {(progress?.step === 'fixing' || progress?.step === 'warning') && (
              <Box sx={{ ml: 4.5, mt: 0.5 }}>
                {progress.overlaps.length > 0 && (
                  <>
                    <Typography variant="caption" color="error" sx={{ display: 'block', fontWeight: 600, mb: 0.5 }}>
                      面板重叠：
                    </Typography>
                    {progress.overlaps.map((o, i) => (
                      <Typography key={`ov-${i}`} variant="caption" color="textSecondary" sx={{ display: 'block' }}>
                        {o.desc}
                      </Typography>
                    ))}
                  </>
                )}
                {progress.disconnected.length > 1 && (
                  <>
                    <Typography variant="caption" color="warning.main" sx={{ display: 'block', fontWeight: 600, mb: 0.5, mt: 1 }}>
                      连通性问题：
                    </Typography>
                    {progress.disconnected.map((g, i) => (
                      <Typography key={`dc-${i}`} variant="caption" color="textSecondary" sx={{ display: 'block' }}>
                        {g.desc}
                      </Typography>
                    ))}
                  </>
                )}
              </Box>
            )}
          </Box>
        )}

        {error && !running && (
          <Typography color="error" variant="body2" sx={{ mt: 1 }}>
            {error}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={running}>
          {isComplete ? '关闭' : '取消'}
        </Button>
        <Button
          onClick={handleGenerate}
          disabled={running || (!description.trim() && !imageBase64)}
          variant="contained"
        >
          {running ? '生成中...' : '生成'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
