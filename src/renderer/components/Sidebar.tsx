type Page = 'control' | 'skills' | 'agent' | 'settings'

const items: { key: Page; label: string; icon: string }[] = [
  { key: 'control', label: '控制面板', icon: '◉' },
  { key: 'skills', label: 'Skill 库', icon: '📚' },
  { key: 'agent', label: 'AI 助手', icon: '💬' },
  { key: 'settings', label: '设置', icon: '⚙' },
]

export default function Sidebar({ current, onNavigate }: { current: Page; onNavigate: (p: Page) => void }) {
  return (
    <aside className="w-48 border-r border-gray-800 bg-gray-900 flex flex-col py-4">
      <h1 className="px-4 mb-6 text-sm font-bold text-cyan-400 tracking-wide">LED CONTROL</h1>
      {items.map(item => (
        <button
          key={item.key}
          onClick={() => onNavigate(item.key)}
          className={`px-4 py-2.5 text-left text-sm transition-colors ${
            current === item.key
              ? 'bg-gray-800 text-cyan-400 border-r-2 border-cyan-400'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
          }`}
        >
          <span className="mr-2">{item.icon}</span>
          {item.label}
        </button>
      ))}
    </aside>
  )
}
