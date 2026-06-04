import { useState, useRef, useEffect } from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import CheckIcon from '@mui/icons-material/Check'
import ExtensionIcon from '@mui/icons-material/Extension'
import SaveAltIcon from '@mui/icons-material/SaveAlt'
import { keyframes } from '@mui/system'
import { api } from '../api'
import type { ChatMessage } from '../types'
import EffectCard from './EffectCard'
import MarkdownContent from './MarkdownContent'

interface ToolStatus {
  id: string
  name: string
  status: 'running' | 'done' | 'error'
  error?: string
}

const blink = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
`

function toolLabel(name: string): string {
  const labels: Record<string, string> = {
    setPower: '开关灯', setBrightness: '调节亮度', setColor: '设置颜色', setColorTemp: '设置色温',
    getDeviceInfo: '获取设备信息', getDeviceState: '查询状态', getPanelLayout: '获取面板布局',
    listEffects: '列出特效', getCurrentEffect: '查询当前特效', selectEffect: '切换特效',
    deleteEffect: '删除特效', renameEffect: '重命名特效',
    createEffect: '创建灯效', previewEffect: '预览灯效',
    identifyDevice: '识别设备', discoverDevices: '扫描设备'
  }
  return labels[name] || name
}

function SkillInlinePreview({ skill }: { skill: { meta: { id: string; name: string }; params: unknown[] } }) {
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    await api.saveSkill(skill as never)
    setSaved(true)
  }

  if (saved) {
    return (
      <>
        <Divider sx={{ my: 1 }} />
        <Typography variant="caption" color="primary.dark" sx={{ fontWeight: 500 }}>
          <CheckIcon sx={{ fontSize: 14, mr: 0.25, verticalAlign: 'text-bottom' }} />已保存到 Skill 库
        </Typography>
      </>
    )
  }

  return (
    <>
      <Divider sx={{ my: 1 }} />
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
        <Typography variant="caption" color="text.secondary">
          <ExtensionIcon sx={{ fontSize: 14, mr: 0.25, verticalAlign: 'text-bottom' }} />{skill.meta.name}
        </Typography>
        <Button
          size="small"
          variant="text"
          onClick={handleSave}
          sx={{
            fontSize: '0.7rem',
            py: 0,
            px: 1,
            minWidth: 'auto',
            bgcolor: 'rgba(16,185,129,0.08)',
            color: 'primary.dark',
            '&:hover': { bgcolor: 'rgba(16,185,129,0.15)' },
          }}
        >
          <SaveAltIcon sx={{ fontSize: 14, mr: 0.25 }} />保存到 Skill 库
        </Button>
      </Stack>
    </>
  )
}

function ToolCallResult({ name, args, result, error }: {
  name: string
  args: Record<string, unknown>
  result?: unknown
  error?: string
}) {
  if (error) {
    return (
      <Typography variant="caption" color="error.main">
        ❌ {toolLabel(name)} 失败: {error}
      </Typography>
    )
  }

  // Render rich EffectCard for createEffect
  if (name === 'createEffect' && args.effectDefinition) {
    const def = args.effectDefinition as Record<string, unknown>
    return <EffectCard effectDef={def} />
  }

  return (
    <Typography variant="caption" color="text.secondary">
      ✅ {toolLabel(name)}
    </Typography>
  )
}

export default function ChatWindow({ messages, streaming, toolStatuses }: { messages: ChatMessage[]; streaming: string; toolStatuses: ToolStatus[] }) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streaming, toolStatuses])

  return (
    <Paper
      variant="outlined"
      sx={{
        flex: 1,
        overflow: 'auto',
        mb: 2,
        p: 2,
        bgcolor: 'background.paper',
      }}
    >
      {messages.length === 0 && !streaming && (
        <Stack sx={{ alignItems: 'center', justifyContent: 'center', height: '100%', color: 'text.disabled' }}>
          <SmartToyIcon sx={{ fontSize: 40, mb: 1.5 }} />
          <Typography variant="body2">开始对话，描述你想要的灯效</Typography>
        </Stack>
      )}
      {messages.map(msg => (
        <Box key={msg.id}>
          <Stack direction={msg.role === 'user' ? 'row-reverse' : 'row'} sx={{ mb: 2 }}>
            <Paper
              sx={{
                maxWidth: '80%',
                px: 2,
                py: 1.25,
                borderRadius: 3,
                ...(msg.role === 'user'
                  ? { bgcolor: 'primary.main', color: 'white' }
                  : { variant: 'outlined', bgcolor: 'action.hover' }
                ),
              }}
            >
              <MarkdownContent content={msg.content} variant={msg.role === 'user' ? 'user' : 'assistant'} />
              {msg.skill && <SkillInlinePreview skill={msg.skill} />}
              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <>
                  <Divider sx={{ my: 0.5 }} />
                  <Stack spacing={0.5}>
                    {msg.toolCalls.map(tc => (
                      <ToolCallResult
                        key={tc.id}
                        name={tc.name}
                        args={tc.arguments}
                        result={tc.result}
                        error={tc.error}
                      />
                    ))}
                  </Stack>
                </>
              )}
            </Paper>
          </Stack>
        </Box>
      ))}
      {toolStatuses.length > 0 && (
        <Stack direction="row" sx={{ mb: 2 }}>
          <Paper variant="outlined" sx={{ maxWidth: '80%', px: 2, py: 1, borderRadius: 3, bgcolor: 'primary.light', color: 'white' }}>
            {toolStatuses.map(ts => (
              <Typography key={ts.id} variant="caption" sx={{ display: 'block' }}>
                {ts.status === 'running' && `⏳ ${toolLabel(ts.name)}...`}
                {ts.status === 'done' && `✅ ${toolLabel(ts.name)} 完成`}
                {ts.status === 'error' && `❌ ${toolLabel(ts.name)} 失败: ${ts.error}`}
              </Typography>
            ))}
          </Paper>
        </Stack>
      )}
      {streaming && (
        <Stack direction="row">
          <Paper
            variant="outlined"
            sx={{
              maxWidth: '80%',
              px: 2,
              py: 1.25,
              borderRadius: 3,
              bgcolor: 'action.hover',
            }}
          >
            <Box sx={{ position: 'relative' }}>
              <MarkdownContent content={streaming} variant="assistant" />
              <Box
                component="span"
                sx={{
                  display: 'inline-block',
                  width: 3,
                  height: 16,
                  bgcolor: 'primary.main',
                  verticalAlign: 'middle',
                  animation: `${blink} 1s step-end infinite`,
                }}
              />
            </Box>
          </Paper>
        </Stack>
      )}
      <Box ref={bottomRef} />
    </Paper>
  )
}
