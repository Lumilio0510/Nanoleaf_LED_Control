import { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import type { Components } from 'react-markdown'

interface Props {
  content: string
  variant?: 'user' | 'assistant'
}

export default function MarkdownContent({ content, variant = 'assistant' }: Props) {
  const isUser = variant === 'user'

  const components = useMemo<Components>(() => ({
    p({ children }) {
      return (
        <Typography variant="body2" sx={{ mb: 1, '&:last-child': { mb: 0 } }}>
          {children}
        </Typography>
      )
    },
    strong({ children }) {
      return <Box component="strong" sx={{ fontWeight: 700 }}>{children}</Box>
    },
    em({ children }) {
      return <Box component="em">{children}</Box>
    },
    code({ className, children, ...props }) {
      const inline = !className
      if (inline) {
        return (
          <Box
            component="code"
            sx={{
              px: 0.5,
              py: 0.25,
              borderRadius: 0.75,
              fontSize: '0.8rem',
              fontFamily: 'monospace',
              bgcolor: isUser ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)',
            }}
            {...props}
          >
            {children}
          </Box>
        )
      }
      return (
        <Box
          component="pre"
          sx={{
            p: 1.25,
            borderRadius: 1.5,
            fontSize: '0.78rem',
            fontFamily: 'monospace',
            bgcolor: isUser ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
            overflow: 'auto',
            mb: 1,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          <code>{children}</code>
        </Box>
      )
    },
    pre({ children }) {
      return <>{children}</>
    },
    ul({ children }) {
      return (
        <Box component="ul" sx={{ pl: 2.5, mb: 1 }}>
          {children}
        </Box>
      )
    },
    ol({ children }) {
      return (
        <Box component="ol" sx={{ pl: 2.5, mb: 1 }}>
          {children}
        </Box>
      )
    },
    li({ children }) {
      return (
        <Typography component="li" variant="body2" sx={{ mb: 0.25 }}>
          {children}
        </Typography>
      )
    },
    h1({ children }) {
      return <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>{children}</Typography>
    },
    h2({ children }) {
      return <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>{children}</Typography>
    },
    h3({ children }) {
      return <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>{children}</Typography>
    },
    blockquote({ children }) {
      return (
        <Box
          component="blockquote"
          sx={{
            borderLeft: 3,
            borderColor: isUser ? 'rgba(255,255,255,0.3)' : 'primary.light',
            pl: 1.5,
            my: 1,
            opacity: 0.85,
          }}
        >
          {children}
        </Box>
      )
    },
    a({ href, children }) {
      return (
        <Box
          component="a"
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          sx={{
            color: isUser ? 'inherit' : 'primary.main',
            textDecoration: 'underline',
          }}
        >
          {children}
        </Box>
      )
    },
    hr() {
      return <Box component="hr" sx={{ my: 1, borderColor: 'divider' }} />
    },
    table({ children }) {
      return (
        <Box component="table" sx={{ borderCollapse: 'collapse', width: '100%', mb: 1, fontSize: '0.8rem' }}>
          {children}
        </Box>
      )
    },
    th({ children }) {
      return (
        <Box component="th" sx={{ border: 1, borderColor: 'divider', px: 1, py: 0.5, fontWeight: 600, textAlign: 'left' }}>
          {children}
        </Box>
      )
    },
    td({ children }) {
      return (
        <Box component="td" sx={{ border: 1, borderColor: 'divider', px: 1, py: 0.5 }}>
          {children}
        </Box>
      )
    },
  }), [isUser])

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </ReactMarkdown>
  )
}
