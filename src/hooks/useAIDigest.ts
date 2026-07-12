import { useState, useEffect, useRef } from 'react'
import { startOfWeek } from 'date-fns'
import { useMemoStore } from '@/stores/memoStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { isAIAvailable, getUserApiKey } from '@/services/aiFeatures'
import { incrementAIUsage } from '@/services/aiUsage'
import { apiUrl } from '@/lib/apiBase'

export interface AIDigest {
  summary: string
  themes: string[]
  moodTrend: string
  growth: string
  topInsights: string[]
  nextWeekSuggestion: string
}

export function useAIDigest() {
  const memos = useMemoStore((s) => s.memos)
  const [digest, setDigest] = useState<AIDigest | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const memosRef = useRef(memos)
  memosRef.current = memos
  const hasFetched = useRef(false)

  useEffect(() => {
    if (hasFetched.current) return
    hasFetched.current = true

    const controller = new AbortController()

    async function fetchDigest() {
      if (!isAIAvailable()) return

      const now = new Date()
      const weekStart = startOfWeek(now, { weekStartsOn: 0 })
      const activeMemos = memosRef.current.filter((m) => !m.deletedAt)

      const weeklyMemos = activeMemos
        .filter((m) => new Date(m.createdAt) >= weekStart)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 20)
        .map((m) => ({
          title: m.title,
          body: m.body.slice(0, 300),
          tags: m.tags,
          createdAt: m.createdAt,
          updatedAt: m.updatedAt,
        }))

      if (weeklyMemos.length < 2) return

      const ai = useSettingsStore.getState().settings.ai
      const provider = ai.aiProvider || 'openai'
      // Provider-matched key so a mismatched key doesn't 401 and blank the weekly digest.
      const userApiKey = getUserApiKey(provider)

      setIsLoading(true)
      try {
        const res = await fetch(apiUrl('/api/langchain/digest'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ weeklyMemos, provider, userApiKey }),
          signal: controller.signal,
        })

        if (res.ok) {
          const data = await res.json()
          if (data.usingServerKey) incrementAIUsage()
          if (data.digest) setDigest(data.digest)
        }
      } catch {
        // AI digest unavailable or aborted
      } finally {
        setIsLoading(false)
      }
    }

    fetchDigest()
    return () => controller.abort()
  }, [])

  return { digest, isLoading }
}
