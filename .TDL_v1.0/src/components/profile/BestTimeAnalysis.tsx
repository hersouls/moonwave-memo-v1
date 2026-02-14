import { useMemo } from 'react'
import { Clock, Calendar as CalendarIcon } from 'lucide-react'
import type { Task } from '@/lib/types'

interface BestTimeAnalysisProps {
  tasks: Task[]
}

const DAY_NAMES = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']
const TIME_SLOTS = [
  { label: '새벽 (0-6시)', start: 0, end: 6 },
  { label: '오전 (6-12시)', start: 6, end: 12 },
  { label: '오후 (12-18시)', start: 12, end: 18 },
  { label: '저녁 (18-24시)', start: 18, end: 24 },
]

export function BestTimeAnalysis({ tasks }: BestTimeAnalysisProps) {
  const analysis = useMemo(() => {
    const dayCount = new Array(7).fill(0) as number[]
    const timeSlotCount = new Array(4).fill(0) as number[]

    tasks.forEach((t) => {
      if (t.status === 'completed' && t.completedAt) {
        const date = new Date(t.completedAt)
        dayCount[date.getDay()]++

        const hour = date.getHours()
        const slotIdx = TIME_SLOTS.findIndex((s) => hour >= s.start && hour < s.end)
        if (slotIdx >= 0) timeSlotCount[slotIdx]++
      }
    })

    const bestDayIdx = dayCount.indexOf(Math.max(...dayCount))
    const bestTimeIdx = timeSlotCount.indexOf(Math.max(...timeSlotCount))
    const totalCompleted = dayCount.reduce((a, b) => a + b, 0)

    return {
      dayCount,
      timeSlotCount,
      bestDay: DAY_NAMES[bestDayIdx],
      bestDayCount: dayCount[bestDayIdx],
      bestTime: TIME_SLOTS[bestTimeIdx].label,
      bestTimeCount: timeSlotCount[bestTimeIdx],
      totalCompleted,
    }
  }, [tasks])

  if (analysis.totalCompleted === 0) {
    return (
      <div>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">생산성 패턴</h3>
        <p className="text-sm text-zinc-400 dark:text-zinc-500 text-center py-4">데이터가 부족합니다</p>
      </div>
    )
  }

  const maxDayCount = Math.max(...analysis.dayCount)
  const maxTimeCount = Math.max(...analysis.timeSlotCount)

  return (
    <div>
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">생산성 패턴</h3>

      <div className="grid grid-cols-2 gap-4">
        {/* Best Day */}
        <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20">
          <div className="flex items-center gap-1.5 mb-2">
            <CalendarIcon className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-xs font-medium text-blue-600 dark:text-blue-400">최고 요일</span>
          </div>
          <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{analysis.bestDay}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{analysis.bestDayCount}개 완료</p>
        </div>

        {/* Best Time */}
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20">
          <div className="flex items-center gap-1.5 mb-2">
            <Clock className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">최고 시간대</span>
          </div>
          <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{analysis.bestTime}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{analysis.bestTimeCount}개 완료</p>
        </div>
      </div>

      {/* Day distribution */}
      <div className="mt-4">
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">요일별 분포</p>
        <div className="flex items-end gap-1 h-12">
          {analysis.dayCount.map((count, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
              <div
                className="w-full rounded-t bg-primary-400 dark:bg-primary-500 transition-all"
                style={{ height: maxDayCount > 0 ? `${(count / maxDayCount) * 32}px` : '2px', minHeight: '2px' }}
              />
              <span className="text-[9px] text-zinc-400">{DAY_NAMES[i][0]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Time distribution */}
      <div className="mt-3">
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">시간대별 분포</p>
        <div className="space-y-1.5">
          {TIME_SLOTS.map((slot, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-400 w-20 flex-shrink-0">{slot.label}</span>
              <div className="flex-1 h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-400 dark:bg-primary-500 rounded-full transition-all"
                  style={{ width: maxTimeCount > 0 ? `${(analysis.timeSlotCount[i] / maxTimeCount) * 100}%` : '0%' }}
                />
              </div>
              <span className="text-[10px] text-zinc-400 w-6 text-right">{analysis.timeSlotCount[i]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
