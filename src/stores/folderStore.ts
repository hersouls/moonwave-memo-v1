import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { Folder } from '@/lib/types'
import { generateSyncId } from '@/utils/id'
import { nowISO } from '@/lib/dateUtils'
import * as database from '@/services/database'
import { pushFolder, deleteFolderFromCloud } from '@/services/firestoreSync'

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
        try {
          const folders = await database.getAllFolders()
          set({ folders })
        } catch (err) {
          console.error('Failed to refresh folders:', err)
        }
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
            pushFolder(folder).catch(console.error)
          }
          return id
        } catch (err) {
          console.error('Failed to add folder:', err)
          return undefined
        }
      },

      updateFolder: async (id, updates) => {
        try {
          await database.updateFolder(id, updates)
          set((state) => ({
            folders: state.folders.map((f) =>
              f.id === id ? { ...f, ...updates, updatedAt: nowISO() } : f
            ),
          }))
          const updated = await database.getFolder(id)
          if (updated) pushFolder(updated).catch(console.error)
        } catch (err) {
          console.error('Failed to update folder:', err)
        }
      },

      deleteFolder: async (id) => {
        const folder = get().folders.find((f) => f.id === id)
        if (folder?.isSystem) return
        const syncId = folder?.syncId

        try {
          await database.deleteFolder(id)
          set((state) => ({
            folders: state.folders.filter((f) => f.id !== id),
          }))
          if (syncId) deleteFolderFromCloud(syncId).catch(console.error)
        } catch (err) {
          console.error('Failed to delete folder:', err)
        }
      },

      reorderFolders: async (orderedIds) => {
        try {
          const updates = orderedIds.map((id, index) =>
            database.updateFolder(id, { sortOrder: index })
          )
          await Promise.all(updates)
          const orderMap = new Map(orderedIds.map((id, idx) => [id, idx]))
          set((state) => ({
            folders: state.folders
              .map((f) => ({
                ...f,
                sortOrder: orderMap.get(f.id!) ?? f.sortOrder,
              }))
              .sort((a, b) => a.sortOrder - b.sortOrder),
          }))
          await Promise.all(orderedIds.map(async (id) => {
            const folder = await database.getFolder(id)
            if (folder) pushFolder(folder).catch(console.error)
          }))
        } catch (err) {
          console.error('Failed to reorder folders:', err)
        }
      },

      getDefaultFolder: () => get().folders.find((f) => f.isDefault),
      getTrashFolder: () => get().folders.find((f) => f.isSystem),
    }),
    { name: 'FolderStore' }
  )
)
