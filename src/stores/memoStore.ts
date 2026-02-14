import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { Memo, MemoColor } from '@/lib/types'
import { nowISO } from '@/lib/dateUtils'
import { generateSyncId } from '@/utils/id'
import { extractTags } from '@/lib/tagParser'
import * as database from '@/services/database'

interface MemoState {
  memos: Memo[]
  isLoading: boolean
  error: string | null

  initialize: () => Promise<void>
  refreshFromDb: () => Promise<void>

  addMemo: (data: { title: string; body: string; folderId: number | null; color?: MemoColor }) => Promise<number | undefined>
  updateMemo: (id: number, updates: Partial<Memo>) => Promise<void>
  softDelete: (id: number) => Promise<Memo | undefined>
  restore: (id: number) => Promise<void>
  permanentDelete: (id: number) => Promise<void>
  emptyTrash: () => Promise<void>
  toggleStar: (id: number) => Promise<void>
  togglePin: (id: number) => Promise<void>
  moveToFolder: (id: number, folderId: number) => Promise<void>

  batchDelete: (ids: number[]) => Promise<Memo[]>
  batchMove: (ids: number[], folderId: number) => Promise<void>
  batchStar: (ids: number[], starred: boolean) => Promise<void>
}

export const useMemoStore = create<MemoState>()(
  devtools(
    (set, get) => ({
      memos: [],
      isLoading: false,
      error: null,

      initialize: async () => {
        set({ isLoading: true })
        try {
          const memos = await database.getAllMemos()
          set({ memos, isLoading: false })
        } catch (err) {
          console.error('Failed to initialize memos:', err)
          set({ error: '메모를 불러오는데 실패했습니다.', isLoading: false })
        }
      },

      refreshFromDb: async () => {
        const memos = await database.getAllMemos()
        set({ memos })
      },

      addMemo: async (data) => {
        try {
          const now = nowISO()
          const tags = extractTags(data.body)
          const memo: Omit<Memo, 'id'> = {
            title: data.title,
            body: data.body,
            folderId: data.folderId,
            tags,
            isStarred: false,
            color: data.color || 'white',
            isPinned: false,
            syncId: generateSyncId(),
            createdAt: now,
            updatedAt: now,
          }
          const id = await database.addMemo(memo)
          const newMemo = await database.getMemo(id)
          if (newMemo) {
            set((state) => ({ memos: [...state.memos, newMemo] }))
          }
          return id
        } catch (err) {
          console.error('Failed to add memo:', err)
          set({ error: '메모 생성에 실패했습니다.' })
          return undefined
        }
      },

      updateMemo: async (id, updates) => {
        try {
          if (updates.body !== undefined) {
            updates.tags = extractTags(updates.body)
          }
          await database.updateMemo(id, updates)
          set((state) => ({
            memos: state.memos.map((m) =>
              m.id === id ? { ...m, ...updates, updatedAt: nowISO() } : m
            ),
          }))
        } catch (err) {
          console.error('Failed to update memo:', err)
        }
      },

      softDelete: async (id) => {
        try {
          const memo = get().memos.find((m) => m.id === id)
          await database.softDeleteMemo(id)
          const now = nowISO()
          set((state) => ({
            memos: state.memos.map((m) =>
              m.id === id ? { ...m, deletedAt: now, updatedAt: now } : m
            ),
          }))
          return memo
        } catch (err) {
          console.error('Failed to delete memo:', err)
          return undefined
        }
      },

      restore: async (id) => {
        try {
          await database.restoreMemo(id)
          set((state) => ({
            memos: state.memos.map((m) =>
              m.id === id ? { ...m, deletedAt: undefined, updatedAt: nowISO() } : m
            ),
          }))
        } catch (err) {
          console.error('Failed to restore memo:', err)
        }
      },

      permanentDelete: async (id) => {
        try {
          await database.permanentDeleteMemo(id)
          set((state) => ({
            memos: state.memos.filter((m) => m.id !== id),
          }))
        } catch (err) {
          console.error('Failed to permanently delete memo:', err)
        }
      },

      emptyTrash: async () => {
        try {
          await database.emptyTrash()
          set((state) => ({
            memos: state.memos.filter((m) => !m.deletedAt),
          }))
        } catch (err) {
          console.error('Failed to empty trash:', err)
        }
      },

      toggleStar: async (id) => {
        const memo = get().memos.find((m) => m.id === id)
        if (!memo) return
        await database.updateMemo(id, { isStarred: !memo.isStarred })
        set((state) => ({
          memos: state.memos.map((m) =>
            m.id === id ? { ...m, isStarred: !m.isStarred, updatedAt: nowISO() } : m
          ),
        }))
      },

      togglePin: async (id) => {
        const memo = get().memos.find((m) => m.id === id)
        if (!memo) return
        await database.updateMemo(id, { isPinned: !memo.isPinned })
        set((state) => ({
          memos: state.memos.map((m) =>
            m.id === id ? { ...m, isPinned: !m.isPinned, updatedAt: nowISO() } : m
          ),
        }))
      },

      moveToFolder: async (id, folderId) => {
        await database.updateMemo(id, { folderId })
        set((state) => ({
          memos: state.memos.map((m) =>
            m.id === id ? { ...m, folderId, updatedAt: nowISO() } : m
          ),
        }))
      },

      batchDelete: async (ids) => {
        const memosToDelete = get().memos.filter((m) => ids.includes(m.id!))
        await database.bulkSoftDeleteMemos(ids)
        const now = nowISO()
        set((state) => ({
          memos: state.memos.map((m) =>
            ids.includes(m.id!) ? { ...m, deletedAt: now, updatedAt: now } : m
          ),
        }))
        return memosToDelete
      },

      batchMove: async (ids, folderId) => {
        await database.bulkMoveMemos(ids, folderId)
        set((state) => ({
          memos: state.memos.map((m) =>
            ids.includes(m.id!) ? { ...m, folderId, updatedAt: nowISO() } : m
          ),
        }))
      },

      batchStar: async (ids, starred) => {
        await database.bulkUpdateMemos(ids, { isStarred: starred })
        set((state) => ({
          memos: state.memos.map((m) =>
            ids.includes(m.id!) ? { ...m, isStarred: starred, updatedAt: nowISO() } : m
          ),
        }))
      },
    }),
    { name: 'MemoStore' }
  )
)
