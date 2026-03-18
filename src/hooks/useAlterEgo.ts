import { useState, useCallback, useRef, useEffect } from 'react'
import { sendAlterEgoMessage, hasAlterEgoCapability } from '@/services/alterEgoService'
import { db } from '@/services/database'

interface AlterEgoMessage {
  role: 'user' | 'assistant'
  content: string
}

const MAX_EXCHANGES = 5
const MAX_STORED_MESSAGES = 10

export function useAlterEgo(body: string, memoId?: number) {
  const [messages, setMessages] = useState<AlterEgoMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const exchangeCount = messages.filter((m) => m.role === 'user').length
  const hasApiKey = hasAlterEgoCapability()

  // Auto-trigger refs
  const lastTypedRef = useRef<number>(0)
  const autoTriggeredRef = useRef(false)
  const bodyRef = useRef(body)
  bodyRef.current = body
  const messagesRef = useRef(messages)
  messagesRef.current = messages
  const isLoadingRef = useRef(isLoading)
  isLoadingRef.current = isLoading

  // Restore conversation from Dexie on mount
  useEffect(() => {
    if (!memoId) return
    db.demianChats
      .where('memoId')
      .equals(memoId)
      .first()
      .then((record) => {
        if (record?.messages?.length) {
          const restored = record.messages.slice(-MAX_STORED_MESSAGES) as AlterEgoMessage[]
          setMessages(restored)
          if (restored.some((m) => m.role === 'user')) {
            autoTriggeredRef.current = true
          }
        }
      })
      .catch(console.error)
  }, [memoId])

  // Save conversation to Dexie on message change
  useEffect(() => {
    if (!memoId || messages.length === 0) return
    const toStore = messages.slice(-MAX_STORED_MESSAGES)
    db.demianChats
      .where('memoId')
      .equals(memoId)
      .first()
      .then((existing) => {
        if (existing?.id) {
          return db.demianChats.update(existing.id, { messages: toStore, updatedAt: new Date().toISOString() })
        }
        return db.demianChats.add({ memoId, messages: toStore, updatedAt: new Date().toISOString() })
      })
      .catch(console.error)
  }, [memoId, messages])

  const sendMessage = useCallback(async (text: string) => {
    const currentMessages = messagesRef.current
    const currentExchangeCount = currentMessages.filter((m) => m.role === 'user').length
    if (currentExchangeCount >= MAX_EXCHANGES) {
      setError('대화 횟수가 제한(5회)에 도달했습니다. 초기화 후 다시 시도해 주세요.')
      return
    }
    if (isLoadingRef.current) return

    const userMessage: AlterEgoMessage = { role: 'user', content: text }
    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)
    setError(null)

    try {
      const allMessages = [...currentMessages, userMessage]
      const result = await sendAlterEgoMessage(allMessages, bodyRef.current)

      if (result.error) {
        setError(result.error)
        setMessages((prev) => prev.slice(0, -1))
      } else if (result.text) {
        const assistantMessage: AlterEgoMessage = { role: 'assistant', content: result.text }
        setMessages((prev) => [...prev, assistantMessage])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다')
      setMessages((prev) => prev.slice(0, -1))
    } finally {
      setIsLoading(false)
    }
  }, [])

  const reset = useCallback(() => {
    setMessages([])
    setError(null)
    autoTriggeredRef.current = false
    // Clear Dexie record
    if (memoId) {
      db.demianChats.where('memoId').equals(memoId).delete().catch(() => {})
    }
  }, [memoId])

  // Track typing for auto-trigger (10s pause after 50+ chars typed)
  useEffect(() => {
    if (body.length > 0) {
      lastTypedRef.current = Date.now()
    }
  }, [body])

  useEffect(() => {
    if (autoTriggeredRef.current || messages.length > 0 || !hasApiKey) return

    const interval = setInterval(() => {
      const elapsed = Date.now() - lastTypedRef.current
      if (
        elapsed >= 10000 &&
        lastTypedRef.current > 0 &&
        bodyRef.current.length >= 50 &&
        !autoTriggeredRef.current
      ) {
        autoTriggeredRef.current = true
        // Extract last paragraph as context
        const paragraphs = bodyRef.current.split('\n\n').filter((p) => p.trim())
        const lastParagraph = paragraphs[paragraphs.length - 1] || bodyRef.current.slice(-200)
        sendMessage(`이 부분에 대해 생각해 봤어: "${lastParagraph.slice(0, 200)}"`)
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [messages.length, hasApiKey, sendMessage])

  return {
    messages,
    sendMessage,
    isLoading,
    exchangeCount,
    maxExchanges: MAX_EXCHANGES,
    error,
    reset,
    hasApiKey,
  }
}
