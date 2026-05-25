import { useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Grid from '@mui/material/Grid'
import Stack from '@mui/material/Stack'
import InputAdornment from '@mui/material/InputAdornment'
import SearchIcon from '@mui/icons-material/Search'
import AddIcon from '@mui/icons-material/Add'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import { useSkills } from '../hooks/useSkills'
import SkillCard from './SkillCard'
import SkillEditor from './SkillEditor'
import type { Skill } from '../types'

export default function SkillLibrary() {
  const { skills, saveSkill, deleteSkill, execute } = useSkills()
  const [search, setSearch] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null)

  const filtered = skills.filter(s => {
    if (!search) return true
    const q = search.toLowerCase()
    return s.meta.name.toLowerCase().includes(q) ||
      s.meta.tags.some(t => t.toLowerCase().includes(q))
  })

  async function handleExecute(skill: Skill) {
    await execute(skill.meta.id, {})
  }

  function handleEdit(skill: Skill) { setEditingSkill(skill); setEditorOpen(true) }
  function handleNew() { setEditingSkill(null); setEditorOpen(true) }

  return (
    <Box>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5">Skill 库</Typography>
        <Stack direction="row" spacing={1}>
          <TextField
            size="small"
            placeholder="搜索名称或标签..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            slotProps={{
              input: {
                startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 16, color: 'text.disabled' }} /></InputAdornment>,
              }
            }}
            sx={{ width: 220 }}
          />
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleNew}>
            新建
          </Button>
        </Stack>
      </Stack>

      {filtered.length === 0 ? (
        <Stack sx={{ alignItems: 'center', py: 8, color: 'text.disabled' }}>
          <AutoAwesomeIcon sx={{ fontSize: 48, mb: 2 }} />
          <Typography variant="body2">
            {skills.length === 0
              ? '还没有 Skill，点击"新建"创建或去 AI 助手生成'
              : '没有匹配的 Skill'}
          </Typography>
        </Stack>
      ) : (
        <Grid container spacing={2}>
          {filtered.map(skill => (
            <Grid size={6} key={skill.meta.id}>
              <SkillCard
                skill={skill}
                onExecute={handleExecute}
                onEdit={handleEdit}
                onDelete={deleteSkill}
              />
            </Grid>
          ))}
        </Grid>
      )}

      {editorOpen && (
        <SkillEditor
          skill={editingSkill}
          onSave={async (s) => { await saveSkill(s); setEditorOpen(false) }}
          onClose={() => setEditorOpen(false)}
        />
      )}
    </Box>
  )
}
