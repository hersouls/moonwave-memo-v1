import { useState, useEffect, useRef } from 'react'
import { clsx } from 'clsx'
import { Bell, Paperclip, GripVertical } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Checkbox } from '@/components/ui/Checkbox'
import { FlagIcon } from '@/components/ui/FlagIcon'
import { isOverdue, formatDueDate } from '@/lib/dateUtils'
import { formatOverdueBadge } from '@/lib/overdueUtils'
import type { Task } from '@/lib/types'

interface TaskItemProps {
  task: Task
  categoryName?: string
  categoryColor?: string
  onToggleComplete: (id: number) => void
  onToggleFlag: (id: number) => void
  onClick: (id: number) => void
  isSelectionMode?: boolean
  isSelected?: boolean
  onSelect?: (id: number) => void
  onUpdate?: (id: number, title: string) => void
  onDelete?: (id: number) => void
  sortable?: boolean
  taskGroups?: { name: string; color: string }[]
}

export function TaskItem({
  task,
  categoryName,
  categoryColor,
  onToggleComplete,
  onToggleFlag,
  onClick,
  isSelectionMode = false,
  isSelected = false,
  onSelect,
  sortable = false,
  taskGroups,
}: TaskItemProps) {
  const isCompleted = task.status === 'completed'
  const overdue = !isCompleted && isOverdue(task.dueDate)
  const overdueBadge = overdue ? formatOverdueBadge(task.dueDate) : null
  const hasAlarm = task.alarm?.enabled ?? false
  const hasAttachment = Boolean(task.memo)
  const taskId = task.id!

  // Track just-completed animation
  const [justCompleted, setJustCompleted] = useState(false)
  const prevCompletedRef = useRef(isCompleted)

  useEffect(() => {
    if (isCompleted && !prevCompletedRef.current) {
      setJustCompleted(true)
      const timer = setTimeout(() => setJustCompleted(false), 500)
      return () => clearTimeout(timer)
    }
    prevCompletedRef.current = isCompleted
  }, [isCompleted])

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: taskId,
    disabled: !sortable || isSelectionMode,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      role="button"
      tabIndex={0}
      onClick={() => onClick(taskId)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick(taskId)
        }
      }}
      className={clsx(
        'flex items-center gap-3 p-3 rounded-xl',
        'bg-white dark:bg-zinc-900',
        'border border-zinc-200 dark:border-zinc-800',
        'cursor-pointer transition-all duration-200',
        'hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-sm',
        isCompleted && !justCompleted && 'opacity-60',
        justCompleted && 'animate-task-complete',
        isDragging && 'opacity-50 shadow-lg z-50',
        isSelected && 'border-primary-500 dark:border-primary-500 bg-primary-50 dark:bg-primary-900/20',
        overdue && 'border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20'
      )}
    >
      {/* Selection checkbox or drag handle */}
      {isSelectionMode ? (
        <div
          onClick={(e) => {
            e.stopPropagation()
            onSelect?.(taskId)
          }}
          className="flex-shrink-0"
        >
          <Checkbox checked={isSelected} onChange={() => onSelect?.(taskId)} />
        </div>
      ) : sortable ? (
        <div
          {...attributes}
          {...listeners}
          className="flex-shrink-0 cursor-grab active:cursor-grabbing touch-none"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="w-4 h-4 text-zinc-300 dark:text-zinc-600" />
        </div>
      ) : null}

      {/* Checkbox */}
      {!isSelectionMode && (
        <div className={clsx(justCompleted && 'animate-check-scale')}>
          <Checkbox
            checked={isCompleted}
            onChange={() => onToggleComplete(taskId)}
          />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={clsx(
              'text-sm font-medium truncate',
              isCompleted
                ? 'line-through text-zinc-400 dark:text-zinc-500'
                : 'text-zinc-900 dark:text-zinc-100',
              justCompleted && 'animate-strikethrough'
            )}
          >
            {task.title}
          </span>
        </div>

        <div className="flex items-center gap-2 mt-0.5">
          {/* Category badge */}
          {categoryName && (
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium"
              style={{
                backgroundColor: categoryColor ? `${categoryColor}20` : undefined,
                color: categoryColor ?? undefined,
              }}
            >
              {categoryName}
            </span>
          )}

          {/* Group badges */}
          {taskGroups && taskGroups.length > 0 && (
            <>
              {taskGroups.slice(0, 2).map((g, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400"
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: g.color }}
                  />
                  {g.name}
                </span>
              ))}
              {taskGroups.length > 2 && (
                <span className="text-[10px] text-zinc-400">+{taskGroups.length - 2}</span>
              )}
            </>
          )}

          {/* Due date */}
          {task.dueDate && (
            <span
              className={clsx(
                'text-xs',
                overdue
                  ? 'text-red-500 font-medium'
                  : 'text-zinc-400 dark:text-zinc-500'
              )}
            >
              {formatDueDate(task.dueDate)}
            </span>
          )}

          {/* Overdue badge */}
          {overdueBadge && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
              {overdueBadge}
            </span>
          )}

          {/* Icons */}
          {hasAlarm && (
            <Bell className="w-3 h-3 text-zinc-400 dark:text-zinc-500 flex-shrink-0" />
          )}
          {hasAttachment && (
            <Paperclip className="w-3 h-3 text-zinc-400 dark:text-zinc-500 flex-shrink-0" />
          )}
        </div>
      </div>

      {/* Flag */}
      {!isSelectionMode && (
        <FlagIcon
          flagged={task.isFlagged}
          onClick={() => onToggleFlag(taskId)}
        />
      )}
    </div>
  )
}
