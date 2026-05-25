import { useState, useRef } from 'react'
import TextField from '@mui/material/TextField'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import SendIcon from '@mui/icons-material/Send'

interface Props {
  onSend: (text: string) => void
  disabled: boolean
}

export default function ChatInput({ onSend, disabled }: Props) {
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function handleSend() {
    if (!text.trim() || disabled) return
    onSend(text.trim())
    setText('')
    inputRef.current?.focus()
  }

  return (
    <Stack direction="row" spacing={1}>
      <TextField
        inputRef={inputRef}
        fullWidth
        size="small"
        placeholder="描述你想要的灯效..."
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleSend() }}
        disabled={disabled}
      />
      <IconButton
        color="primary"
        onClick={handleSend}
        disabled={disabled || !text.trim()}
        sx={{ bgcolor: 'primary.main', color: 'white', borderRadius: 2, '&:hover': { bgcolor: 'primary.dark' }, '&.Mui-disabled': { opacity: 0.4 } }}
      >
        <SendIcon />
      </IconButton>
    </Stack>
  )
}
