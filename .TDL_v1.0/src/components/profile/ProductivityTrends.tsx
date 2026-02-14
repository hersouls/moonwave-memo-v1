import { useMemo } from 'react'
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  Filler,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { format, subWeeks, startOfWeek, addDays } from 'date-fns'
import type { Task } from '@/lib/types'
import type { ChartOptions } from 'chart.js'

ChartJS.register(LineElement, PointElement, Filler)

interface ProductivityTrendsProps {
  tasks: Task[]
}

const lineChartOptions: ChartOptions<'line'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label: (ctx) => `${ctx.parsed.y}개 완료`,
      },
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: {
        font: { size: 10, family: 'Pretendard' },
        color: '#a1a1aa',
      },
    },
    y: {
      beginAtZero: true,
      ticks: {
        stepSize: 1,
        font: { size: 10, family: 'Pretendard' },
        color: '#a1a1aa',
      },
      grid: {
        color: 'rgba(161, 161, 170, 0.1)',
      },
    },
  },
  elements: {
    line: { tension: 0.3 },
    point: { radius: 3, hoverRadius: 5 },
  },
}

export function ProductivityTrends({ tasks }: ProductivityTrendsProps) {
  const chartData = useMemo(() => {
    const isDark = document.documentElement.classList.contains('dark')
    const weeks = 12
    const labels: string[] = []
    const data: number[] = []

    for (let i = weeks - 1; i >= 0; i--) {
      const weekStartDate = startOfWeek(subWeeks(new Date(), i), { weekStartsOn: 0 })
      const weekEndDate = addDays(weekStartDate, 6)
      const startStr = format(weekStartDate, 'yyyy-MM-dd')
      const endStr = format(weekEndDate, 'yyyy-MM-dd')

      labels.push(format(weekStartDate, 'M/d'))

      const count = tasks.filter((t) => {
        if (t.status !== 'completed' || !t.completedAt) return false
        const d = t.completedAt.split('T')[0]
        return d >= startStr && d <= endStr
      }).length

      data.push(count)
    }

    return {
      labels,
      datasets: [
        {
          data,
          borderColor: isDark ? 'rgba(96, 165, 250, 0.9)' : 'rgba(59, 130, 246, 0.9)',
          backgroundColor: isDark ? 'rgba(96, 165, 250, 0.1)' : 'rgba(59, 130, 246, 0.1)',
          fill: true,
          borderWidth: 2,
        },
      ],
    }
  }, [tasks])

  const hasData = chartData.datasets[0].data.some((d) => d > 0)

  return (
    <div>
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
        12주 생산성 추이
      </h3>
      {hasData ? (
        <div className="h-48">
          <Line data={chartData} options={lineChartOptions} />
        </div>
      ) : (
        <div className="h-48 flex items-center justify-center">
          <p className="text-sm text-zinc-400 dark:text-zinc-500">데이터가 없습니다</p>
        </div>
      )}
    </div>
  )
}
