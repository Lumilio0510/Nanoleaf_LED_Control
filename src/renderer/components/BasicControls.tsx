import { useState } from 'react'
import { api } from '../api'

export default function BasicControls() {
  const [powerOn, setPowerOn] = useState(false)
  const [brightness, setBrightness] = useState(80)
  const [color, setColor] = useState('#00ffff')

  async function togglePower() {
    const next = !powerOn
    await api.switchLight(next)
    setPowerOn(next)
  }

  async function handleBrightness(v: number) {
    setBrightness(v)
    await api.setBrightness(v)
  }

  async function handleColor(hex: string) {
    setColor(hex)
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    await api.setColor(r, g, b)
  }

  return (
    <div className="mb-6 bg-gray-900 rounded-lg border border-gray-800 p-4">
      <h2 className="text-sm font-semibold text-gray-300 mb-3">基础控制</h2>
      <div className="flex items-center gap-6 flex-wrap">
        <button
          onClick={togglePower}
          className={`px-5 py-2.5 rounded text-sm font-medium ${powerOn ? 'bg-cyan-600 text-white' : 'bg-gray-700 text-gray-400'}`}
        >
          ⏻ {powerOn ? '开' : '关'}
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 w-10">亮度</span>
          <input
            type="range" min="0" max="100" value={brightness}
            onChange={e => handleBrightness(Number(e.target.value))}
            className="w-32 accent-cyan-500"
          />
          <span className="text-xs text-gray-400 w-8">{brightness}%</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">颜色</span>
          <input
            type="color" value={color}
            onChange={e => handleColor(e.target.value)}
            className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
          />
          <span className="text-xs text-gray-400 font-mono">{color}</span>
        </div>
      </div>
    </div>
  )
}
