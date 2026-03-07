import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Clock, Sparkles } from 'lucide-react'
import { useMemoStore } from '@/stores/memoStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useThemeOrchestrator } from '@/stores/themeOrchestratorStore'
import { findTimeCapsuleMemo, type TimeCapsuleResult } from '@/services/timeCapsule'

export function TimeCapsuleBanner() {
  const [capsule, setCapsule] = useState<TimeCapsuleResult | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const memos = useMemoStore((s) => s.memos)
  const enabled = useSettingsStore((s) => s.settings.livingWorkspace.timeCapsuleEnabled)
  const setSpecialEvent = useThemeOrchestrator((s) => s.setSpecialEvent)
  const navigate = useNavigate()

  useEffect(() => {
    if (!enabled || dismissed) return

    const result = findTimeCapsuleMemo(memos)
    setCapsule(result)

    if (result.found && result.memo) {
      setSpecialEvent({ type: 'anniversary', memoTitle: result.memo.title })
    }

    return () => {
      setSpecialEvent(null)
    }
  }, [enabled, memos, dismissed, setSpecialEvent])

  if (!enabled || dismissed || !capsule?.found || !capsule.memo) return null

  const handleDismiss = () => {
    setDismissed(true)
    setSpecialEvent(null)
  }

  const handleClick = () => {
    if (capsule.memo?.id) {
      navigate(`/memo/${capsule.memo.id}`)
    }
  }

  return (
    <div className="relative mx-4 mt-3 mb-1 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 px-4 py-3 dark:border-amber-800/50 dark:from-amber-950/30 dark:to-yellow-950/20">
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1 rounded-lg text-amber-400 hover:text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
        aria-label="닫기"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3 pr-6">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
          <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            <Clock className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
            {capsule.yearsAgo}년 전 오늘, 당신이 깊게 몰입했던 기록입니다
          </p>
          <button
            onClick={handleClick}
            className="mt-1 text-sm text-amber-700 dark:text-amber-300 hover:underline truncate block max-w-full text-left"
          >
            "{capsule.memo.title || '제목 없음'}"
          </button>
        </div>
      </div>
    </div>
  )
}
