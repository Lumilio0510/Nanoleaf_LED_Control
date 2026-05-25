import { useState, useEffect } from 'react'
import CheckIcon from '@mui/icons-material/Check'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import TextField from '@mui/material/TextField'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
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
    setConfig({
      ...config,
      provider,
      baseUrl: defaults[provider].baseUrl || '',
      model: defaults[provider].model || '',
    })
  }

  async function handleSave() {
    await api.saveLlmConfig(config)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <Card>
      <CardHeader title="LLM 模型配置" slotProps={{ title: { variant: 'h6' } }} />
      <CardContent sx={{ pt: 0 }}>
        <Stack spacing={3}>
          <FormControl size="small" fullWidth>
            <InputLabel>模型类型</InputLabel>
            <Select
              label="模型类型"
              value={config.provider}
              onChange={e => updateProvider(e.target.value as LLMProvider)}
            >
              <MenuItem value="openai">OpenAI / 兼容 API</MenuItem>
              <MenuItem value="ollama">Ollama（本地）</MenuItem>
            </Select>
          </FormControl>

          <TextField
            size="small"
            fullWidth
            label="API 端点"
            value={config.baseUrl}
            onChange={e => setConfig({ ...config, baseUrl: e.target.value })}
            placeholder={defaults[config.provider].baseUrl || ''}
          />

          <TextField
            size="small"
            fullWidth
            label="模型名称"
            value={config.model}
            onChange={e => setConfig({ ...config, model: e.target.value })}
            placeholder={defaults[config.provider].model || ''}
          />

          {config.provider === 'openai' && (
            <TextField
              size="small"
              fullWidth
              type="password"
              label="API Key"
              value={config.apiKey}
              onChange={e => setConfig({ ...config, apiKey: e.target.value })}
              placeholder="sk-..."
            />
          )}
        </Stack>

        <Button variant="contained" onClick={handleSave} sx={{ mt: 3 }}>
          {saved ? <><CheckIcon sx={{ fontSize: 16, mr: 0.5 }} />已保存</> : '保存配置'}
        </Button>
      </CardContent>
    </Card>
  )
}
