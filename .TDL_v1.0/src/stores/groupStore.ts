import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { TaskGroup } from '@/lib/types'
import { getAllTaskGroups, addTaskGroup, updateTaskGroup, deleteTaskGroup } from '@/services/database'

interface GroupState {
  groups: TaskGroup[]
  isLoading: boolean

  initialize: () => Promise<void>
  addGroup: (name: string, color: string, description?: string, icon?: string) => Promise<TaskGroup>
  updateGroup: (id: number, updates: Partial<TaskGroup>) => Promise<void>
  deleteGroup: (id: number) => Promise<void>
  addTaskToGroup: (groupId: number, taskId: number) => Promise<void>
  removeTaskFromGroup: (groupId: number, taskId: number) => Promise<void>
  setTaskIds: (groupId: number, taskIds: number[]) => Promise<void>
  refreshFromDb: () => Promise<void>
}

export const useGroupStore = create<GroupState>()(
  devtools(
    (set, get) => ({
      groups: [],
      isLoading: false,

      initialize: async () => {
        set({ isLoading: true })
        try {
          const groups = await getAllTaskGroups()
          set({ groups })
        } finally {
          set({ isLoading: false })
        }
      },

      addGroup: async (name, color, description, icon) => {
        const now = new Date().toISOString()
        const maxOrder = get().groups.reduce((max, g) => Math.max(max, g.sortOrder), -1)

        const newGroup: Omit<TaskGroup, 'id'> = {
          name,
          color,
          description: description || undefined,
          icon: icon || undefined,
          taskIds: [],
          sortOrder: maxOrder + 1,
          createdAt: now,
          updatedAt: now,
        }

        const id = await addTaskGroup(newGroup)
        const created = { ...newGroup, id } as TaskGroup
        set((state) => ({ groups: [...state.groups, created] }))
        return created
      },

      updateGroup: async (id, updates) => {
        await updateTaskGroup(id, updates)
        set((state) => ({
          groups: state.groups.map((g) =>
            g.id === id ? { ...g, ...updates, updatedAt: new Date().toISOString() } : g
          ),
        }))
      },

      deleteGroup: async (id) => {
        await deleteTaskGroup(id)
        set((state) => ({
          groups: state.groups.filter((g) => g.id !== id),
        }))
      },

      addTaskToGroup: async (groupId, taskId) => {
        const group = get().groups.find((g) => g.id === groupId)
        if (!group || group.taskIds.includes(taskId)) return

        const newTaskIds = [...group.taskIds, taskId]
        await updateTaskGroup(groupId, { taskIds: newTaskIds })
        set((state) => ({
          groups: state.groups.map((g) =>
            g.id === groupId ? { ...g, taskIds: newTaskIds, updatedAt: new Date().toISOString() } : g
          ),
        }))
      },

      removeTaskFromGroup: async (groupId, taskId) => {
        const group = get().groups.find((g) => g.id === groupId)
        if (!group) return

        const newTaskIds = group.taskIds.filter((id) => id !== taskId)
        await updateTaskGroup(groupId, { taskIds: newTaskIds })
        set((state) => ({
          groups: state.groups.map((g) =>
            g.id === groupId ? { ...g, taskIds: newTaskIds, updatedAt: new Date().toISOString() } : g
          ),
        }))
      },

      setTaskIds: async (groupId, taskIds) => {
        await updateTaskGroup(groupId, { taskIds })
        set((state) => ({
          groups: state.groups.map((g) =>
            g.id === groupId ? { ...g, taskIds, updatedAt: new Date().toISOString() } : g
          ),
        }))
      },

      refreshFromDb: async () => {
        const groups = await getAllTaskGroups()
        set({ groups })
      },
    }),
    { name: 'group-store' }
  )
)
