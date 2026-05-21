import { useState, useEffect, useCallback } from 'react'
import { api } from '../api'
import type { ChatMessage, ChatSession } from '../types'

interface ToolStatus {
  id: string
  name: string
  status: 'running' | 'done' | 'error'
  error?: string
}

export function useChat() {
 const [sessions, setSessions] = useState<ChatSession[]>([])
 const [currentSessionId, setCurrentSessionId] = useState<string>('')
 const [messages, setMessages] = useState<ChatMessage[]>([])
 const [streaming, setStreaming] = useState('')
 const [isStreaming, setIsStreaming] = useState(false)
 const [toolStatuses, setToolStatuses] = useState<ToolStatus[]>([])
 const [pendingSkill, setPendingSkill] = useState<ChatMessage['skill']>(null)

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
 const userMsg: ChatMessage = {
 id: crypto.randomUUID(),
 role: 'user',
 content: text,
 timestamp: new Date().toISOString()
 }
 setMessages(prev => [...prev, userMsg])
 setIsStreaming(true)
 setStreaming('')
 setToolStatuses([])
 setPendingSkill(null)

 const unsub = api.onStreamChunk((chunk: string) => {
   if (chunk === '__DONE__') {
     setIsStreaming(false)
     setStreaming('')
     setToolStatuses([])
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

   if (chunk.startsWith('__TOOL_START__')) {
     const data = JSON.parse(chunk.slice('__TOOL_START__'.length)) as { id: string; name: string; args: Record<string, unknown> }
     setToolStatuses(prev => [...prev, { id: data.id, name: data.name, status: 'running' }])
     return
   }
   if (chunk.startsWith('__TOOL_DONE__')) {
     const data = JSON.parse(chunk.slice('__TOOL_DONE__'.length)) as { id: string; name: string }
     setToolStatuses(prev => prev.map(t => t.id === data.id ? { ...t, status: 'done' } : t))
     return
   }
   if (chunk.startsWith('__TOOL_ERROR__')) {
     const data = JSON.parse(chunk.slice('__TOOL_ERROR__'.length)) as { id: string; name: string; error: string }
     setToolStatuses(prev => prev.map(t => t.id === data.id ? { ...t, status: 'error', error: data.error } : t))
     return
   }

   if (chunk.startsWith('__SKILL__')) {
     const skill = JSON.parse(chunk.slice('__SKILL__'.length))
     if (skill) setPendingSkill(skill)
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
 toolStatuses, pendingSkill,
 sendStream, createNewSession, deleteSession, switchSession
 }
}
