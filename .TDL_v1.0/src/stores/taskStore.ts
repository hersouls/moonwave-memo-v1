import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { Task, SubTask, CompletionLog, RepeatPattern, TaskPriority } from '@/lib/types'
import {
  getAllTasks,
  addTask as dbAddTask,
  updateTask as dbUpdateTask,
  deleteTask as dbDeleteTask,
  addCompletionLog,
  bulkUpdateTasks as dbBulkUpdateTasks,
  bulkDeleteTasks as dbBulkDeleteTasks,
  db,
} from '@/services/database'
import { useUndoStore } from './undoStore'
import { useActivityStore } from './activityStore'
import { useProfileStore } from './profileStore'
import { pushTask, pushCompletionLog, deleteTaskFromCloud } from '@/services/firestoreSync'
import { generateSyncId } from '@/services/database'

// ─── Repeat Task Generation ──────────────────────
function generateNextDueDate(dueDate: string, repeat: RepeatPattern): string | undefined {
  if (repeat.type === 'none') return undefined

  const date = new Date(dueDate)

  switch (repeat.type) {
    case 'daily':
      date.setDate(date.getDate() + repeat.interval)
      break
    case 'weekly':
      date.setDate(date.getDate() + 7 * repeat.interval)
      break
    case 'monthly':
      date.setMonth(date.getMonth() + repeat.interval)
      break
    case 'yearly':
      date.setFullYear(date.getFullYear() + repeat.interval)
      break
  }

  const nextDate = date.toISOString().split('T')[0]

  // If end date is set and next date exceeds it, do not generate
  if (repeat.endDate && nextDate > repeat.endDate) {
    return undefined
  }

  return nextDate
}

function generateNextTask(task: Task): Omit<Task, 'id'> | null {
  if (task.repeat.type === 'none' || !task.dueDate) return null

  const nextDueDate = generateNextDueDate(task.dueDate, task.repeat)
  if (!nextDueDate) return null

  const now = new Date().toISOString()

  return {
    title: task.title,
    categoryId: task.categoryId,
    status: 'pending',
    priority: task.priority,
    isFlagged: false,
    isStarred: false,
    dueDate: nextDueDate,
    dueTime: task.dueTime,
    alarm: task.alarm ? { ...task.alarm } : { enabled: false },
    repeat: { ...task.repeat },
    memo: task.memo,
    subtasks: task.subtasks.map((st) => ({
      ...st,
      isCompleted: false,
    })),
    completedAt: undefined,
    createdAt: now,
    updatedAt: now,
    sortOrder: task.sortOrder,
  }
}

// ─── Store ────────────────────────────────────────
interface TaskState {
  tasks: Task[]
  activeTaskId: number | null
  isLoading: boolean
  error: string | null

  // Task actions
  initialize: () => Promise<void>
  addTask: (data: Omit<Task, 'id'>) => Promise<number | undefined>
  updateTask: (id: number, updates: Partial<Task>) => Promise<void>
  deleteTask: (id: number) => Promise<void>
  toggleComplete: (id: number) => Promise<void>
  toggleFlag: (id: number) => Promise<void>
  toggleStar: (id: number) => Promise<void>
  setActiveTask: (id: number | null) => void

  // Subtask actions
  addSubtask: (taskId: number, title: string) => Promise<void>
  updateSubtask: (taskId: number, subtaskId: string, updates: Partial<SubTask>) => Promise<void>
  deleteSubtask: (taskId: number, subtaskId: string) => Promise<void>
  toggleSubtaskComplete: (taskId: number, subtaskId: string) => Promise<void>

  // Reorder actions
  reorderTasks: (activeId: number, overId: number) => Promise<void>
  reorderSubtasks: (taskId: number, activeId: string, overId: string) => Promise<void>

  // Batch actions
  batchComplete: (ids: number[]) => Promise<void>
  batchDelete: (ids: number[]) => Promise<void>
  batchMoveCategory: (ids: number[], categoryId: number | null) => Promise<void>
  batchSetPriority: (ids: number[], priority: TaskPriority) => Promise<void>
  refreshFromDb: () => Promise<void>
  seedTutorialTasks: () => Promise<void>
}

export const useTaskStore = create<TaskState>()(
  devtools(
    (set, get) => ({
      tasks: [],
      activeTaskId: null,
      isLoading: false,
      error: null,

      initialize: async () => {
        set({ isLoading: true, error: null })
        try {
          const tasks = await getAllTasks()
          set({ tasks, isLoading: false })
        } catch (err) {
          set({ error: (err as Error).message, isLoading: false })
        }
      },

      addTask: async (data) => {
        try {
          const syncId = data.syncId || generateSyncId()
          const taskData = { ...data, syncId }
          const id = await dbAddTask(taskData)
          const newTask: Task = { ...taskData, id }
          set((state) => ({ tasks: [...state.tasks, newTask] }))

          useActivityStore.getState().addLog(id, data.title, 'task-created')
          pushTask(newTask).catch(console.error)
          return id
        } catch (err) {
          set({ error: (err as Error).message })
          return undefined
        }
      },

      updateTask: async (id, updates) => {
        try {
          await dbUpdateTask(id, updates)
          set((state) => ({
            tasks: state.tasks.map((t) =>
              t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
            ),
          }))
          const updated = get().tasks.find(t => t.id === id)
          if (updated) pushTask(updated).catch(console.error)
        } catch (err) {
          set({ error: (err as Error).message })
        }
      },

      deleteTask: async (id) => {
        const task = get().tasks.find((t) => t.id === id)
        if (!task) return

        // Undo 스냅샷 저장
        const snapshot = { ...task }
        useUndoStore.getState().pushAction({
          type: 'delete',
          label: '작업이 삭제되었습니다',
          undo: async () => {
            const newId = await dbAddTask({ ...snapshot, id: undefined } as Omit<Task, 'id'>)
            const restored: Task = { ...snapshot, id: newId }
            set((state) => ({ tasks: [...state.tasks, restored] }))
          },
          redo: async () => {
            await dbDeleteTask(id)
            set((state) => ({
              tasks: state.tasks.filter((t) => t.id !== id),
              activeTaskId: state.activeTaskId === id ? null : state.activeTaskId,
            }))
          },
        })

        try {
          await dbDeleteTask(id)
          deleteTaskFromCloud(task.syncId).catch(console.error)
          set((state) => ({
            tasks: state.tasks.filter((t) => t.id !== id),
            activeTaskId: state.activeTaskId === id ? null : state.activeTaskId,
          }))

          useActivityStore.getState().addLog(id, task.title, 'task-deleted')
        } catch (err) {
          set({ error: (err as Error).message })
        }
      },

      toggleComplete: async (id) => {
        const task = get().tasks.find((t) => t.id === id)
        if (!task) return

        const wasCompleted = task.status === 'completed'

        // Undo 스냅샷
        useUndoStore.getState().pushAction({
          type: 'complete',
          label: wasCompleted ? '작업 완료가 취소되었습니다' : '작업이 완료되었습니다',
          undo: async () => {
            if (wasCompleted) {
              await dbUpdateTask(id, { status: 'completed', completedAt: task.completedAt })
              set((state) => ({
                tasks: state.tasks.map((t) =>
                  t.id === id ? { ...t, status: 'completed' as const, completedAt: task.completedAt } : t
                ),
              }))
            } else {
              await dbUpdateTask(id, { status: 'pending', completedAt: undefined })
              set((state) => ({
                tasks: state.tasks.map((t) =>
                  t.id === id ? { ...t, status: 'pending' as const, completedAt: undefined } : t
                ),
              }))
            }
          },
          redo: async () => {
            get().toggleComplete(id)
          },
        })

        try {
          if (task.status === 'pending') {
            const now = new Date().toISOString()
            const todayDate = now.split('T')[0]

            await dbUpdateTask(id, { status: 'completed', completedAt: now })

            const logSyncId = generateSyncId()
            const log: Omit<CompletionLog, 'id'> = {
              syncId: logSyncId,
              taskId: id,
              completedAt: now,
              date: todayDate,
            }
            await addCompletionLog(log)
            if (task.syncId) {
              pushCompletionLog(log as CompletionLog, task.syncId).catch(console.error)
            }

            set((state) => ({
              tasks: state.tasks.map((t) =>
                t.id === id ? { ...t, status: 'completed' as const, completedAt: now, updatedAt: now } : t
              ),
            }))

            useActivityStore.getState().addLog(id, task.title, 'task-completed')
            useProfileStore.getState().calculateStreak()
            const completedTask = get().tasks.find(t => t.id === id)
            if (completedTask) pushTask(completedTask).catch(console.error)

            // Generate next repeat task if applicable
            if (task.repeat.type !== 'none') {
              const nextTaskData = generateNextTask(task)
              if (nextTaskData) {
                const nextSyncId = generateSyncId()
                const nextDataWithSync = { ...nextTaskData, syncId: nextSyncId }
                const nextId = await dbAddTask(nextDataWithSync)
                const nextTask: Task = { ...nextDataWithSync, id: nextId }
                set((state) => ({ tasks: [...state.tasks, nextTask] }))
                pushTask(nextTask).catch(console.error)
              }
            }
          } else {
            await dbUpdateTask(id, { status: 'pending', completedAt: undefined })
            set((state) => ({
              tasks: state.tasks.map((t) =>
                t.id === id
                  ? { ...t, status: 'pending' as const, completedAt: undefined, updatedAt: new Date().toISOString() }
                  : t
              ),
            }))
            const uncompletedTask = get().tasks.find(t => t.id === id)
            if (uncompletedTask) pushTask(uncompletedTask).catch(console.error)

            useActivityStore.getState().addLog(id, task.title, 'task-uncompleted')
            useProfileStore.getState().calculateStreak()
          }
        } catch (err) {
          set({ error: (err as Error).message })
        }
      },

      toggleFlag: async (id) => {
        const task = get().tasks.find((t) => t.id === id)
        if (!task) return

        try {
          const isFlagged = !task.isFlagged
          await dbUpdateTask(id, { isFlagged })
          set((state) => ({
            tasks: state.tasks.map((t) =>
              t.id === id ? { ...t, isFlagged, updatedAt: new Date().toISOString() } : t
            ),
          }))

          useActivityStore.getState().addLog(id, task.title, isFlagged ? 'task-flagged' : 'task-unflagged')
          const flaggedTask = get().tasks.find(t => t.id === id)
          if (flaggedTask) pushTask(flaggedTask).catch(console.error)
        } catch (err) {
          set({ error: (err as Error).message })
        }
      },

      toggleStar: async (id) => {
        const task = get().tasks.find((t) => t.id === id)
        if (!task) return

        try {
          const isStarred = !task.isStarred
          await dbUpdateTask(id, { isStarred })
          set((state) => ({
            tasks: state.tasks.map((t) =>
              t.id === id ? { ...t, isStarred, updatedAt: new Date().toISOString() } : t
            ),
          }))
          const starredTask = get().tasks.find(t => t.id === id)
          if (starredTask) pushTask(starredTask).catch(console.error)
        } catch (err) {
          set({ error: (err as Error).message })
        }
      },

      setActiveTask: (id) => {
        set({ activeTaskId: id })
      },

      // ─── Subtask Actions ──────────────────────────
      addSubtask: async (taskId, title) => {
        const task = get().tasks.find((t) => t.id === taskId)
        if (!task) return

        const newSubtask: SubTask = {
          id: crypto.randomUUID(),
          title,
          isCompleted: false,
          sortOrder: task.subtasks.length,
          createdAt: new Date().toISOString(),
        }

        const updatedSubtasks = [...task.subtasks, newSubtask]

        try {
          await dbUpdateTask(taskId, { subtasks: updatedSubtasks })
          set((state) => ({
            tasks: state.tasks.map((t) =>
              t.id === taskId
                ? { ...t, subtasks: updatedSubtasks, updatedAt: new Date().toISOString() }
                : t
            ),
          }))

          useActivityStore.getState().addLog(taskId, task.title, 'subtask-added', title)
          const parentAfterAdd = get().tasks.find(t => t.id === taskId)
          if (parentAfterAdd) pushTask(parentAfterAdd).catch(console.error)
        } catch (err) {
          set({ error: (err as Error).message })
        }
      },

      updateSubtask: async (taskId, subtaskId, updates) => {
        const task = get().tasks.find((t) => t.id === taskId)
        if (!task) return

        const updatedSubtasks = task.subtasks.map((st) =>
          st.id === subtaskId ? { ...st, ...updates } : st
        )

        try {
          await dbUpdateTask(taskId, { subtasks: updatedSubtasks })
          set((state) => ({
            tasks: state.tasks.map((t) =>
              t.id === taskId
                ? { ...t, subtasks: updatedSubtasks, updatedAt: new Date().toISOString() }
                : t
            ),
          }))
          const updParent = get().tasks.find(t => t.id === taskId)
          if (updParent) pushTask(updParent).catch(console.error)
        } catch (err) {
          set({ error: (err as Error).message })
        }
      },

      deleteSubtask: async (taskId, subtaskId) => {
        const task = get().tasks.find((t) => t.id === taskId)
        if (!task) return

        const updatedSubtasks = task.subtasks.filter((st) => st.id !== subtaskId)

        try {
          await dbUpdateTask(taskId, { subtasks: updatedSubtasks })
          set((state) => ({
            tasks: state.tasks.map((t) =>
              t.id === taskId
                ? { ...t, subtasks: updatedSubtasks, updatedAt: new Date().toISOString() }
                : t
            ),
          }))
          const delParent = get().tasks.find(t => t.id === taskId)
          if (delParent) pushTask(delParent).catch(console.error)
        } catch (err) {
          set({ error: (err as Error).message })
        }
      },

      toggleSubtaskComplete: async (taskId, subtaskId) => {
        const task = get().tasks.find((t) => t.id === taskId)
        if (!task) return

        const updatedSubtasks = task.subtasks.map((st) =>
          st.id === subtaskId ? { ...st, isCompleted: !st.isCompleted } : st
        )

        try {
          await dbUpdateTask(taskId, { subtasks: updatedSubtasks })
          set((state) => ({
            tasks: state.tasks.map((t) =>
              t.id === taskId
                ? { ...t, subtasks: updatedSubtasks, updatedAt: new Date().toISOString() }
                : t
            ),
          }))
          const togParent = get().tasks.find(t => t.id === taskId)
          if (togParent) pushTask(togParent).catch(console.error)
        } catch (err) {
          set({ error: (err as Error).message })
        }
      },

      // ─── Reorder Actions ──────────────────────────
      reorderTasks: async (activeId, overId) => {
        const { tasks } = get()
        const sortedPending = [...tasks]
          .filter((t) => t.status === 'pending')
          .sort((a, b) => a.sortOrder - b.sortOrder)

        const oldIndex = sortedPending.findIndex((t) => t.id === activeId)
        const newIndex = sortedPending.findIndex((t) => t.id === overId)
        if (oldIndex === -1 || newIndex === -1) return

        const reordered = [...sortedPending]
        const [moved] = reordered.splice(oldIndex, 1)
        reordered.splice(newIndex, 0, moved)

        // sortOrder 갱신
        const updates: { id: number; sortOrder: number }[] = reordered.map((t, i) => ({
          id: t.id!,
          sortOrder: i,
        }))

        try {
          await db.transaction('rw', db.tasks, async () => {
            for (const u of updates) {
              await db.tasks.update(u.id, { sortOrder: u.sortOrder, updatedAt: new Date().toISOString() })
            }
          })

          set((state) => ({
            tasks: state.tasks.map((t) => {
              const update = updates.find((u) => u.id === t.id)
              return update ? { ...t, sortOrder: update.sortOrder } : t
            }),
          }))
          for (const u of updates) {
            const t = get().tasks.find(task => task.id === u.id)
            if (t) pushTask(t).catch(console.error)
          }
        } catch (err) {
          set({ error: (err as Error).message })
        }
      },

      reorderSubtasks: async (taskId, activeId, overId) => {
        const task = get().tasks.find((t) => t.id === taskId)
        if (!task) return

        const subtasks = [...task.subtasks].sort((a, b) => a.sortOrder - b.sortOrder)
        const oldIndex = subtasks.findIndex((s) => s.id === activeId)
        const newIndex = subtasks.findIndex((s) => s.id === overId)
        if (oldIndex === -1 || newIndex === -1) return

        const [moved] = subtasks.splice(oldIndex, 1)
        subtasks.splice(newIndex, 0, moved)

        const updatedSubtasks = subtasks.map((st, i) => ({ ...st, sortOrder: i }))

        try {
          await dbUpdateTask(taskId, { subtasks: updatedSubtasks })
          set((state) => ({
            tasks: state.tasks.map((t) =>
              t.id === taskId ? { ...t, subtasks: updatedSubtasks, updatedAt: new Date().toISOString() } : t
            ),
          }))
          const reorderedParent = get().tasks.find(t => t.id === taskId)
          if (reorderedParent) pushTask(reorderedParent).catch(console.error)
        } catch (err) {
          set({ error: (err as Error).message })
        }
      },

      // ─── Batch Actions ────────────────────────────
      batchComplete: async (ids) => {
        const tasksToComplete = get().tasks.filter((t) => ids.includes(t.id!) && t.status === 'pending')
        if (tasksToComplete.length === 0) return

        // Undo 스냅샷
        const snapshots = tasksToComplete.map((t) => ({ ...t }))
        useUndoStore.getState().pushAction({
          type: 'batch-complete',
          label: `${tasksToComplete.length}개 작업이 완료되었습니다`,
          undo: async () => {
            for (const snap of snapshots) {
              await dbUpdateTask(snap.id!, { status: 'pending', completedAt: undefined })
            }
            set((state) => ({
              tasks: state.tasks.map((t) => {
                const snap = snapshots.find((s) => s.id === t.id)
                return snap ? { ...t, status: 'pending' as const, completedAt: undefined } : t
              }),
            }))
          },
          redo: async () => {
            get().batchComplete(ids)
          },
        })

        try {
          const now = new Date().toISOString()
          const todayDate = now.split('T')[0]

          await dbBulkUpdateTasks(ids, { status: 'completed', completedAt: now })

          // 완료 로그 추가
          for (const task of tasksToComplete) {
            await addCompletionLog({ taskId: task.id!, completedAt: now, date: todayDate })
          }

          set((state) => ({
            tasks: state.tasks.map((t) =>
              ids.includes(t.id!) ? { ...t, status: 'completed' as const, completedAt: now, updatedAt: now } : t
            ),
          }))
          for (const id of ids) {
            const t = get().tasks.find(task => task.id === id)
            if (t) pushTask(t).catch(console.error)
          }
        } catch (err) {
          set({ error: (err as Error).message })
        }
      },

      batchDelete: async (ids) => {
        const tasksToDelete = get().tasks.filter((t) => ids.includes(t.id!))
        if (tasksToDelete.length === 0) return

        // Undo 스냅샷
        const snapshots = tasksToDelete.map((t) => ({ ...t }))
        useUndoStore.getState().pushAction({
          type: 'batch-delete',
          label: `${tasksToDelete.length}개 작업이 삭제되었습니다`,
          undo: async () => {
            for (const snap of snapshots) {
              const newId = await dbAddTask({ ...snap, id: undefined } as Omit<Task, 'id'>)
              const restored: Task = { ...snap, id: newId }
              set((state) => ({ tasks: [...state.tasks, restored] }))
            }
          },
          redo: async () => {
            get().batchDelete(ids)
          },
        })

        try {
          const tasksToSync = get().tasks.filter(t => ids.includes(t.id!))
          await dbBulkDeleteTasks(ids)
          for (const t of tasksToSync) {
            deleteTaskFromCloud(t.syncId).catch(console.error)
          }
          set((state) => ({
            tasks: state.tasks.filter((t) => !ids.includes(t.id!)),
            activeTaskId: ids.includes(state.activeTaskId ?? -1) ? null : state.activeTaskId,
          }))
        } catch (err) {
          set({ error: (err as Error).message })
        }
      },

      batchMoveCategory: async (ids, categoryId) => {
        try {
          await dbBulkUpdateTasks(ids, { categoryId })
          set((state) => ({
            tasks: state.tasks.map((t) =>
              ids.includes(t.id!) ? { ...t, categoryId, updatedAt: new Date().toISOString() } : t
            ),
          }))
          for (const id of ids) {
            const t = get().tasks.find(task => task.id === id)
            if (t) pushTask(t).catch(console.error)
          }
        } catch (err) {
          set({ error: (err as Error).message })
        }
      },

      batchSetPriority: async (ids, priority) => {
        try {
          await dbBulkUpdateTasks(ids, { priority })
          set((state) => ({
            tasks: state.tasks.map((t) =>
              ids.includes(t.id!) ? { ...t, priority, updatedAt: new Date().toISOString() } : t
            ),
          }))
          for (const id of ids) {
            const t = get().tasks.find(task => task.id === id)
            if (t) pushTask(t).catch(console.error)
          }
        } catch (err) {
          set({ error: (err as Error).message })
        }
      },

      refreshFromDb: async () => {
        const tasks = await getAllTasks()
        set({ tasks })
      },

      seedTutorialTasks: async () => {
        const tutorials = [
          { title: 'To-Do List에 오신 것을 환영합니다! 👋', categoryId: null, priority: 'medium' },
          { title: '이 작업을 오른쪽으로 스와이프하여 완료해보세요 👉', categoryId: null, priority: 'high' },
          { title: '작업을 탭하여 상세 내용을 확인하세요 📝', categoryId: null, priority: 'low' },
          { title: '새로운 작업을 추가하려면 아래 + 버튼을 누르세요 ➕', categoryId: null, priority: 'medium' },
        ]

        const now = new Date().toISOString()
        const today = now.split('T')[0]

        for (const t of tutorials) {
          await get().addTask({
            title: t.title,
            categoryId: t.categoryId,
            priority: t.priority as TaskPriority,
            status: 'pending',
            isFlagged: false,
            isStarred: false,
            dueDate: today,
            alarm: { enabled: false },
            repeat: { type: 'none', interval: 0 },
            subtasks: [],
            createdAt: now,
            updatedAt: now,
            sortOrder: 0,
          })
        }
      },
    }),
    { name: 'task-store' }
  )
)

// ─── Selectors ────────────────────────────────────
const selectSortedTasks = (state: TaskState) =>
  [...state.tasks].sort((a, b) => a.sortOrder - b.sortOrder)

const selectActiveTask = (state: TaskState) =>
  state.tasks.find((t) => t.id === state.activeTaskId) ?? null

export function useSortedTasks() {
  return useTaskStore(selectSortedTasks)
}

export function useActiveTask() {
  return useTaskStore(selectActiveTask)
}

export function useTasksByDate(date: string) {
  return useTaskStore((state) =>
    state.tasks.filter((t) => t.dueDate === date)
  )
}
