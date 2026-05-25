import Button from '@mui/material/Button'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import CloseIcon from '@mui/icons-material/Close'
import AddIcon from '@mui/icons-material/Add'
import type { ChatSession } from '../types'

interface Props {
  sessions: ChatSession[]
  currentId: string
  onSwitch: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
}

export default function SessionManager({ sessions, currentId, onSwitch, onNew, onDelete }: Props) {
  const currentIndex = sessions.findIndex(s => s.id === currentId)

  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1.5 }}>
      <Button
        variant="contained"
        size="small"
        startIcon={<AddIcon />}
        onClick={onNew}
        sx={{ fontSize: '0.75rem', px: 1.5, py: 0.75, minWidth: 'auto', flexShrink: 0 }}
      >
        新建会话
      </Button>
      <Tabs
        value={currentIndex >= 0 ? currentIndex : 0}
        onChange={(_e, v) => onSwitch(sessions[v]?.id)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          flex: 1,
          minHeight: 0,
          '& .MuiTabs-indicator': { display: 'none' },
        }}
      >
        {sessions.map(s => (
          <Tab
            key={s.id}
            label={
              <Stack direction="row" sx={{ alignItems: 'center', gap: 0.5 }}>
                <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.title || '新会话'}
                </span>
                <IconButton
                  size="small"
                  component="span"
                  onClick={(e) => { e.stopPropagation(); onDelete(s.id) }}
                  sx={{ p: 0, '&:hover': { color: 'error.main' } }}
                >
                  <CloseIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Stack>
            }
            sx={{
              fontSize: '0.75rem',
              minHeight: 0,
              py: 0.75,
              px: 1.5,
              borderRadius: 2,
              border: 1,
              borderColor: 'divider',
              mr: 0.5,
              '&.Mui-selected': {
                bgcolor: 'action.hover',
                color: 'text.primary',
                fontWeight: 500,
              },
              '&:not(.Mui-selected)': {
                color: 'text.secondary',
                bgcolor: 'background.paper',
              },
            }}
          />
        ))}
      </Tabs>
    </Stack>
  )
}
