import { useMemo } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { format, subDays } from 'date-fns'
import { useSettingsStore } from '@/stores/settingsStore'
import type { Task } from '@/lib/types'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler)

interface GoalAchievementChartProps {
  tasks: Task[]
}

export function GoalAchievementChart({ tasks }: GoalAchievementChartProps) {
  const dailyGoal = useSettingsStore((s) => s.settings.dailyGoal)

  const data = useMemo(() => {
    const today = new Date()
    const labels: string[] = []
    const achievements: number[] = []

    for (let i = 13; i >= 0; i--) {
      const date = subDays(today, i)
      const dateStr = format(date, 'yyyy-MM-dd')
      const completedCount = tasks.filter(
        (t) => t.status === 'completed' && t.completedAt?.startsWith(dateStr)
      ).length
      const rate = dailyGoal > 0 ? Math.min((completedCount / dailyGoal) * 100, 100) : 0

      labels.push(format(date, 'M/d'))
      achievements.push(Math.round(rate))
    }

    const isDark = document.documentElement.classList.contains('dark')

    return {
      labels,
      datasets: [
        {
          data: achievements,
          borderColor: isDark ? 'oklch(0.72 0.19 160)' : 'oklch(0.55 0.19 160)',
          backgroundColor: isDark ? 'oklch(0.72 0.19 160 / 0.1)' : 'oklch(0.55 0.19 160 / 0.1)',
          borderWidth: 2,
          pointRadius: 0,
          pointHitRadius: 10,
          tension: 0.3,
          fill: true,
        },
      ],
    }
  }, [tasks, dailyGoal])

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: { parsed: { y: number | null } }) => `달성률: ${ctx.parsed.y ?? 0}%`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          font: { size: 10 },
          maxTicksLimit: 7,
          color: '#a1a1aa',
        },
      },
      y: {
        min: 0,
        max: 100,
        grid: { color: 'rgba(161,161,170,0.1)' },
        ticks: {
          font: { size: 10 },
          callback: (v: string | number) => `${v}%`,
          color: '#a1a1aa',
        },
      },
    },
  }), [])

  return (
    <div>
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
        일일 목표 달성률 (14일)
      </h3>
      <div className="h-48">
        <Line data={data} options={options} />
      </div>
    </div>
  )
}
