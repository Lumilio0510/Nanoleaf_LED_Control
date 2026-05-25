import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import DeviceSettings from './DeviceSettings'
import LLMSettings from './LLMSettings'

export default function SettingsPage() {
  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3 }}>设置</Typography>
      <Stack spacing={2.5}>
        <DeviceSettings />
        <LLMSettings />
      </Stack>
    </Box>
  )
}
