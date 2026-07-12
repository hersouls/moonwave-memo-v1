import { useState, useEffect, useRef } from 'react'
import { useMemoStore } from '@/stores/memoStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { parseChecklist } from '@/utils/checklistParser'
import { isAIAvailable } from '@/services/aiFeatures'
import { incrementAIUsage } from '@/services/aiUsage'
import { apiUrl } from '@/lib/apiBase'

export interface AIBriefing {
  greeting: string
  moodSummary: string
  keyTopics: string[]
  pendingActions: string[]
  todayFocus: string
  encouragement: string
}

export function useAIBriefing() {
  const memos = useMemoStore((s) => s.memos)
  const [briefing, setBriefing] = useState<AIBriefing | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const memosRef = useRef(memos)
  memosRef.current = memos
  const hasFetched = useRef(false)

  useEffect(() => {
    if (hasFetched.current) return
    hasFetched.current = true

    const controller = new AbortController()

    async function fetchBriefing() {
      if (!isAIAvailable()) return

      const activeMemos = memosRef.current.filter((m) => !m.deletedAt)
      if (activeMemos.length < 3) return

      // Get recent memos (last 3 days)
      const threeDaysAgo = new Date(Date.now() - 3 * 86400000)
      const recentMemos = activeMemos
        .filter((m) => new Date(m.createdAt) >= threeDaysAgo)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10)
        .map((m) => ({
          title: m.title,
          body: m.body.slice(0, 200),
          tags: m.tags,
          createdAt: m.createdAt,
        }))

      if (recentMemos.length === 0) return

      // Collect pending TODOs
      const pendingTodos: string[] = []
      for (const memo of activeMemos.slice(0, 20)) {
        const items = parseChecklist(memo.body)
        items
          .filter((item) => !item.checked)
          .forEach((item) => pendingTodos.push(item.text))
      }

      // Calculate streak
      const dates = new Set<string>()
      for (const memo of activeMemos) {
        const d = new Date(memo.createdAt)
        dates.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
      }
      let currentStreak = 0
      const checkDate = new Date()
      while (currentStreak < 365) {
        const key = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`
        if (dates.has(key)) {
          currentStreak++
          checkDate.setDate(checkDate.getDate() - 1)
        } else break
      }

      const ai = useSettingsStore.getState().settings.ai
      const provider = ai.aiProvider || 'openai'
      const userApiKey = ai.openaiApiKey || ai.anthropicApiKey || ai.geminiApiKey || undefined

      setIsLoading(true)
      try {
        const res = await fetch(apiUrl('/api/langchain/briefing'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recentMemos,
            pendingTodos: pendingTodos.slice(0, 10),
            currentStreak,
            provider,
            userApiKey,
          }),
          signal: controller.signal,
        })

        if (res.ok) {
          const data = await res.json()
          if (data.usingServerKey) incrementAIUsage()
          if (data.briefing) setBriefing(data.briefing)
        }
      } catch {
        // AI briefing unavailable or aborted
      } finally {
        setIsLoading(false)
      }
    }

    fetchBriefing()
    return () => controller.abort()
  }, [])

  return { briefing, isLoading }
}
