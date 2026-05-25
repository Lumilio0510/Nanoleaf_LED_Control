import { useState, useEffect } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import Box from '@mui/material/Box'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Divider from '@mui/material/Divider'
import CloseIcon from '@mui/icons-material/Close'
import AddIcon from '@mui/icons-material/Add'
import type { Skill } from '../types'

interface Props {
  skill?: Skill | null
  onSave: (skill: Skill) => void
  onClose: () => void
}

function emptySkill(): Skill {
  return {
    meta: { id: crypto.randomUUID(), name: '', description: '', tags: [], version: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    params: [],
    mapping: { endpoint: '', bodyTemplate: {} }
  }
}

export default function SkillEditor({ skill: initial, onSave, onClose }: Props) {
  const [skill, setSkill] = useState<Skill>(initial || emptySkill())

  useEffect(() => { if (initial) setSkill(initial) }, [initial])

  function updateMeta(field: string, value: unknown) {
    setSkill(prev => ({ ...prev, meta: { ...prev.meta, [field]: value, updatedAt: new Date().toISOString() } }))
  }

  function updateParam(index: number, field: string, value: unknown) {
    setSkill(prev => {
      const params = [...prev.params]
      params[index] = { ...params[index], [field]: value }
      return { ...prev, params }
    })
  }

  function addParam() {
    setSkill(prev => ({
      ...prev,
      params: [...prev.params, { key: '', label: '', type: 'text' as const, default: '' }]
    }))
  }

  function removeParam(index: number) {
    setSkill(prev => ({ ...prev, params: prev.params.filter((_, i) => i !== index) }))
  }

  function handleSave() { onSave(skill) }

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, pb: 0 }}>
        {initial ? '编辑 Skill' : '新建 Skill'}
      </DialogTitle>
      <DialogContent sx={{ pt: 2.5 }}>
        <Stack spacing={1.5}>
          <TextField
            size="small"
            fullWidth
            placeholder="名称"
            value={skill.meta.name}
            onChange={e => updateMeta('name', e.target.value)}
          />
          <TextField
            size="small"
            fullWidth
            placeholder="描述"
            value={skill.meta.description}
            onChange={e => updateMeta('description', e.target.value)}
          />
          <TextField
            size="small"
            fullWidth
            placeholder="标签（逗号分隔）"
            value={skill.meta.tags.join(',')}
            onChange={e => updateMeta('tags', e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
          />
          <TextField
            size="small"
            fullWidth
            placeholder="Endpoint（如 POST /effect/breathe）"
            value={skill.mapping.endpoint}
            onChange={e => setSkill(prev => ({ ...prev, mapping: { ...prev.mapping, endpoint: e.target.value } }))}
            sx={{ '& input': { fontFamily: 'monospace', fontSize: '0.75rem' } }}
          />

          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500, mb: 0.5, display: 'block' }}>
              Body Template (JSON)
            </Typography>
            <TextField
              size="small"
              fullWidth
              multiline
              rows={6}
              value={JSON.stringify(skill.mapping.bodyTemplate, null, 2)}
              onChange={e => {
                try { setSkill(prev => ({ ...prev, mapping: { ...prev.mapping, bodyTemplate: JSON.parse(e.target.value) } })) } catch {}
              }}
              sx={{ '& textarea': { fontFamily: 'monospace', fontSize: '0.75rem' } }}
            />
          </Box>

          <Box>
            <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                参数列表
              </Typography>
              <Button variant="text" size="small" startIcon={<AddIcon />} onClick={addParam} sx={{ fontSize: '0.75rem', px: 1, py: 0 }}>
                添加参数
              </Button>
            </Stack>
            <Stack spacing={1}>
              {skill.params.map((p, i) => (
                <Stack key={i} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <TextField size="small" placeholder="参数名" value={p.key} onChange={e => updateParam(i, 'key', e.target.value)} sx={{ width: 110 }} inputProps={{ style: { fontSize: '0.75rem' } }} />
                  <TextField size="small" placeholder="显示名" value={p.label} onChange={e => updateParam(i, 'label', e.target.value)} sx={{ width: 110 }} inputProps={{ style: { fontSize: '0.75rem' } }} />
                  <FormControl size="small" sx={{ width: 100 }}>
                    <InputLabel>类型</InputLabel>
                    <Select label="类型" value={p.type} onChange={e => updateParam(i, 'type', e.target.value)}>
                      <MenuItem value="range">range</MenuItem>
                      <MenuItem value="color">color</MenuItem>
                      <MenuItem value="select">select</MenuItem>
                      <MenuItem value="number">number</MenuItem>
                      <MenuItem value="text">text</MenuItem>
                    </Select>
                  </FormControl>
                  <TextField size="small" placeholder="默认值" value={String(p.default)} onChange={e => updateParam(i, 'default', e.target.value)} sx={{ width: 110 }} inputProps={{ style: { fontSize: '0.75rem' } }} />
                  <IconButton size="small" onClick={() => removeParam(i)} sx={{ color: 'text.disabled', '&:hover': { color: 'error.main' } }}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Stack>
              ))}
            </Stack>
          </Box>
        </Stack>
      </DialogContent>
      <Divider />
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button variant="contained" onClick={handleSave}>保存</Button>
        <Button variant="outlined" color="secondary" onClick={onClose}>取消</Button>
      </DialogActions>
    </Dialog>
  )
}
