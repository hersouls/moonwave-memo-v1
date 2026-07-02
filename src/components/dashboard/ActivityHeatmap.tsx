import { useMemo, memo } from 'react'
import clsx from 'clsx'
import { useMemoStore } from '@/stores/memoStore'
import { useUIStore } from '@/stores/uiStore'
import { generateHeatmapData } from '@/services/gamification'

const DAYS = ['일', '월', '화', '수', '목', '금', '토']

function getIntensity(count: number): string {
  if (count === 0) return 'bg-zinc-100 dark:bg-zinc-800'
  if (count === 1) return 'bg-primary-200 dark:bg-primary-900/40'
  if (count <= 3) return 'bg-primary-300 dark:bg-primary-800/60'
  if (count <= 5) return 'bg-primary-400 dark:bg-primary-700/70'
  return 'bg-primary-500 dark:bg-primary-600'
}

export const ActivityHeatmap = memo(function ActivityHeatmap() {
  const memos = useMemoStore((s) => s.memos)
  const isNarrowFold = useUIStore((s) => s.isNarrowFold)

  // F-07: Show fewer weeks on fold front screen
  const weekCount = isNarrowFold ? 8 : 16
  const heatmapData = useMemo(() => generateHeatmapData(memos, weekCount), [memos, weekCount])

  // Group into weeks (columns of 7)
  const weeks: typeof heatmapData[] = []
  for (let i = 0; i < heatmapData.length; i += 7) {
    weeks.push(heatmapData.slice(i, i + 7))
  }

  const totalCount = heatmapData.reduce((sum, d) => sum + d.count, 0)

  return (
    <div className="p-4 card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">활동 히트맵</h3>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          최근 {weekCount}주 · {totalCount}개 메모
        </span>
      </div>

      <div className="flex gap-1 overflow-x-auto">
        {/* Day labels */}
        <div className="flex flex-col gap-1 shrink-0 mr-1">
          {DAYS.map((day, i) => (
            <div key={i} className="h-3 w-5 flex items-center">
              {(i === 1 || i === 3 || i === 5) && (
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400">{day}</span>
              )}
            </div>
          ))}
        </div>

        {/* Week columns */}
        {weeks.map((week, weekIdx) => (
          <div key={weekIdx} className="flex flex-col gap-1">
            {week.map((day) => (
              <div
                key={day.date}
                className={clsx(
                  'h-3 w-3 rounded-sm transition-colors',
                  getIntensity(day.count)
                )}
                title={`${day.date}: ${day.count}개 메모`}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-1.5 mt-2">
        <span className="text-[10px] text-zinc-400">적음</span>
        <div className="h-2.5 w-2.5 rounded-sm bg-zinc-100 dark:bg-zinc-800" />
        <div className="h-2.5 w-2.5 rounded-sm bg-primary-200 dark:bg-primary-900/40" />
        <div className="h-2.5 w-2.5 rounded-sm bg-primary-300 dark:bg-primary-800/60" />
        <div className="h-2.5 w-2.5 rounded-sm bg-primary-400 dark:bg-primary-700/70" />
        <div className="h-2.5 w-2.5 rounded-sm bg-primary-500 dark:bg-primary-600" />
        <span className="text-[10px] text-zinc-400">많음</span>
      </div>
    </div>
  )
})
