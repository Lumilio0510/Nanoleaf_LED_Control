import { useState } from 'react'
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
    <div className="flex h-screen flex-col bg-gray-950 text-gray-100">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar current={page} onNavigate={setPage} />
        <main className="flex-1 overflow-auto p-6">
          {page === 'control' && <ControlPanel />}
          {page === 'skills' && <SkillLibrary />}
          {page === 'agent' && <AgentChat />}
          {page === 'settings' && <SettingsPage />}
        </main>
      </div>
      <StatusBar />
    </div>
  )
}
