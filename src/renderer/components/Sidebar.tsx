import Paper from '@mui/material/Paper'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import CircleIcon from '@mui/icons-material/Circle'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import SettingsIcon from '@mui/icons-material/Settings'

type Page = 'control' | 'skills' | 'agent' | 'settings'

const items: { key: Page; label: string; icon: React.ReactNode }[] = [
  { key: 'control', label: '控制面板', icon: <CircleIcon sx={{ fontSize: 16 }} /> },
  { key: 'skills', label: 'Skill 库', icon: <AutoAwesomeIcon sx={{ fontSize: 16 }} /> },
  { key: 'agent', label: 'AI 助手', icon: <SmartToyIcon sx={{ fontSize: 16 }} /> },
  { key: 'settings', label: '设置', icon: <SettingsIcon sx={{ fontSize: 16 }} /> },
]

export default function Sidebar({ current, onNavigate }: { current: Page; onNavigate: (p: Page) => void }) {
  return (
    <Paper
      square
      elevation={0}
      sx={{
        width: 200,
        borderRight: 1,
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        py: 2.5,
      }}
    >
      <Box sx={{ px: 2.5, mb: 4 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, letterSpacing: '0.05em' }}>
          LED CONTROL
        </Typography>
      </Box>
      <List component="nav" sx={{ px: 1.5, py: 0 }}>
        {items.map(item => {
          const active = current === item.key
          return (
            <ListItemButton
              key={item.key}
              onClick={() => onNavigate(item.key)}
              sx={{
                borderRadius: 2,
                mb: 0.25,
                py: 1.25,
                px: 1.5,
                bgcolor: active ? 'action.hover' : 'transparent',
                color: active ? 'text.primary' : 'text.secondary',
                fontWeight: active ? 500 : 400,
                '&:hover': {
                  bgcolor: active ? 'action.hover' : 'action.hover',
                  opacity: active ? 1 : 0.7,
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 36, color: 'inherit' }}>{item.icon}</ListItemIcon>
              <ListItemText
                primary={item.label}
                slotProps={{ primary: { variant: 'body2', fontWeight: 'inherit' } }}
              />
            </ListItemButton>
          )
        })}
      </List>
    </Paper>
  )
}
