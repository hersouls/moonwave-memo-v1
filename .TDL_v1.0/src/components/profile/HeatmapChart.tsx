import { useMemo, useState } from 'react'
import { format, subDays, startOfWeek, addDays } from 'date-fns'
import type { Task } from '@/lib/types'

interface HeatmapChartProps {
  tasks: Task[]
}

const MONTH_LABELS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']
const DAY_LABELS = ['', '월', '', '수', '', '금', '']

function getColor(count: number, isDark: boolean): string {
  if (count === 0) return isDark ? '#27272a' : '#f4f4f5'
  if (count <= 1) return isDark ? '#064e3b' : '#d1fae5'
  if (count <= 3) return isDark ? '#065f46' : '#6ee7b7'
  if (count <= 5) return isDark ? '#047857' : '#34d399'
  return isDark ? '#059669' : '#10b981'
}

export function HeatmapChart({ tasks }: HeatmapChartProps) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; date: string; count: number } | null>(null)
  const isDark = document.documentElement.classList.contains('dark')

  const { weeks, monthPositions, completionMap } = useMemo(() => {
    // 날짜별 완료 건수 계산
    const cMap: Record<string, number> = {}
    tasks.forEach((t) => {
      if (t.status === 'completed' && t.completedAt) {
        const d = t.completedAt.split('T')[0]
        cMap[d] = (cMap[d] || 0) + 1
      }
    })

    const today = new Date()
    const totalDays = 365
    const startDate = subDays(today, totalDays - 1)
    const weekStart = startOfWeek(startDate, { weekStartsOn: 0 })

    const weeksArr: { date: Date; dateStr: string; count: number; dayOfWeek: number }[][] = []
    let currentWeek: typeof weeksArr[number] = []
    let currentDate = weekStart

    while (currentDate <= today) {
      const dateStr = format(currentDate, 'yyyy-MM-dd')
      const dayOfWeek = currentDate.getDay()

      currentWeek.push({
        date: new Date(currentDate),
        dateStr,
        count: cMap[dateStr] || 0,
        dayOfWeek,
      })

      if (dayOfWeek === 6) {
        weeksArr.push(currentWeek)
        currentWeek = []
      }
      currentDate = addDays(currentDate, 1)
    }
    if (currentWeek.length > 0) weeksArr.push(currentWeek)

    // 월 위치 계산
    const monthPos: { label: string; x: number }[] = []
    let lastMonth = -1
    weeksArr.forEach((week, weekIdx) => {
      const firstDay = week[0]
      const month = firstDay.date.getMonth()
      if (month !== lastMonth) {
        monthPos.push({ label: MONTH_LABELS[month], x: weekIdx })
        lastMonth = month
      }
    })

    return { weeks: weeksArr, monthPositions: monthPos, completionMap: cMap }
  }, [tasks])

  const cellSize = 11
  const cellGap = 2
  const totalCellSize = cellSize + cellGap
  const leftPadding = 28
  const topPadding = 20
  const svgWidth = leftPadding + weeks.length * totalCellSize
  const svgHeight = topPadding + 7 * totalCellSize

  const totalCompleted = Object.values(completionMap).reduce((a, b) => a + b, 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">연간 완료 히트맵</h3>
        <span className="text-xs text-zinc-400 dark:text-zinc-500">올해 {totalCompleted}개 완료</span>
      </div>

      <div className="overflow-x-auto -mx-4 px-4">
        <svg
          width={svgWidth}
          height={svgHeight + 20}
          className="select-none"
          onMouseLeave={() => setTooltip(null)}
        >
          {/* Month labels */}
          {monthPositions.map((m, i) => (
            <text
              key={i}
              x={leftPadding + m.x * totalCellSize}
              y={12}
              className="fill-zinc-400 dark:fill-zinc-500"
              fontSize={10}
              fontFamily="Pretendard"
            >
              {m.label}
            </text>
          ))}

          {/* Day labels */}
          {DAY_LABELS.map((label, i) => (
            <text
              key={i}
              x={0}
              y={topPadding + i * totalCellSize + cellSize - 1}
              className="fill-zinc-400 dark:fill-zinc-500"
              fontSize={9}
              fontFamily="Pretendard"
            >
              {label}
            </text>
          ))}

          {/* Cells */}
          {weeks.map((week, weekIdx) =>
            week.map((day) => (
              <rect
                key={day.dateStr}
                x={leftPadding + weekIdx * totalCellSize}
                y={topPadding + day.dayOfWeek * totalCellSize}
                width={cellSize}
                height={cellSize}
                rx={2}
                fill={getColor(day.count, isDark)}
                className="cursor-pointer transition-opacity hover:opacity-80"
                onMouseEnter={(e) => {
                  const rect = (e.target as SVGRectElement).getBoundingClientRect()
                  setTooltip({ x: rect.x + rect.width / 2, y: rect.y, date: day.dateStr, count: day.count })
                }}
                onMouseLeave={() => setTooltip(null)}
              />
            ))
          )}

          {/* Legend */}
          <text x={svgWidth - 120} y={svgHeight + 14} fontSize={9} className="fill-zinc-400 dark:fill-zinc-500" fontFamily="Pretendard">적음</text>
          {[0, 1, 3, 5, 7].map((count, i) => (
            <rect
              key={i}
              x={svgWidth - 90 + i * (cellSize + 2)}
              y={svgHeight + 4}
              width={cellSize}
              height={cellSize}
              rx={2}
              fill={getColor(count, isDark)}
            />
          ))}
          <text x={svgWidth - 18} y={svgHeight + 14} fontSize={9} className="fill-zinc-400 dark:fill-zinc-500" fontFamily="Pretendard">많음</text>
        </svg>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 px-2 py-1 bg-zinc-800 dark:bg-zinc-600 text-white text-xs rounded shadow-lg pointer-events-none"
          style={{ left: tooltip.x, top: tooltip.y - 32, transform: 'translateX(-50%)' }}
        >
          {tooltip.date}: {tooltip.count}개 완료
        </div>
      )}
    </div>
  )
}
