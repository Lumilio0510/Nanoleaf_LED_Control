import { useState, useEffect, useCallback } from 'react'
import { api } from '../api'
import type { ChatMessage, ChatSession } from '../types'

export function useChat() {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string>('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streaming, setStreaming] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)

  useEffect(() => {
    api.getSessions().then(s => {
      setSessions(s)
      if (s.length > 0 && !currentSessionId) {
        setCurrentSessionId(s[0].id)
      }
    })
  }, [])

  useEffect(() => {
    if (!currentSessionId) return
    api.getSession(currentSessionId).then(s => {
      if (s) setMessages(s.messages)
    })
  }, [currentSessionId])

  const sendStream = useCallback((text: string) => {
    const sid = currentSessionId || 'default'
    setIsStreaming(true)
    setStreaming('')

    const unsub = api.onStreamChunk((chunk: string) => {
      if (chunk === '__DONE__') {
        setIsStreaming(false)
        unsub()
        api.getSession(sid).then(s => {
          if (s) {
            setMessages(s.messages)
            if (!currentSessionId) setCurrentSessionId(s.id)
          }
        })
        api.getSessions().then(setSessions)
        return
      }
      setStreaming(prev => prev + chunk)
    })

    api.chatStream(sid, text)
  }, [currentSessionId])

  const createNewSession = useCallback(async () => {
    const session = await api.createSession()
    setSessions(prev => [session, ...prev])
    setCurrentSessionId(session.id)
    setMessages([])
  }, [])

  const deleteSession = useCallback(async (id: string) => {
    await api.deleteSession(id)
    setSessions(prev => prev.filter(s => s.id !== id))
    if (currentSessionId === id) {
      const remaining = sessions.filter(s => s.id !== id)
      setCurrentSessionId(remaining[0]?.id || '')
    }
  }, [currentSessionId, sessions])

  const switchSession = useCallback((id: string) => {
    setCurrentSessionId(id)
  }, [])

  return {
    currentSessionId, messages, streaming, isStreaming, sessions,
    sendStream, createNewSession, deleteSession, switchSession
  }
}
