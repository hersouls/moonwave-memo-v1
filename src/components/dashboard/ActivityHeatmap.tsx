import { useMemo, useEffect, useRef, memo } from 'react'
import { Activity } from 'lucide-react'
import clsx from 'clsx'
import { useMemoStore } from '@/stores/memoStore'
import { useUIStore } from '@/stores/uiStore'
import { generateHeatmapData } from '@/services/gamification'
import { WidgetCard } from './WidgetCard'

const DAYS = ['일', '월', '화', '수', '목', '금', '토']

/* 강도 스케일 — 셀과 범례가 같은 배열을 공유 */
const INTENSITY_SCALE = [
  'bg-zinc-100 dark:bg-zinc-800',
  'bg-primary-200 dark:bg-primary-900/40',
  'bg-primary-300 dark:bg-primary-800/60',
  'bg-primary-400 dark:bg-primary-700/70',
  'bg-primary-500 dark:bg-primary-600',
] as const

function getIntensityIndex(count: number): number {
  if (count === 0) return 0
  if (count === 1) return 1
  if (count <= 3) return 2
  if (count <= 5) return 3
  return 4
}

export const ActivityHeatmap = memo(function ActivityHeatmap() {
  const memos = useMemoStore((s) => s.memos)
  const isNarrowFold = useUIStore((s) => s.isNarrowFold)
  const scrollRef = useRef<HTMLDivElement>(null)

  // F-07: Show fewer weeks on fold front screen
  const weekCount = isNarrowFold ? 8 : 16
  const heatmapData = useMemo(() => generateHeatmapData(memos, weekCount), [memos, weekCount])

  // Group into weeks (columns of 7)
  const weeks: typeof heatmapData[] = []
  for (let i = 0; i < heatmapData.length; i += 7) {
    weeks.push(heatmapData.slice(i, i + 7))
  }

  // 월 라벨 — 주의 첫날 월이 바뀌는 지점에만 표시 (겹침 방지: 월 변화는 4주 간격)
  const monthLabels = weeks.map((week, i) => {
    if (i === 0 || !week[0] || !weeks[i - 1]?.[0]) return null
    const month = week[0].date.slice(5, 7)
    const prevMonth = weeks[i - 1][0].date.slice(5, 7)
    return month !== prevMonth ? `${Number(month)}월` : null
  })

  // 데이터가 오래된 순이므로 열림 시 '오늘'(오른쪽 끝)로 스크롤
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [heatmapData])

  const totalCount = heatmapData.reduce((sum, d) => sum + d.count, 0)

  return (
    <WidgetCard
      icon={Activity}
      title="활동 히트맵"
      meta={`최근 ${weekCount}주 · ${totalCount}개 메모`}
    >
      <div ref={scrollRef} className="flex gap-1 overflow-x-auto pb-1">
        {/* Day labels */}
        <div className="mr-1 flex shrink-0 flex-col gap-1">
          <div className="h-3.5" aria-hidden="true" />
          {DAYS.map((day, i) => (
            <div key={i} className="flex h-3 w-5 items-center">
              {(i === 1 || i === 3 || i === 5) && (
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400">{day}</span>
              )}
            </div>
          ))}
        </div>

        {/* Week columns */}
        {weeks.map((week, weekIdx) => (
          <div key={weekIdx} className="flex flex-col gap-1">
            <div className="relative h-3.5 w-3" aria-hidden="true">
              {monthLabels[weekIdx] && (
                <span className="absolute left-0 top-0 whitespace-nowrap text-[10px] leading-none text-zinc-500 dark:text-zinc-400">
                  {monthLabels[weekIdx]}
                </span>
              )}
            </div>
            {week.map((day) => (
              <div
                key={day.date}
                className={clsx(
                  'h-3 w-3 rounded-sm transition-colors hover:ring-1 hover:ring-zinc-400/60',
                  INTENSITY_SCALE[getIntensityIndex(day.count)]
                )}
                title={`${day.date}: ${day.count}개 메모`}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-2 flex items-center justify-end gap-1.5">
        <span className="text-[10px] text-zinc-500 dark:text-zinc-400">적음</span>
        {INTENSITY_SCALE.map((cls) => (
          <div key={cls} className={clsx('h-2.5 w-2.5 rounded-sm', cls)} />
        ))}
        <span className="text-[10px] text-zinc-500 dark:text-zinc-400">많음</span>
      </div>
    </WidgetCard>
  )
})
