import { create } from 'zustand'
import type { Task } from '@/lib/types'
import type { ConflictResult } from '@/lib/syncConflict'

export interface PendingConflict {
  id: string
  taskId: number
  taskTitle: string
  localTask: Task
  cloudData: Partial<Task>
  conflictResult: ConflictResult
}

interface SyncConflictState {
  pendingConflicts: PendingConflict[]
  isResolverOpen: boolean

  addConflict: (conflict: PendingConflict) => void
  removeConflict: (id: string) => void
  openResolver: () => void
  closeResolver: () => void
  clearAll: () => void
}

export const useSyncConflictStore = create<SyncConflictState>((set) => ({
  pendingConflicts: [],
  isResolverOpen: false,

  addConflict: (conflict) => {
    set((state) => ({
      pendingConflicts: [...state.pendingConflicts, conflict],
      isResolverOpen: true,
    }))
  },

  removeConflict: (id) => {
    set((state) => {
      const updated = state.pendingConflicts.filter((c) => c.id !== id)
      return {
        pendingConflicts: updated,
        isResolverOpen: updated.length > 0,
      }
    })
  },

  openResolver: () => set({ isResolverOpen: true }),
  closeResolver: () => set({ isResolverOpen: false }),
  clearAll: () => set({ pendingConflicts: [], isResolverOpen: false }),
}))
