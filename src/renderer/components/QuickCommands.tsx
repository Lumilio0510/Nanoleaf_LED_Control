import { useState, useEffect } from 'react'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import { api } from '../api'
import type { QuickCommand } from '../types'

interface Props {
  onExecute: (prompt: string) => void
}

export default function QuickCommands({ onExecute }: Props) {
  const [commands, setCommands] = useState<QuickCommand[]>([])

  useEffect(() => {
    api.listCommands().then(setCommands)
  }, [])

  if (commands.length === 0) return null

  return (
    <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
      {commands.map(cmd => (
        <Chip
          key={cmd.id}
          label={cmd.label}
          onClick={() => onExecute(cmd.prompt)}
          variant="outlined"
          size="small"
          sx={{
            borderRadius: 4,
            borderColor: 'divider',
            color: 'text.secondary',
            bgcolor: 'background.paper',
            '&:hover': { bgcolor: 'action.hover', color: 'text.primary', borderColor: 'grey.300' },
          }}
        />
      ))}
    </Stack>
  )
}
