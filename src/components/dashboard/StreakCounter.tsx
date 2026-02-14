import { Flame } from 'lucide-react'
import { useSettingsStore } from '@/stores/settingsStore'

export function StreakCounter() {
  const gamification = useSettingsStore((s) => s.settings.gamification)
  const { currentStreak, longestStreak } = gamification

  return (
    <div className="flex items-center gap-3 p-4 rounded-2xl bg-white dark:bg-zinc-800 shadow-sm">
      <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-900/20">
        <Flame className={`w-6 h-6 ${currentStreak > 0 ? 'text-amber-500' : 'text-zinc-300 dark:text-zinc-600'}`} />
      </div>
      <div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            {currentStreak}
          </span>
          <span className="text-sm text-zinc-500 dark:text-zinc-400">일 연속</span>
        </div>
        {longestStreak > 0 && (
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            최장 {longestStreak}일
          </p>
        )}
      </div>
    </div>
  )
}
