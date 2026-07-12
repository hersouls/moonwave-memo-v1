import { useMemo, useState, useEffect, useRef } from 'react'
import {
  TrendingUp,
  Sparkles,
  Repeat2,
  Flame,
  Tag,
  Clock,
  Sprout,
  MessageCircle,
  Lightbulb,
  type LucideIcon,
} from 'lucide-react'
import { useMemoStore } from '@/stores/memoStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { generateInsights, type Insight } from '@/services/insightEngine'
import { isAIAvailable } from '@/services/aiFeatures'
import { incrementAIUsage } from '@/services/aiUsage'
import { apiUrl } from '@/lib/apiBase'
import { WidgetCard } from './WidgetCard'

const INSIGHT_ICONS: Record<string, LucideIcon> = {
  pattern: Repeat2,
  streak: Flame,
  tag: Tag,
  time: Clock,
  growth: Sprout,
  mood: MessageCircle,
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
        const res = await fetch(apiUrl('/api/langchain/insights'), {
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
    <WidgetCard
      icon={TrendingUp}
      title="인사이트"
      titleAdornment={aiInsights.length > 0 && <Sparkles className="h-3 w-3 shrink-0 text-amber-400" />}
    >
      <ul className="space-y-2.5">
        {allInsights.map((insight, i) => {
          const Icon = INSIGHT_ICONS[insight.type] || Lightbulb
          return (
            <li key={i} className="flex items-start gap-2.5">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" aria-hidden="true" />
              <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                {insight.text}
              </p>
            </li>
          )
        })}
      </ul>
      {aiLoading && (
        <div className="flex items-center gap-2 mt-3">
          <div className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-[10px] text-zinc-500 dark:text-zinc-400">{'AI 분석 중...'}</span>
        </div>
      )}
    </WidgetCard>
  )
}
