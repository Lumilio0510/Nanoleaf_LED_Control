import { useState } from 'react'
import Box from '@mui/material/Box'
import Sidebar from './components/Sidebar'
import StatusBar from './components/StatusBar'
import ControlPanel from './components/ControlPanel'
import SkillLibrary from './components/SkillLibrary'
import AgentChat from './components/AgentChat'
import SettingsPage from './components/SettingsPage'
import CanvasPage from './components/CanvasPage'

type Page = 'control' | 'skills' | 'agent' | 'settings' | 'canvas'

export default function App() {
  const [page, setPage] = useState<Page>('control')

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: 'background.default' }}>
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar current={page} onNavigate={setPage} />
        <Box component="main" sx={{ flex: 1, overflow: 'auto', p: page === 'canvas' ? 0 : 3 }}>
          {page === 'control' && <ControlPanel />}
          {page === 'skills' && <SkillLibrary />}
          {page === 'agent' && <AgentChat />}
          {page === 'settings' && <SettingsPage />}
          {page === 'canvas' && <CanvasPage />}
        </Box>
      </Box>
      <StatusBar />
    </Box>
  )
}
