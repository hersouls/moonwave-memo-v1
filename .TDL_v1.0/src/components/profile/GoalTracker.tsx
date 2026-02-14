import { useMemo } from 'react'
import { Target } from 'lucide-react'
import { format } from 'date-fns'
import type { Task } from '@/lib/types'
import { useSettingsStore } from '@/stores/settingsStore'

interface GoalTrackerProps {
  tasks: Task[]
}

export function GoalTracker({ tasks }: GoalTrackerProps) {
  const dailyGoal = useSettingsStore((s) => s.settings.dailyGoal ?? 3)

  const todayCompleted = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd')
    return tasks.filter(
      (t) => t.status === 'completed' && t.completedAt?.startsWith(today)
    ).length
  }, [tasks])

  const progress = Math.min(todayCompleted / dailyGoal, 1)
  const percentage = Math.round(progress * 100)
  const radius = 40
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference * (1 - progress)

  const isCompleted = todayCompleted >= dailyGoal

  return (
    <div className="flex items-center gap-6">
      {/* Circular progress */}
      <div className="relative flex-shrink-0">
        <svg width={100} height={100} className="-rotate-90">
          {/* Background circle */}
          <circle
            cx={50}
            cy={50}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={6}
            className="text-zinc-200 dark:text-zinc-700"
          />
          {/* Progress circle */}
          <circle
            cx={50}
            cy={50}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={6}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className={isCompleted ? 'text-emerald-500' : 'text-primary-500'}
            style={{ transition: 'stroke-dashoffset 0.5s ease-in-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-lg font-bold ${isCompleted ? 'text-emerald-500' : 'text-zinc-900 dark:text-zinc-100'}`}>
            {percentage}%
          </span>
        </div>
      </div>

      {/* Info */}
      <div>
        <div className="flex items-center gap-1.5 mb-1">
          <Target className={`w-4 h-4 ${isCompleted ? 'text-emerald-500' : 'text-primary-500'}`} />
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">오늘의 목표</h3>
        </div>
        <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          {todayCompleted}
          <span className="text-sm font-normal text-zinc-400 dark:text-zinc-500">
            {' '}/ {dailyGoal}개
          </span>
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          {isCompleted ? '목표를 달성했습니다!' : `${dailyGoal - todayCompleted}개 더 완료하세요`}
        </p>
      </div>
    </div>
  )
}
