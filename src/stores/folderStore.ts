import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { Folder } from '@/lib/types'
import { generateSyncId } from '@/utils/id'
import { nowISO } from '@/lib/dateUtils'
import * as database from '@/services/database'

interface FolderState {
  folders: Folder[]
  isLoading: boolean

  initialize: () => Promise<void>
  refreshFromDb: () => Promise<void>
  addFolder: (name: string, color: string) => Promise<number | undefined>
  updateFolder: (id: number, updates: Partial<Folder>) => Promise<void>
  deleteFolder: (id: number) => Promise<void>
  reorderFolders: (orderedIds: number[]) => Promise<void>
  getDefaultFolder: () => Folder | undefined
  getTrashFolder: () => Folder | undefined
}

export const useFolderStore = create<FolderState>()(
  devtools(
    (set, get) => ({
      folders: [],
      isLoading: false,

      initialize: async () => {
        set({ isLoading: true })
        try {
          const folders = await database.getAllFolders()
          set({ folders, isLoading: false })
        } catch (err) {
          console.error('Failed to initialize folders:', err)
          set({ isLoading: false })
        }
      },

      refreshFromDb: async () => {
        const folders = await database.getAllFolders()
        set({ folders })
      },

      addFolder: async (name, color) => {
        try {
          const id = await database.addFolder({
            name,
            color,
            sortOrder: get().folders.length,
            isDefault: false,
            isSystem: false,
            syncId: generateSyncId(),
            createdAt: nowISO(),
          })
          const folder = await database.getFolder(id)
          if (folder) {
            set((state) => ({ folders: [...state.folders, folder] }))
          }
          return id
        } catch (err) {
          console.error('Failed to add folder:', err)
          return undefined
        }
      },

      updateFolder: async (id, updates) => {
        await database.updateFolder(id, updates)
        set((state) => ({
          folders: state.folders.map((f) =>
            f.id === id ? { ...f, ...updates, updatedAt: nowISO() } : f
          ),
        }))
      },

      deleteFolder: async (id) => {
        const folder = get().folders.find((f) => f.id === id)
        if (folder?.isDefault || folder?.isSystem) return

        await database.deleteFolder(id)
        set((state) => ({
          folders: state.folders.filter((f) => f.id !== id),
        }))
      },

      reorderFolders: async (orderedIds) => {
        const updates = orderedIds.map((id, index) =>
          database.updateFolder(id, { sortOrder: index })
        )
        await Promise.all(updates)
        set((state) => ({
          folders: state.folders
            .map((f) => ({
              ...f,
              sortOrder: orderedIds.indexOf(f.id!) >= 0 ? orderedIds.indexOf(f.id!) : f.sortOrder,
            }))
            .sort((a, b) => a.sortOrder - b.sortOrder),
        }))
      },

      getDefaultFolder: () => get().folders.find((f) => f.isDefault),
      getTrashFolder: () => get().folders.find((f) => f.isSystem),
    }),
    { name: 'FolderStore' }
  )
)
