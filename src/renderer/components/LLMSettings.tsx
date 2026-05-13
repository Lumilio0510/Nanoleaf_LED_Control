import { useState, useEffect } from 'react'
import { api } from '../api'
import type { LLMConfig, LLMProvider } from '../types'

const defaults: Record<LLMProvider, Partial<LLMConfig>> = {
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o' },
  ollama: { baseUrl: 'http://localhost:11434', model: 'llama3' },
}

export default function LLMSettings() {
  const [config, setConfig] = useState<LLMConfig>({ provider: 'openai', apiKey: '', baseUrl: '', model: '' })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api.getLlmConfig().then(setConfig)
  }, [])

  function updateProvider(provider: LLMProvider) {
    setConfig({ ...config, provider, baseUrl: defaults[provider].baseUrl || '', model: defaults[provider].model || '' })
  }

  async function handleSave() {
    await api.saveLlmConfig(config)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">LLM 模型配置</h3>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-gray-500">模型类型</label>
          <select
            className="w-full mt-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
            value={config.provider}
            onChange={e => updateProvider(e.target.value as LLMProvider)}
          >
            <option value="openai">OpenAI / 兼容 API</option>
            <option value="ollama">Ollama（本地）</option>
          </select>
        </div>

        <div>
          <label className="text-xs text-gray-500">API 端点</label>
          <input
            className="w-full mt-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
            value={config.baseUrl}
            onChange={e => setConfig({ ...config, baseUrl: e.target.value })}
            placeholder={defaults[config.provider].baseUrl || ''}
          />
        </div>

        <div>
          <label className="text-xs text-gray-500">模型名称</label>
          <input
            className="w-full mt-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
            value={config.model}
            onChange={e => setConfig({ ...config, model: e.target.value })}
            placeholder={defaults[config.provider].model || ''}
          />
        </div>

        {config.provider === 'openai' && (
          <div>
            <label className="text-xs text-gray-500">API Key</label>
            <input
              type="password"
              className="w-full mt-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
              value={config.apiKey}
              onChange={e => setConfig({ ...config, apiKey: e.target.value })}
              placeholder="sk-..."
            />
          </div>
        )}
      </div>

      <button onClick={handleSave} className="mt-4 px-4 py-2 text-sm bg-cyan-600 rounded hover:bg-cyan-500">
        {saved ? '已保存' : '保存配置'}
      </button>
    </div>
  )
}
