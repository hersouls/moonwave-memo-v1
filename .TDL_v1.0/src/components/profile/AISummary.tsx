import { useState } from 'react'
import { Sparkles, Loader2, RefreshCw } from 'lucide-react'
import { useSettingsStore } from '@/stores/settingsStore'
import { useCategoryStore } from '@/stores/categoryStore'
import { generateProductivitySummary, type ProductivitySummary } from '@/services/aiService'
import { Button } from '@/components/ui/Button'
import type { Task } from '@/lib/types'

interface AISummaryProps {
  tasks: Task[]
}

export function AISummary({ tasks }: AISummaryProps) {
  const aiEnabled = useSettingsStore((s) => s.settings.aiEnabled)
  const aiApiKey = useSettingsStore((s) => s.settings.aiApiKey)
  const getDecryptedApiKey = useSettingsStore((s) => s.getDecryptedApiKey)
  const categories = useCategoryStore((s) => s.categories)

  const [summary, setSummary] = useState<ProductivitySummary | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!aiEnabled || !aiApiKey) return null

  const handleGenerate = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const now = new Date()
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

      // Calculate stats
      const recentCompleted = tasks.filter(
        (t) => t.status === 'completed' && t.completedAt && new Date(t.completedAt) >= sevenDaysAgo
      )
      const totalPending = tasks.filter((t) => t.status === 'pending').length
      const totalCompleted = recentCompleted.length
      const total = totalCompleted + totalPending
      const completionRate = total > 0 ? (totalCompleted / total) * 100 : 0

      // Category breakdown
      const catMap = new Map<number | null, number>()
      recentCompleted.forEach((t) => {
        catMap.set(t.categoryId, (catMap.get(t.categoryId) || 0) + 1)
      })
      const topCategories = Array.from(catMap.entries())
        .map(([catId, count]) => {
          const cat = categories.find((c) => c.id === catId)
          return { name: cat?.name || '미분류', count }
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)

      // Daily completion for last 7 days
      const recentDays: { date: string; completed: number }[] = []
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
        const dateStr = date.toISOString().split('T')[0]
        const completed = recentCompleted.filter(
          (t) => t.completedAt && t.completedAt.startsWith(dateStr)
        ).length
        recentDays.push({ date: dateStr, completed })
      }

      // Calculate streak (rough estimate)
      let streak = 0
      for (let i = 0; i < 30; i++) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
        const dateStr = date.toISOString().split('T')[0]
        const dayCompleted = tasks.some(
          (t) => t.status === 'completed' && t.completedAt?.startsWith(dateStr)
        )
        if (dayCompleted) streak++
        else break
      }

      const decryptedKey = await getDecryptedApiKey()
      const result = await generateProductivitySummary(decryptedKey, {
        totalCompleted,
        totalPending,
        completionRate,
        topCategories,
        recentDays,
        streak,
      })

      setSummary(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI 요약 생성에 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-500" />
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            AI 생산성 요약
          </h3>
        </div>
        {summary && (
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isLoading}
            className="p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      {!summary && !isLoading && !error && (
        <div className="flex flex-col items-center py-4">
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3 text-center">
            AI가 최근 7일간의 작업 패턴을 분석하여<br />맞춤형 생산성 요약을 제공합니다.
          </p>
          <Button variant="secondary" size="sm" onClick={handleGenerate}>
            <Sparkles className="w-4 h-4 mr-1.5" />
            요약 생성하기
          </Button>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
          <span className="ml-2 text-sm text-zinc-500">AI 분석 중...</span>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800">
          <p className="text-xs text-danger-600 dark:text-danger-400">{error}</p>
          <button
            type="button"
            onClick={handleGenerate}
            className="mt-2 text-xs text-primary-500 hover:text-primary-600"
          >
            다시 시도
          </button>
        </div>
      )}

      {summary && !isLoading && (
        <div className="space-y-3">
          <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
            {summary.summary}
          </p>

          {summary.highlights.length > 0 && (
            <div className="space-y-1.5">
              {summary.highlights.map((highlight, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 text-xs text-zinc-600 dark:text-zinc-400"
                >
                  <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-purple-400 flex-shrink-0" />
                  {highlight}
                </div>
              ))}
            </div>
          )}

          <div className="p-2.5 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800/30">
            <p className="text-xs text-purple-700 dark:text-purple-300">
              <span className="font-medium">제안:</span> {summary.suggestion}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
