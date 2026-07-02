import { useState, useEffect, memo } from 'react'
import { Flame } from 'lucide-react'
import { useSettingsStore } from '@/stores/settingsStore'

function useCountUp(target: number, duration = 800) {
  const [current, setCurrent] = useState(0)
  useEffect(() => {
    if (target === 0) { setCurrent(0); return }
    const startTime = performance.now()
    let rafId: number
    const tick = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCurrent(Math.round(eased * target))
      if (progress < 1) rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [target, duration])
  return current
}

export const StreakCounter = memo(function StreakCounter() {
  const gamification = useSettingsStore((s) => s.settings.gamification)
  const currentStreak = gamification?.currentStreak ?? 0
  const longestStreak = gamification?.longestStreak ?? 0
  const animatedStreak = useCountUp(currentStreak)
  const animatedLongest = useCountUp(longestStreak)

  return (
    <div className="flex items-center gap-3 p-4 card">
      <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-warning-50 dark:bg-warning-900/20">
        <Flame className={`w-6 h-6 ${currentStreak > 0 ? 'text-warning-500' : 'text-zinc-300 dark:text-zinc-600'}`} />
      </div>
      <div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            {animatedStreak}
          </span>
          <span className="text-sm text-zinc-500 dark:text-zinc-400">일 연속</span>
        </div>
        {longestStreak > 0 && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            최장 {animatedLongest}일
          </p>
        )}
      </div>
    </div>
  )
})
