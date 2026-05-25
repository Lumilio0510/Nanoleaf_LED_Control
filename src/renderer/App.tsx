import { useState } from 'react'
import Box from '@mui/material/Box'
import Sidebar from './components/Sidebar'
import StatusBar from './components/StatusBar'
import ControlPanel from './components/ControlPanel'
import SkillLibrary from './components/SkillLibrary'
import AgentChat from './components/AgentChat'
import SettingsPage from './components/SettingsPage'

type Page = 'control' | 'skills' | 'agent' | 'settings'

export default function App() {
  const [page, setPage] = useState<Page>('control')

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: 'background.default' }}>
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar current={page} onNavigate={setPage} />
        <Box component="main" sx={{ flex: 1, overflow: 'auto', p: 3 }}>
          {page === 'control' && <ControlPanel />}
          {page === 'skills' && <SkillLibrary />}
          {page === 'agent' && <AgentChat />}
          {page === 'settings' && <SettingsPage />}
        </Box>
      </Box>
      <StatusBar />
    </Box>
  )
}
