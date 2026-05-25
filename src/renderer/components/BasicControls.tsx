import { useState, useEffect, useRef } from 'react'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Switch from '@mui/material/Switch'
import Slider from '@mui/material/Slider'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Alert from '@mui/material/Alert'
import FormControlLabel from '@mui/material/FormControlLabel'
import { api } from '../api'
import { useDeviceStatus } from '../hooks/useDevices'

export default function BasicControls() {
  const device = useDeviceStatus()
  const [powerOn, setPowerOn] = useState(false)
  const [brightness, setBrightness] = useState(80)
  const [color, setColor] = useState('#00ffff')
  const [colorTemp, setColorTemp] = useState(4000)
  const [showCT, setShowCT] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isConnected = device.status === 'connected'
  const brightnessTimer = useRef<ReturnType<typeof setTimeout>>()
  const ctTimer = useRef<ReturnType<typeof setTimeout>>()

  // Debounced brightness API call
  useEffect(() => {
    if (!isConnected) return
    brightnessTimer.current = setTimeout(async () => {
      setError(null)
      try {
        await api.setBrightness(brightness)
      } catch (e) {
        setError(e instanceof Error ? e.message : '设置亮度失败')
      }
    }, 200)
    return () => clearTimeout(brightnessTimer.current)
  }, [brightness])

  // Debounced color temperature API call
  useEffect(() => {
    if (!isConnected || !showCT) return
    ctTimer.current = setTimeout(async () => {
      setError(null)
      try {
        await api.setColorTemperature(colorTemp)
      } catch (e) {
        setError(e instanceof Error ? e.message : '设置色温失败')
      }
    }, 200)
    return () => clearTimeout(ctTimer.current)
  }, [colorTemp])

  async function togglePower() {
    if (!isConnected) {
      setError('请先连接设备')
      return
    }
    setError(null)
    try {
      const next = !powerOn
      await api.switchLight(next)
      setPowerOn(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : '开关操作失败')
    }
  }

  function handleBrightness(_e: Event, v: number | number[]) {
    setBrightness(v as number)
  }

  async function handleColor(hex: string) {
    setColor(hex)
    if (!isConnected) return
    setError(null)
    try {
      const r = parseInt(hex.slice(1, 3), 16)
      const g = parseInt(hex.slice(3, 5), 16)
      const b = parseInt(hex.slice(5, 7), 16)
      await api.setColor(r, g, b)
    } catch (e) {
      setError(e instanceof Error ? e.message : '设置颜色失败')
    }
  }

  function handleCT(_e: Event, v: number | number[]) {
    setColorTemp(v as number)
  }

  return (
    <Card sx={{ mb: 2.5 }}>
      <CardHeader title="基础控制" slotProps={{ title: { variant: 'h6' } }} />
      <CardContent sx={{ pt: 0 }}>
        {!isConnected && (
          <Alert severity="warning" sx={{ mb: 1.5, fontSize: '0.75rem', py: 0 }}>
            未连接设备，请先在"设备连接"中选择并连接设备
          </Alert>
        )}

        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 1.5, fontSize: '0.75rem', py: 0 }}>
            {error}
          </Alert>
        )}

        <Stack direction="row" sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
          <FormControlLabel
            control={<Switch checked={powerOn} onChange={togglePower} disabled={!isConnected} />}
            label={powerOn ? '开' : '关'}
            sx={{ m: 0 }}
          />

          <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5, minWidth: 180 }}>
            <Typography variant="caption" color="text.secondary" sx={{ width: 32 }}>
              亮度
            </Typography>
            <Slider
              min={0}
              max={100}
              value={brightness}
              onChange={handleBrightness}
              disabled={!isConnected}
              size="small"
              sx={{ flex: 1 }}
            />
            <Typography variant="caption" color="text.disabled" sx={{ width: 36, textAlign: 'right', fontFamily: 'monospace' }}>
              {brightness}%
            </Typography>
          </Stack>

          <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5 }}>
            <Typography variant="caption" color="text.secondary">
              颜色
            </Typography>
            <Box
              component="input"
              type="color"
              value={color}
              disabled={!isConnected}
              onChange={e => handleColor(e.target.value)}
              sx={{
                width: 28,
                height: 28,
                borderRadius: 1,
                cursor: 'pointer',
                border: 0,
                bgcolor: 'transparent',
                opacity: isConnected ? 1 : 0.4,
                p: 0,
              }}
            />
            <Typography variant="caption" color="text.disabled" sx={{ fontFamily: 'monospace', textTransform: 'uppercase' }}>
              {color}
            </Typography>
          </Stack>

          <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={showCT}
                  onChange={() => setShowCT(!showCT)}
                  disabled={!isConnected}
                  size="small"
                />
              }
              label="色温"
              sx={{ m: 0 }}
            />
            {showCT && (
              <>
                <Slider
                  min={1200}
                  max={6500}
                  step={100}
                  value={colorTemp}
                  onChange={handleCT}
                  disabled={!isConnected}
                  size="small"
                  sx={{ width: 120 }}
                />
                <Typography variant="caption" color="text.disabled" sx={{ fontFamily: 'monospace', width: 36 }}>
                  {colorTemp}K
                </Typography>
              </>
            )}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  )
}
