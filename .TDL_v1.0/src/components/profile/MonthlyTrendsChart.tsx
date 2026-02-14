import { useMemo } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import type { Task } from '@/lib/types'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip)

interface MonthlyTrendsChartProps {
  tasks: Task[]
}

export function MonthlyTrendsChart({ tasks }: MonthlyTrendsChartProps) {
  const data = useMemo(() => {
    const today = new Date()
    const labels: string[] = []
    const created: number[] = []
    const completed: number[] = []

    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(today, i)
      const monthStart = format(startOfMonth(monthDate), 'yyyy-MM-dd')
      const monthEnd = format(endOfMonth(monthDate), 'yyyy-MM-dd')

      labels.push(format(monthDate, 'M월'))

      const createdCount = tasks.filter((t) => {
        const d = t.createdAt?.slice(0, 10)
        return d && d >= monthStart && d <= monthEnd
      }).length

      const completedCount = tasks.filter((t) => {
        if (t.status !== 'completed' || !t.completedAt) return false
        const d = t.completedAt.slice(0, 10)
        return d >= monthStart && d <= monthEnd
      }).length

      created.push(createdCount)
      completed.push(completedCount)
    }

    const isDark = document.documentElement.classList.contains('dark')

    return {
      labels,
      datasets: [
        {
          label: '생성',
          data: created,
          backgroundColor: isDark ? 'oklch(0.72 0.15 250 / 0.7)' : 'oklch(0.60 0.15 250 / 0.7)',
          borderRadius: 4,
          barThickness: 14,
        },
        {
          label: '완료',
          data: completed,
          backgroundColor: isDark ? 'oklch(0.72 0.19 160 / 0.7)' : 'oklch(0.55 0.19 160 / 0.7)',
          borderRadius: 4,
          barThickness: 14,
        },
      ],
    }
  }, [tasks])

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          boxWidth: 10,
          boxHeight: 10,
          font: { size: 11 },
          color: '#a1a1aa',
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx: { dataset: { label?: string }; parsed: { y: number | null } }) =>
            `${ctx.dataset.label}: ${ctx.parsed.y ?? 0}건`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 11 }, color: '#a1a1aa' },
      },
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(161,161,170,0.1)' },
        ticks: {
          font: { size: 10 },
          stepSize: 1,
          color: '#a1a1aa',
        },
      },
    },
  }), [])

  return (
    <div>
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
        월간 트렌드 (6개월)
      </h3>
      <div className="h-52">
        <Bar data={data} options={options} />
      </div>
    </div>
  )
}
