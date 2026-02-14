import { useState, useMemo } from 'react'
import { clsx } from 'clsx'
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, ClipboardList } from 'lucide-react'
import { PageContainer } from '@/components/layout/PageContainer'
import { CalendarGrid } from './CalendarGrid'
import { TaskItem } from '@/components/tasks/TaskItem'
import { TaskCreateModal } from '@/components/tasks/TaskCreateModal'
import { CategoryTabs } from '@/components/tasks/CategoryTabs'
import { FAB } from '@/components/ui/FAB'
import { EmptyState } from '@/components/ui/EmptyState'
import { PrintButton } from '@/components/ui/PrintButton'
import { useCalendar } from '@/hooks/useCalendar'
import { useTaskStore } from '@/stores/taskStore'
import { useCategoryStore } from '@/stores/categoryStore'
import { formatCalendarDateLabel } from '@/lib/dateUtils'

export function CalendarView() {
  const tasks = useTaskStore((s) => s.tasks)
  const toggleComplete = useTaskStore((s) => s.toggleComplete)
  const toggleFlag = useTaskStore((s) => s.toggleFlag)
  const categories = useCategoryStore((s) => s.categories)

  const {
    selectedDate,
    monthGrid,
    monthTitle,
    goToNextMonth,
    goToPrevMonth,
    goToToday,
    selectDate,
  } = useCalendar()

  const [isCalendarExpanded, setIsCalendarExpanded] = useState(true)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [calendarCategoryFilter, setCalendarCategoryFilter] = useState<number | null>(null)

  // Compute task dates for dot indicators
  const taskDates = useMemo(() => {
    const dates = new Set<string>()
    tasks.forEach((task) => {
      if (task.dueDate) {
        dates.add(task.dueDate)
      }
    })
    return dates
  }, [tasks])

  // Tasks for selected date (filtered by category, sorted: pending first)
  const selectedDateTasks = useMemo(() => {
    let filtered = tasks.filter((t) => t.dueDate === selectedDate)

    if (calendarCategoryFilter !== null) {
      filtered = filtered.filter((t) => t.categoryId === calendarCategoryFilter)
    }

    return filtered.sort((a, b) => {
      if (a.status === 'pending' && b.status === 'completed') return -1
      if (a.status === 'completed' && b.status === 'pending') return 1
      return 0
    })
  }, [tasks, selectedDate, calendarCategoryFilter])

  const pendingTasks = useMemo(
    () => selectedDateTasks.filter((t) => t.status === 'pending'),
    [selectedDateTasks]
  )
  const completedTasks = useMemo(
    () => selectedDateTasks.filter((t) => t.status === 'completed'),
    [selectedDateTasks]
  )

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
      {/* Month header */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={goToPrevMonth}
          aria-label="이전 달"
          className="p-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            {monthTitle}
          </h2>
          <button
            type="button"
            onClick={() => setIsCalendarExpanded(!isCalendarExpanded)}
            aria-label={isCalendarExpanded ? '캘린더 접기' : '캘린더 펼치기'}
            aria-expanded={isCalendarExpanded}
            className="p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            {isCalendarExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
          <button
            type="button"
            onClick={goToToday}
            className="px-2 py-0.5 text-xs font-medium rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-primary-100 hover:text-primary-600 dark:hover:bg-primary-900/30 dark:hover:text-primary-400 transition-colors"
          >
            오늘
          </button>
        </div>

        <div className="flex items-center gap-1">
          <PrintButton />
          <button
            type="button"
            onClick={goToNextMonth}
            aria-label="다음 달"
            className="p-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Calendar grid with collapse animation */}
      <div
        className={clsx(
          'grid transition-[grid-template-rows] duration-300 ease-in-out',
          isCalendarExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        )}
      >
        <div className="overflow-hidden">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 mb-4">
            <CalendarGrid
              days={monthGrid}
              taskDates={taskDates}
              selectedDate={selectedDate}
              onSelectDate={selectDate}
            />
          </div>
        </div>
      </div>

      {/* Selected date tasks */}
      <div className="mt-4">
        <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-3">
          {formatCalendarDateLabel(selectedDate)} 작업
          {selectedDateTasks.length > 0 && (
            <span className="ml-1 text-zinc-400 dark:text-zinc-500">
              ({selectedDateTasks.length}건)
            </span>
          )}
        </h3>

        {/* Category filter */}
        <div className="mb-3">
          <CategoryTabs
            categories={categories}
            activeCategoryId={calendarCategoryFilter}
            onSelect={setCalendarCategoryFilter}
          />
        </div>

        {selectedDateTasks.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="w-full h-full" />}
            title="당일 작업이 없습니다"
            description="작업을 만들려면 +를 클릭하세요."
            size="sm"
          />
        ) : (
          <div className="space-y-2">
            {/* Pending tasks */}
            {pendingTasks.map((task) => {
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

            {/* Completed separator */}
            {completedTasks.length > 0 && pendingTasks.length > 0 && (
              <div className="flex items-center gap-2 py-1">
                <div className="flex-1 border-t border-zinc-200 dark:border-zinc-800" />
                <span className="text-xs text-zinc-400 dark:text-zinc-500">완료됨</span>
                <div className="flex-1 border-t border-zinc-200 dark:border-zinc-800" />
              </div>
            )}

            {/* Completed tasks */}
            {completedTasks.map((task) => {
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

      {/* FAB - creates task with selected date */}
      <FAB onClick={() => setIsCreateOpen(true)} />

      {/* Create modal with pre-filled date */}
      <TaskCreateModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        defaultDueDate={selectedDate}
      />
    </PageContainer>
  )
}
