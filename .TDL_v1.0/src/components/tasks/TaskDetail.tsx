import { useState, useRef, useEffect } from 'react'
import { clsx } from 'clsx'
import {
  ArrowLeft,
  MoreHorizontal,
  Pencil,
  Plus,
  Calendar,
  Clock,
  Repeat,
  FileText,
  Save,
  Sparkles,
  Loader2,
  Target,
  Share2,
} from 'lucide-react'
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
import { SubtaskItem } from './SubtaskItem'
import { AttachmentSection } from './AttachmentSection'
import { DatePicker } from '@/components/ui/DatePicker'
import { Checkbox } from '@/components/ui/Checkbox'
import { getRepeatLabel } from '@/lib/repeatUtils'
import { useTaskStore } from '@/stores/taskStore'
import { useCategoryStore } from '@/stores/categoryStore'
import { useTemplateStore } from '@/stores/templateStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useUIStore } from '@/stores/uiStore'
import { decomposeTaskWithAI } from '@/services/aiService'
import { useFocusStore } from '@/stores/focusStore'
import { useWebShare } from '@/hooks/useWebShare'
import type { SubTask } from '@/lib/types'

interface TaskDetailProps {
  taskId: number
  onBack: () => void
}

export function TaskDetail({ taskId, onBack }: TaskDetailProps) {
  const task = useTaskStore((s) => s.tasks.find((t) => t.id === taskId))
  const updateTask = useTaskStore((s) => s.updateTask)
  const reorderSubtasks = useTaskStore((s) => s.reorderSubtasks)
  const categories = useCategoryStore((s) => s.categories)
  const addTemplate = useTemplateStore((s) => s.addTemplate)
  const aiEnabled = useSettingsStore((s) => s.settings.aiEnabled)
  const aiApiKey = useSettingsStore((s) => s.settings.aiApiKey)
  const getDecryptedApiKey = useSettingsStore((s) => s.getDecryptedApiKey)
  const openTaskEditModal = useUIStore((s) => s.openTaskEditModal)
  const startFocus = useFocusStore((s) => s.startFocus)
  const { shareTask } = useWebShare()

  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState(task?.title ?? '')
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [isAiDecomposing, setIsAiDecomposing] = useState(false)
  const titleInputRef = useRef<HTMLInputElement>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const taskTitle = task?.title
  useEffect(() => {
    if (taskTitle !== undefined) setTitleValue(taskTitle)
  }, [taskTitle])

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus()
      titleInputRef.current.select()
    }
  }, [isEditingTitle])

  if (!task) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <p className="text-zinc-500 dark:text-zinc-400">작업을 찾을 수 없습니다.</p>
      </div>
    )
  }

  const currentCategory = categories.find((c) => c.id === task.categoryId)

  const handleTitleSave = () => {
    const trimmed = titleValue.trim()
    if (trimmed && trimmed !== task.title) {
      updateTask(taskId, { title: trimmed })
    } else {
      setTitleValue(task.title)
    }
    setIsEditingTitle(false)
  }

  const handleCategoryChange = (categoryId: number | null) => {
    updateTask(taskId, { categoryId })
    setShowCategoryDropdown(false)
  }

  const handleDueDateChange = (date: string) => {
    updateTask(taskId, { dueDate: date || undefined })
  }

  const handleToggleSubtask = (subtaskId: string) => {
    const updatedSubtasks = task.subtasks.map((st) =>
      st.id === subtaskId ? { ...st, isCompleted: !st.isCompleted } : st
    )
    updateTask(taskId, { subtasks: updatedSubtasks })
  }

  const handleUpdateSubtask = (subtaskId: string, title: string) => {
    const updatedSubtasks = task.subtasks.map((st) =>
      st.id === subtaskId ? { ...st, title } : st
    )
    updateTask(taskId, { subtasks: updatedSubtasks })
  }

  const handleDeleteSubtask = (subtaskId: string) => {
    const updatedSubtasks = task.subtasks.filter((st) => st.id !== subtaskId)
    updateTask(taskId, { subtasks: updatedSubtasks })
  }

  const handleAddSubtask = () => {
    const newSubtask: SubTask = {
      id: crypto.randomUUID(),
      title: '',
      isCompleted: false,
      sortOrder: task.subtasks.length,
      createdAt: new Date().toISOString(),
    }
    updateTask(taskId, { subtasks: [...task.subtasks, newSubtask] })
  }

  const handleMemoChange = (memo: string) => {
    updateTask(taskId, { memo: memo || undefined })
  }

  const handleSubtaskDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    reorderSubtasks(taskId, String(active.id), String(over.id))
  }

  const handleSaveAsTemplate = () => {
    addTemplate({
      name: task.title,
      description: task.memo,
      categoryId: task.categoryId,
      priority: task.priority,
      subtasks: task.subtasks.map((st, i) => ({ title: st.title, sortOrder: i })),
      repeat: task.repeat,
      memo: task.memo,
      isBuiltIn: false,
      createdAt: new Date().toISOString(),
    })
    setShowMoreMenu(false)
  }

  const handleAiDecompose = async () => {
    if (!aiApiKey || !task) return
    setIsAiDecomposing(true)
    try {
      const decryptedKey = await getDecryptedApiKey()
      const subtasks = await decomposeTaskWithAI(decryptedKey, task.title, task.memo)
      const newSubtasks: SubTask[] = subtasks.map((st, i) => ({
        id: crypto.randomUUID(),
        title: st.title,
        isCompleted: false,
        sortOrder: task.subtasks.length + i,
        createdAt: new Date().toISOString(),
      }))
      updateTask(taskId, { subtasks: [...task.subtasks, ...newSubtasks] })
    } catch (error) {
      console.error('AI decompose failed:', error)
      alert(error instanceof Error ? error.message : 'AI 분해에 실패했습니다.')
    } finally {
      setIsAiDecomposing(false)
    }
  }

  const completedSubtasks = task.subtasks.filter((st) => st.isCompleted).length
  const totalSubtasks = task.subtasks.length
  const sortedSubtasks = [...task.subtasks].sort((a, b) => a.sortOrder - b.sortOrder)
  const subtaskIds = sortedSubtasks.map((st) => st.id)

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-zinc-950 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <button
          type="button"
          onClick={onBack}
          className="p-1.5 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            className="p-1.5 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>

          {showMoreMenu && (
            <div className="absolute top-full right-0 mt-1 w-48 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-lg z-20 py-1">
              <button
                type="button"
                onClick={() => {
                  setShowMoreMenu(false)
                  openTaskEditModal(task)
                }}
                className="w-full text-left px-3 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-2"
              >
                <Pencil className="w-4 h-4" />
                수정
              </button>
              {task.status === 'pending' && (
                <button
                  type="button"
                  onClick={() => {
                    setShowMoreMenu(false)
                    startFocus(taskId, task.title)
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-2"
                >
                  <Target className="w-4 h-4 text-primary-500" />
                  집중 모드
                </button>
              )}
              {aiEnabled && aiApiKey && (
                <button
                  type="button"
                  onClick={() => {
                    setShowMoreMenu(false)
                    handleAiDecompose()
                  }}
                  disabled={isAiDecomposing}
                  className="w-full text-left px-3 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-2 disabled:opacity-50"
                >
                  {isAiDecomposing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-purple-500" />
                  )}
                  AI 하위 작업 분해
                </button>
              )}
              <button
                type="button"
                onClick={handleSaveAsTemplate}
                className="w-full text-left px-3 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                템플릿으로 저장
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowMoreMenu(false)
                  await shareTask(task)
                }}
                className="w-full text-left px-3 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-2"
              >
                <Share2 className="w-4 h-4" />
                공유
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Category badge + Priority badge */}
        <div className="relative flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
            className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
            style={{
              backgroundColor: currentCategory
                ? `${currentCategory.color}20`
                : 'rgb(244 244 245)',
              color: currentCategory?.color ?? '#71717a',
            }}
          >
            {currentCategory?.name ?? '미분류'}
          </button>
          {task.priority !== 'none' && (
            <span
              className={clsx(
                'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                task.priority === 'high' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                task.priority === 'medium' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                task.priority === 'low' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
              )}
            >
              {task.priority === 'high' ? '높음' : task.priority === 'medium' ? '중간' : '낮음'}
            </span>
          )}

          {/* Category dropdown */}
          {showCategoryDropdown && (
            <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-lg z-20 py-1">
              <button
                type="button"
                onClick={() => handleCategoryChange(null)}
                className="w-full text-left px-3 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                미분류
              </button>
              {categories
                .filter((c) => !c.parentId)
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((root) => {
                  const children = categories
                    .filter((c) => c.parentId === root.id)
                    .sort((a, b) => a.sortOrder - b.sortOrder)

                  return (
                    <div key={root.id}>
                      <button
                        type="button"
                        onClick={() => handleCategoryChange(root.id ?? null)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-2"
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: root.color }}
                        />
                        <span className="text-zinc-900 dark:text-zinc-100">{root.name}</span>
                      </button>
                      {children.map((child) => (
                        <button
                          key={child.id}
                          type="button"
                          onClick={() => handleCategoryChange(child.id ?? null)}
                          className="w-full text-left pl-8 pr-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center gap-2"
                        >
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: child.color }}
                          />
                          <span className="text-zinc-900 dark:text-zinc-100">{child.name}</span>
                        </button>
                      ))}
                    </div>
                  )
                })}
            </div>
          )}
        </div>

        {/* Title */}
        <div className="flex items-start gap-3">
          <Checkbox
            checked={task.status === 'completed'}
            onChange={() => {
              updateTask(taskId, {
                status: task.status === 'completed' ? 'pending' : 'completed',
                completedAt: task.status === 'completed' ? undefined : new Date().toISOString(),
              })
            }}
          />
          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              type="text"
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleTitleSave()
                if (e.key === 'Escape') {
                  setTitleValue(task.title)
                  setIsEditingTitle(false)
                }
              }}
              className="flex-1 text-xl font-bold bg-transparent border-none outline-none text-zinc-900 dark:text-zinc-100"
            />
          ) : (
            <h1
              onClick={() => setIsEditingTitle(true)}
              className={`flex-1 text-xl font-bold cursor-text ${task.status === 'completed'
                  ? 'line-through text-zinc-400 dark:text-zinc-500'
                  : 'text-zinc-900 dark:text-zinc-100'
                }`}
            >
              {task.title}
            </h1>
          )}
        </div>

        {/* Subtasks */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              하위 작업
              {totalSubtasks > 0 && (
                <span className="ml-1.5 text-xs text-zinc-400">
                  {completedSubtasks}/{totalSubtasks}
                </span>
              )}
            </span>
          </div>

          {/* Subtask progress */}
          {totalSubtasks > 0 && (
            <div className="h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-primary-500 rounded-full transition-all duration-300"
                style={{
                  width: `${totalSubtasks > 0 ? (completedSubtasks / totalSubtasks) * 100 : 0}%`,
                }}
              />
            </div>
          )}

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSubtaskDragEnd}>
            <SortableContext items={subtaskIds} strategy={verticalListSortingStrategy}>
              <div className="space-y-0.5">
                {sortedSubtasks.map((subtask) => (
                  <SubtaskItem
                    key={subtask.id}
                    subtask={subtask}
                    onToggle={handleToggleSubtask}
                    onUpdate={handleUpdateSubtask}
                    onDelete={handleDeleteSubtask}
                    sortable
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <button
            type="button"
            onClick={handleAddSubtask}
            className="flex items-center gap-2 mt-2 px-2 py-1.5 text-sm text-primary-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            하위 작업 추가
          </button>
        </div>

        {/* Properties divider */}
        <div className="border-t border-zinc-200 dark:border-zinc-800" />

        {/* Properties */}
        <div className="space-y-0">
          {/* Due Date */}
          <div className="flex items-center justify-between py-3 border-b border-zinc-100 dark:border-zinc-800/50">
            <div className="flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400">
              <Calendar className="w-4 h-4" />
              <span>마감일</span>
            </div>
            <DatePicker
              value={task.dueDate}
              onChange={handleDueDateChange}
              placeholder="아니요"
            />
          </div>

          {/* Time & Alarm */}
          <div className="flex items-center justify-between py-3 border-b border-zinc-100 dark:border-zinc-800/50">
            <div className="flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400">
              <Clock className="w-4 h-4" />
              <span>시간 & 알림</span>
            </div>
            <button
              type="button"
              onClick={() => openTaskEditModal(task)}
              className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-primary-500 dark:hover:text-primary-400 transition-colors"
            >
              {task.alarm?.enabled ? '설정됨' : '아니요'}
            </button>
          </div>

          {/* Repeat */}
          <div className="flex items-center justify-between py-3 border-b border-zinc-100 dark:border-zinc-800/50">
            <div className="flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400">
              <Repeat className="w-4 h-4" />
              <span>반복 작업</span>
            </div>
            <button
              type="button"
              onClick={() => openTaskEditModal(task)}
              className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-primary-500 dark:hover:text-primary-400 transition-colors"
            >
              {getRepeatLabel(task.repeat)}
            </button>
          </div>

          {/* Memo */}
          <div className="py-3 border-b border-zinc-100 dark:border-zinc-800/50">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400">
                <FileText className="w-4 h-4" />
                <span>메모</span>
              </div>
              {!task.memo && (
                <button
                  type="button"
                  onClick={() => handleMemoChange(' ')}
                  className="text-sm text-primary-500 hover:text-primary-600"
                >
                  추가
                </button>
              )}
            </div>
            {task.memo !== undefined && (
              <textarea
                value={task.memo}
                onChange={(e) => handleMemoChange(e.target.value)}
                placeholder="메모를 입력하세요..."
                rows={3}
                className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none resize-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
            )}
          </div>

          {/* Attachment */}
          <div className="py-3">
            <AttachmentSection taskId={taskId} />
          </div>
        </div>
      </div>
    </div>
  )
}
