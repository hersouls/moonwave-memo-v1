import { useMemo, useState, useEffect, useRef } from 'react'
import { TrendingUp, Sparkles } from 'lucide-react'
import { useMemoStore } from '@/stores/memoStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { generateInsights, type Insight } from '@/services/insightEngine'
import { isAIAvailable } from '@/services/aiFeatures'
import { incrementAIUsage } from '@/services/aiUsage'

const INSIGHT_ICONS: Record<string, string> = {
  pattern: '🔄',
  streak: '🔥',
  tag: '🏷️',
  time: '⏰',
  growth: '🌱',
  mood: '💭',
}

export function InsightsWidget() {
  const memos = useMemoStore((s) => s.memos)
  const [aiInsights, setAIInsights] = useState<Insight[]>([])
  const [aiLoading, setAILoading] = useState(false)
  const memosRef = useRef(memos)
  memosRef.current = memos
  const hasFetched = useRef(false)

  const localInsights = useMemo(() => generateInsights(memos), [memos])

  useEffect(() => {
    if (hasFetched.current) return
    hasFetched.current = true

    const controller = new AbortController()

    async function fetchAIInsights() {
      if (!isAIAvailable()) return

      const activeMemos = memosRef.current.filter((m) => !m.deletedAt)
      if (activeMemos.length < 5) return

      const ai = useSettingsStore.getState().settings.ai
      const provider = ai.aiProvider || 'openai'
      const userApiKey = ai.openaiApiKey || ai.anthropicApiKey || ai.geminiApiKey || undefined

      const memoData = activeMemos
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 30)
        .map((m) => ({
          title: m.title,
          body: m.body.slice(0, 150),
          tags: m.tags,
          createdAt: m.createdAt,
        }))

      setAILoading(true)
      try {
        const res = await fetch('/api/langchain/insights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ memos: memoData, provider, userApiKey }),
          signal: controller.signal,
        })

        if (res.ok) {
          const data = await res.json()
          if (data.usingServerKey) incrementAIUsage()
          if (Array.isArray(data.insights)) {
            setAIInsights(data.insights.filter((i: { text?: string; type?: string }) =>
              typeof i.text === 'string' && typeof i.type === 'string'
            ))
          }
        }
      } catch {
        // AI insights unavailable or aborted
      } finally {
        setAILoading(false)
      }
    }

    fetchAIInsights()
    return () => controller.abort()
  }, [])

  // Merge: AI insights first, then local insights (deduped)
  const allInsights = useMemo(() => {
    const merged: Insight[] = [...aiInsights]
    for (const local of localInsights) {
      // Avoid duplicates: skip local insight if AI already covers the same type
      if (!merged.some((ai) => ai.type === local.type)) {
        merged.push(local)
      }
    }
    return merged.slice(0, 7)
  }, [aiInsights, localInsights])

  if (allInsights.length === 0) return null

  return (
    <div className="rounded-2xl bg-white dark:bg-zinc-800 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-3.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
          <TrendingUp className="h-4 w-4 text-emerald-500" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {'인사이트'}
          </span>
          {aiInsights.length > 0 && <Sparkles className="h-3 w-3 text-emerald-400" />}
        </div>
      </div>

      <div className="border-t border-zinc-100 dark:border-zinc-700 px-5 py-4">
        <ul className="space-y-2.5">
          {allInsights.map((insight, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="text-sm shrink-0 mt-0.5" aria-hidden="true">
                {INSIGHT_ICONS[insight.type] || '•'}
              </span>
              <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                {insight.text}
              </p>
            </li>
          ))}
        </ul>
        {aiLoading && (
          <div className="flex items-center gap-2 mt-3">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] text-zinc-400">{'AI 분석 중...'}</span>
          </div>
        )}
      </div>
    </div>
  )
}
