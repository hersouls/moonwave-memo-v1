import { useState, useMemo } from 'react'
import { CheckSquare } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { PageContainer } from '@/components/layout/PageContainer'
import { CategoryTabs } from './CategoryTabs'
import { TaskItem } from './TaskItem'
import { TaskEmptyState } from './TaskEmptyState'
import { TaskCreateModal } from './TaskCreateModal'
import { TaskGroupSection } from './TaskGroup'
import { BatchActionBar } from './BatchActionBar'
import { FAB } from '@/components/ui/FAB'
import { PrintButton } from '@/components/ui/PrintButton'
import { useTaskFilters } from '@/hooks/useTaskFilters'
import { groupTasksByDate } from '@/lib/taskGrouping'
import { useTaskStore } from '@/stores/taskStore'
import { useCategoryStore } from '@/stores/categoryStore'
import { useUIStore } from '@/stores/uiStore'
import { useAuthStore } from '@/stores/authStore'
import { useGroupStore } from '@/stores/groupStore'

export function TaskList() {
  const tasks = useTaskStore((s) => s.tasks)
  const toggleComplete = useTaskStore((s) => s.toggleComplete)
  const toggleFlag = useTaskStore((s) => s.toggleFlag)
  const updateTask = useTaskStore((s) => s.updateTask)
  const deleteTask = useTaskStore((s) => s.deleteTask)
  const reorderTasks = useTaskStore((s) => s.reorderTasks)
  const categories = useCategoryStore((s) => s.categories)
  const isSelectionMode = useUIStore((s) => s.isSelectionMode)
  const toggleSelectionMode = useUIStore((s) => s.toggleSelectionMode)
  const toggleTaskSelection = useUIStore((s) => s.toggleTaskSelection)
  const selectedTaskIds = useUIStore((s) => s.selectedTaskIds)
  const openTaskEditModal = useUIStore((s) => s.openTaskEditModal)
  const syncStatus = useAuthStore((s) => s.syncStatus)
  const groups = useGroupStore((s) => s.groups)

  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  // Filter tasks by selected category
  const filteredTasks = useTaskFilters(tasks, {
    categoryId: activeCategoryId ?? undefined,
    categories,
  })

  // Smart date grouping
  const taskGroups = useMemo(() => groupTasksByDate(filteredTasks), [filteredTasks])

  // Task-to-group mapping for badges
  const taskGroupMap = useMemo(() => {
    const map = new Map<number, { name: string; color: string }[]>()
    for (const g of groups) {
      for (const taskId of g.taskIds) {
        const existing = map.get(taskId) || []
        existing.push({ name: g.name, color: g.color })
        map.set(taskId, existing)
      }
    }
    return map
  }, [groups])

  const getCategoryInfo = (categoryId: number | null) => {
    if (categoryId === null) return { name: undefined, color: undefined }
    const cat = categories.find((c) => c.id === categoryId)
    return { name: cat?.name, color: cat?.color }
  }

  const handleTaskClick = (id: number) => {
    if (isSelectionMode) {
      toggleTaskSelection(id)
      return
    }
    const task = tasks.find((t) => t.id === id)
    if (task) openTaskEditModal(task)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    reorderTasks(Number(active.id), Number(over.id))
  }

  const isEmpty = filteredTasks.length === 0
  const sortableIds = filteredTasks.filter((t) => t.status === 'pending').map((t) => t.id!)

  return (
    <PageContainer>
      {/* Category tabs */}
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <CategoryTabs
            categories={categories}
            activeCategoryId={activeCategoryId}
            onSelect={setActiveCategoryId}
          />
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <PrintButton />
          <button
            type="button"
            onClick={toggleSelectionMode}
            className={`p-2 rounded-lg transition-colors ${isSelectionMode
              ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30'
              : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            title="선택 모드"
          >
            <CheckSquare className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Sync progress bar */}
      {syncStatus === 'syncing' && (
        <div className="mt-3 mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-zinc-400 dark:text-zinc-500">
              동기화 중...
            </span>
          </div>
          <div className="h-1 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
            <div className="h-full bg-primary-500 rounded-full w-full animate-pulse" />
          </div>
        </div>
      )}

      {isEmpty ? (
        <TaskEmptyState />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-4">
              {taskGroups.map((group) => (
                <TaskGroupSection
                  key={group.key}
                  label={group.label}
                  count={group.tasks.length}
                  color={group.color}
                  defaultOpen={group.key !== 'completed'}
                >
                  {group.tasks.map((task) => {
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
                        isSelectionMode={isSelectionMode}
                        isSelected={selectedTaskIds.has(task.id!)}
                        onSelect={toggleTaskSelection}
                        onUpdate={(id, title) => updateTask(id, { title })}
                        onDelete={deleteTask}
                        sortable={task.status === 'pending'}
                        taskGroups={taskGroupMap.get(task.id!)}
                      />
                    )
                  })}
                </TaskGroupSection>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Batch action bar */}
      {isSelectionMode && <BatchActionBar />}

      {/* FAB */}
      {!isSelectionMode && <FAB onClick={() => setIsCreateOpen(true)} />}

      {/* Create modal */}
      <TaskCreateModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />
    </PageContainer>
  )
}
