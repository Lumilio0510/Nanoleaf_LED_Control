import { useState, useEffect, useMemo } from 'react'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import SearchIcon from '@mui/icons-material/Search'
import AddIcon from '@mui/icons-material/Add'
import Paper from '@mui/material/Paper'
import { api } from '../api'
import { useDeviceStatus, useSavedDevices, useScan, useOnlineStatus } from '../hooks/useDevices'
import AuthDialog from './AuthDialog'
import type { DeviceConfig } from '../types'

const statusColor: Record<string, 'default' | 'success' | 'warning' | 'error'> = {
  disconnected: 'default',
  connecting: 'warning',
  connected: 'success',
  auth_required: 'warning',
  error: 'error',
}

const statusLabel: Record<string, string> = {
  disconnected: '未连接',
  connecting: '连接中',
  connected: '已连接',
  auth_required: '需认证',
  error: '错误',
}

export default function DeviceConnector() {
  const state = useDeviceStatus()
  const { devices, refresh } = useSavedDevices()
  const { scan, scanning, found, setFound } = useScan()
  const onlineStatus = useOnlineStatus()
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newHost, setNewHost] = useState('')
  const [newPort, setNewPort] = useState('16021')
  const [newNote, setNewNote] = useState('')
  const [showAuth, setShowAuth] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  useEffect(() => {
    api.getLocalIP().then(ip => setNewHost(ip))
  }, [])

  // Local dedup of found devices by name (safety net)
  const uniqueFound = useMemo(() => {
    const seen = new Set<string>()
    return found.filter(f => {
      const key = f.name && !f.name.startsWith('Nanoleaf-') ? f.name : `${f.host}:${f.port}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [found])

  async function handleConnect(id: string) { await api.connect(id) }
  async function handleDisconnect() { await api.disconnect() }

  async function handleAdd() {
    try {
      const config: DeviceConfig = {
        id: crypto.randomUUID(),
        name: newName || newHost,
        host: newHost,
        port: parseInt(newPort) || 16021,
        note: newNote
      }
      await api.addDevice(config)
      refresh()
      setShowAdd(false)
      setNewName(''); setNewHost(''); setNewPort('16021'); setNewNote('')
      await api.connect(config.id)
    } catch (e) {
      console.error('添加设备失败:', e)
    }
  }

  async function handleAddFound(host: string, port: number, name?: string) {
    try {
      const existing = devices.find(d => (name && d.name === name) || (d.host === host && d.port === port))
      const config: DeviceConfig = {
        id: existing?.id || crypto.randomUUID(),
        name: name || host,
        host,
        port,
        note: ''
      }
      if (existing?.authToken) config.authToken = existing.authToken
      await api.addDevice(config)
      refresh()
      setFound(prev => prev.filter(f => !(f.host === host && f.port === port)))
      await api.connect(config.id)
    } catch (e) {
      console.error('添加设备失败:', e)
    }
  }

  async function handleRemove(id: string) {
    await api.removeDevice(id)
    refresh()
  }

  function startRename(d: DeviceConfig) {
    setEditingId(d.id)
    setEditName(d.name)
  }

  async function commitRename() {
    if (editingId && editName.trim()) {
      await api.renameDevice(editingId, editName.trim())
      refresh()
    }
    setEditingId(null)
    setEditName('')
  }

  function cancelRename() {
    setEditingId(null)
    setEditName('')
  }

  async function handleAuth() {
    setShowAuth(true)
  }

  async function handleAuthSuccess() {
    setShowAuth(false)
    if (state.config) {
      await api.connect(state.config.id)
    }
  }

  function handleAuthCancel() {
    setShowAuth(false)
  }

  return (
    <Card sx={{ mb: 2.5 }}>
      <CardHeader
        title="设备连接"
        slotProps={{ title: { variant: 'h6' } }}
        action={
          <Stack direction="row" spacing={0.5}>
            <Button
              variant="text"
              size="small"
              onClick={scan}
              disabled={scanning}
              sx={{ color: 'text.secondary', minWidth: 'auto' }}
            >
              {scanning ? <><CircularProgress size={14} sx={{ mr: 0.5 }} />扫描中...</> : <><SearchIcon sx={{ fontSize: 16, mr: 0.5 }} />扫描</>}
            </Button>
            <Button
              variant="text"
              size="small"
              onClick={async () => {
                const ip = await api.getLocalIP()
                setNewHost(ip)
                setShowAdd(!showAdd)
              }}
              sx={{ color: 'text.secondary', minWidth: 'auto' }}
            >
              <AddIcon sx={{ fontSize: 16, mr: 0.5 }} />手动添加
            </Button>
          </Stack>
        }
      />
      <CardContent sx={{ pt: 0 }}>
        {/* Connected device status bar */}
        {state.config && (state.status === 'connected' || state.status === 'connecting') && (
          <Paper
            variant="outlined"
            sx={{
              p: 1.5,
              mb: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              bgcolor: state.status === 'connected' ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)',
              borderColor: state.status === 'connected' ? 'success.main' : 'warning.main',
              borderRadius: 2,
            }}
          >
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {state.config.name}
              </Typography>
              <Typography variant="caption" color="text.disabled">
                {state.config.host}:{state.config.port}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Chip
                size="small"
                label={statusLabel[state.status] || state.status}
                color={statusColor[state.status] || 'default'}
                sx={{ fontSize: '0.65rem', height: 20 }}
              />
              <Button
                variant="text"
                size="small"
                onClick={() => api.identify().catch(() => {})}
                sx={{ color: 'primary.main', minWidth: 'auto', fontSize: '0.75rem' }}
              >
                识别
              </Button>
              <Button
                variant="text"
                size="small"
                onClick={handleDisconnect}
                sx={{ color: 'error.main', minWidth: 'auto', fontSize: '0.75rem' }}
              >
                断开
              </Button>
            </Stack>
          </Paper>
        )}

        {/* Auth required / Error state */}
        {state.config && (state.status === 'auth_required' || state.status === 'error') && (
          <Paper
            variant="outlined"
            sx={{
              p: 1.5,
              mb: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              bgcolor: 'rgba(239,68,68,0.06)',
              borderColor: 'error.main',
              borderRadius: 2,
            }}
          >
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {state.config.name}
              </Typography>
              <Typography variant="caption" color="error.main">
                {state.errorMessage || '需要认证'}
              </Typography>
            </Box>
            <Button
              variant="contained"
              size="small"
              color="warning"
              onClick={handleAuth}
              sx={{ fontSize: '0.75rem' }}
            >
              {state.config.authToken ? '重新认证' : '认证'}
            </Button>
          </Paper>
        )}

        {/* Found devices */}
        {uniqueFound.length > 0 && (
          <Box sx={{ mb: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 2, border: 1, borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
              发现的设备
            </Typography>
            {uniqueFound.map(f => (
              <Stack key={f.host} direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', py: 0.75 }}>
                <Typography variant="body2">{f.name || f.host}:{f.port}</Typography>
                <Button
                  size="small"
                  variant="text"
                  onClick={() => handleAddFound(f.host, f.port, f.name)}
                  sx={{ color: 'primary.main', fontSize: '0.75rem', fontWeight: 500, minWidth: 'auto' }}
                >
                  保存
                </Button>
              </Stack>
            ))}
          </Box>
        )}

        {/* Manual add form */}
        {showAdd && (
          <Stack spacing={1.5} sx={{ mb: 2, p: 2, bgcolor: 'action.hover', borderRadius: 3, border: 1, borderColor: 'divider' }}>
            <TextField
              size="small"
              fullWidth
              placeholder="设备名称"
              value={newName}
              onChange={e => setNewName(e.target.value)}
            />
            <Stack direction="row" spacing={1}>
              <TextField
                size="small"
                placeholder="IP 地址"
                value={newHost}
                onChange={e => setNewHost(e.target.value)}
                sx={{ flex: 1 }}
              />
              <TextField
                size="small"
                placeholder="端口"
                value={newPort}
                onChange={e => setNewPort(e.target.value)}
                sx={{ width: 96 }}
              />
            </Stack>
            <TextField
              size="small"
              fullWidth
              placeholder="备注（可选）"
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
            />
            <Stack direction="row" spacing={1}>
              <Button variant="contained" size="small" onClick={handleAdd} disabled={!newHost}>
                保存设备
              </Button>
              <Button variant="outlined" color="secondary" size="small" onClick={() => setShowAdd(false)}>
                取消
              </Button>
            </Stack>
          </Stack>
        )}

        {/* Saved devices list */}
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
          已保存设备
        </Typography>

        {devices.length === 0 ? (
          <Typography variant="body2" color="text.disabled" sx={{ py: 3, textAlign: 'center' }}>
            暂无设备，请扫描网络或手动添加
          </Typography>
        ) : (
          <Stack spacing={0.75}>
            {devices.map(d => {
              const isOnline = onlineStatus[d.id]
              const isActive = state.config?.id === d.id && state.status === 'connected'

              return (
                <Paper
                  key={d.id}
                  variant="outlined"
                  sx={{
                    p: 1.5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    bgcolor: isActive ? 'rgba(16,185,129,0.06)' : 'action.hover',
                    borderColor: isActive ? 'success.main' : 'divider',
                    borderRadius: 2,
                    '&:hover': { borderColor: isActive ? 'success.main' : 'grey.400' },
                    transition: 'border-color 0.15s',
                  }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', mb: 0.25 }}>
                      {editingId === d.id ? (
                        <TextField
                          size="small"
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') commitRename()
                            if (e.key === 'Escape') cancelRename()
                          }}
                          onBlur={commitRename}
                          autoFocus
                          sx={{ '& .MuiInputBase-root': { fontSize: '0.875rem', fontWeight: 500 } }}
                        />
                      ) : (
                        <Typography
                          variant="body2"
                          sx={{ fontWeight: 500, cursor: 'pointer', '&:hover': { color: 'primary.main' } }}
                          onClick={() => startRename(d)}
                        >
                          {d.name}
                        </Typography>
                      )}
                      {isOnline !== undefined && (
                        <Chip
                          size="small"
                          label={isOnline ? '在线' : '离线'}
                          color={isOnline ? 'success' : 'default'}
                          variant="outlined"
                          sx={{ fontSize: '0.6rem', height: 18 }}
                        />
                      )}
                      {isActive && (
                        <Chip
                          size="small"
                          label="已连接"
                          color="success"
                          sx={{ fontSize: '0.6rem', height: 18 }}
                        />
                      )}
                    </Stack>
                    <Typography variant="caption" color="text.disabled">
                      {d.host}:{d.port}
                      {d.authToken ? (
                        <Chip size="small" label="已认证" color="success" variant="outlined" sx={{ ml: 0.75, fontSize: '0.6rem', height: 18 }} />
                      ) : (
                        <Chip size="small" label="未认证" color="default" variant="outlined" sx={{ ml: 0.75, fontSize: '0.6rem', height: 18 }} />
                      )}
                      {d.note && <span> — {d.note}</span>}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={0.5}>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => handleConnect(d.id)}
                      disabled={isActive}
                      sx={{
                        fontSize: '0.75rem',
                        px: 2,
                        py: 0.5,
                        minWidth: 'auto',
                        ...(isActive ? {} : {
                          borderColor: 'primary.main',
                          color: 'primary.main',
                          '&:hover': { bgcolor: 'rgba(16,185,129,0.08)', borderColor: 'primary.main' },
                        }),
                      }}
                    >
                      {isActive ? '已连接' : '连接'}
                    </Button>
                    <Button
                      variant="text"
                      size="small"
                      onClick={() => handleRemove(d.id)}
                      sx={{ color: 'text.disabled', fontSize: '0.75rem', minWidth: 'auto', '&:hover': { color: 'error.main' } }}
                    >
                      删除
                    </Button>
                  </Stack>
                </Paper>
              )
            })}
          </Stack>
        )}

        {showAuth && state.config && (
          <AuthDialog
            deviceId={state.config.id}
            host={`${state.config.host}:${state.config.port}`}
            onSuccess={handleAuthSuccess}
            onCancel={handleAuthCancel}
          />
        )}
      </CardContent>
    </Card>
  )
}
