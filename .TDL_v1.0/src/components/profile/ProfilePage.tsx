import { useState, useMemo } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar, Doughnut } from 'react-chartjs-2'
import { ChevronLeft, ChevronRight, User, History } from 'lucide-react'
import { format, addDays } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import { PageContainer } from '@/components/layout/PageContainer'
import { StatsCard } from '@/components/ui/StatsCard'
import { Card } from '@/components/ui/Card'
import { TaskItem } from '@/components/tasks/TaskItem'
import { HeatmapChart } from './HeatmapChart'
import { GoalTracker } from './GoalTracker'
import { ProductivityTrends } from './ProductivityTrends'
import { BestTimeAnalysis } from './BestTimeAnalysis'
import { AISummary } from './AISummary'
import { GoalAchievementChart } from './GoalAchievementChart'
import { MonthlyTrendsChart } from './MonthlyTrendsChart'
import { useTaskStats } from '@/hooks/useTaskStats'
import { dailyBarChartOptions, categoryDoughnutOptions, DAY_LABELS, getBarChartColor } from '@/lib/chartConfig'
import { formatWeekRange, formatStreak, getTodayString } from '@/lib/dateUtils'
import { useTaskStore } from '@/stores/taskStore'
import { useCategoryStore } from '@/stores/categoryStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useProfileStore } from '@/stores/profileStore'
import type { UserProfile } from '@/lib/types'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Filler, Tooltip, Legend)

export function ProfilePage() {
  const tasks = useTaskStore((s) => s.tasks)
  const toggleComplete = useTaskStore((s) => s.toggleComplete)
  const toggleFlag = useTaskStore((s) => s.toggleFlag)
  const categories = useCategoryStore((s) => s.categories)
  const navigate = useNavigate()

  const [weekOffset, setWeekOffset] = useState(0)
  const [daysFilter] = useState(30)


  const userProfile = useSettingsStore((s) => s.settings.userProfile)
  const currentStreak = useProfileStore((s) => s.stats.currentStreak)

  // Combined profile data
  const profile: UserProfile = {
    ...userProfile,
    currentStreak,
  }

  const { completedCount, pendingCount, dailyCompletionData, categoryBreakdown } =
    useTaskStats(tasks, categories, weekOffset)

  // Week range label
  const weekRangeLabel = useMemo(() => {
    const today = new Date()
    const offsetDate = addDays(today, weekOffset * 7)
    return formatWeekRange(offsetDate)
  }, [weekOffset])

  // Bar chart data
  const barChartData = useMemo(() => {
    const isDark = document.documentElement.classList.contains('dark')
    return {
      labels: DAY_LABELS,
      datasets: [
        {
          data: dailyCompletionData.map((d) => d.count),
          backgroundColor: getBarChartColor(isDark),
          borderRadius: 4,
          barThickness: 20,
        },
      ],
    }
  }, [dailyCompletionData])

  const hasBarData = dailyCompletionData.some((d) => d.count > 0)

  // Doughnut chart data
  const doughnutChartData = useMemo(() => {
    if (categoryBreakdown.length === 0) {
      return {
        labels: ['없음'],
        datasets: [
          {
            data: [1],
            backgroundColor: ['#e4e4e7'],
            borderWidth: 0,
          },
        ],
      }
    }

    return {
      labels: categoryBreakdown.map((c) => c.categoryName),
      datasets: [
        {
          data: categoryBreakdown.map((c) => c.count),
          backgroundColor: categoryBreakdown.map((c) => c.categoryColor),
          borderWidth: 0,
        },
      ],
    }
  }, [categoryBreakdown])

  // Upcoming 7-day tasks
  const upcomingTasks = useMemo(() => {
    const today = getTodayString()
    const weekLater = format(addDays(new Date(), 7), 'yyyy-MM-dd')

    return tasks
      .filter(
        (t) =>
          t.status === 'pending' &&
          t.dueDate &&
          t.dueDate >= today &&
          t.dueDate <= weekLater
      )
      .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))
  }, [tasks])

  const getCategoryInfo = (categoryId: number | null) => {
    if (categoryId === null) return { name: undefined, color: undefined }
    const cat = categories.find((c) => c.id === categoryId)
    return { name: cat?.name, color: cat?.color }
  }

  const handleTaskClick = (id: number) => {
    window.location.hash = `#/task/${id}`
  }

  return (
    <PageContainer>
      {/* Profile header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-14 h-14 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
          <User className="w-7 h-7 text-primary-600 dark:text-primary-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            안녕하세요 {profile.name}
          </h1>
          <p className="text-sm text-primary-600 dark:text-primary-400 font-medium">
            {formatStreak(profile.currentStreak)}
          </p>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatsCard
          label="완료된 작업"
          value={completedCount}
          valueColor="success"
        />
        <StatsCard
          label="대기 중인 작업"
          value={pendingCount}
          valueColor="warning"
        />
      </div>

      {/* Goal tracker */}
      <Card className="mb-6">
        <GoalTracker tasks={tasks} />
      </Card>

      {/* Heatmap */}
      <Card className="mb-6">
        <HeatmapChart tasks={tasks} />
      </Card>

      {/* Daily completion bar chart */}
      <Card className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            일일 완료 현황
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setWeekOffset((prev) => prev - 1)}
              className="p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs text-zinc-500 dark:text-zinc-400 min-w-[80px] text-center">
              {weekRangeLabel}
            </span>
            <button
              type="button"
              onClick={() => setWeekOffset((prev) => prev + 1)}
              className="p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {hasBarData ? (
          <div className="h-48">
            <Bar data={barChartData} options={dailyBarChartOptions} />
          </div>
        ) : (
          <div className="h-48 flex items-center justify-center">
            <p className="text-sm text-zinc-400 dark:text-zinc-500">
              할 일이 없습니다
            </p>
          </div>
        )}
      </Card>

      {/* Goal achievement chart */}
      <Card className="mb-6">
        <GoalAchievementChart tasks={tasks} />
      </Card>

      {/* Monthly trends chart */}
      <Card className="mb-6">
        <MonthlyTrendsChart tasks={tasks} />
      </Card>

      {/* Productivity trends */}
      <Card className="mb-6">
        <ProductivityTrends tasks={tasks} />
      </Card>

      {/* Best time analysis */}
      <Card className="mb-6">
        <BestTimeAnalysis tasks={tasks} />
      </Card>

      {/* AI Summary */}
      <Card className="mb-6">
        <AISummary tasks={tasks} />
      </Card>

      {/* Upcoming tasks */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
          향후 7일간의 작업
        </h3>
        {upcomingTasks.length === 0 ? (
          <Card>
            <p className="text-sm text-zinc-400 dark:text-zinc-500 text-center py-4">
              예정된 작업이 없습니다
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {upcomingTasks.map((task) => {
              const { name, color } = getCategoryInfo(task.categoryId)
              return (
                <TaskItem
                  key={task.id}
                  task={task}
                  categoryName={name}
                  categoryColor={color}
                  onToggleComplete={toggleComplete}
                  onToggleFlag={toggleFlag}
                  onClick={handleTaskClick}
                />
              )
            })}
          </div>
        )}
      </div>

      {/* Category doughnut chart */}
      <Card className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            완료되지 않은 작업(카테고리별)
          </h3>
          <span className="text-xs text-zinc-400 dark:text-zinc-500 px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800">
            {daysFilter}일 이내
          </span>
        </div>

        {categoryBreakdown.length === 0 ? (
          <div className="h-48 flex items-center justify-center">
            <p className="text-sm text-zinc-400 dark:text-zinc-500">
              대기 중인 작업이 없습니다
            </p>
          </div>
        ) : (
          <div className="h-56">
            <Doughnut data={doughnutChartData} options={categoryDoughnutOptions} />
          </div>
        )}
      </Card>

      {/* Activity log link */}
      <button
        type="button"
        onClick={() => navigate('/activity')}
        className="w-full mb-6"
      >
        <Card>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-primary-500" />
              <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">활동 기록</span>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-400" />
          </div>
        </Card>
      </button>
    </PageContainer>
  )
}
