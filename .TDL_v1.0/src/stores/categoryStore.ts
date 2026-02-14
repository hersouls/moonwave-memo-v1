import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { Category } from '@/lib/types'
import {
  getAllCategories,
  addCategory as dbAddCategory,
  updateCategory as dbUpdateCategory,
  deleteCategory as dbDeleteCategory,
  generateSyncId,
} from '@/services/database'
import { pushCategory, deleteCategoryFromCloud } from '@/services/firestoreSync'

interface CategoryState {
  categories: Category[]
  isLoading: boolean

  // Actions
  initialize: () => Promise<void>
  addCategory: (name: string, color: string, parentId?: number | null) => Promise<void>
  updateCategory: (id: number, updates: Partial<Category>) => Promise<void>
  deleteCategory: (id: number) => Promise<void>
  refreshFromDb: () => Promise<void>
}

export const useCategoryStore = create<CategoryState>()(
  devtools(
    (set) => ({
      categories: [],
      isLoading: false,

      initialize: async () => {
        set({ isLoading: true })
        try {
          const categories = await getAllCategories()
          set({ categories, isLoading: false })
        } catch {
          set({ isLoading: false })
        }
      },

      addCategory: async (name, color, parentId) => {
        try {
          const now = new Date().toISOString()
          const syncId = generateSyncId()
          const categoryData: Omit<Category, 'id'> = {
            name,
            color,
            syncId,
            parentId: parentId ?? null,
            isDefault: false,
            sortOrder: 0,
            createdAt: now,
            updatedAt: now,
          }
          const id = await dbAddCategory(categoryData)
          const newCategory: Category = { ...categoryData, id }
          set((state) => ({ categories: [...state.categories, newCategory] }))
          pushCategory(newCategory).catch(console.error)
        } catch {
          // Error adding category
        }
      },

      updateCategory: async (id, updates) => {
        try {
          const now = new Date().toISOString()
          await dbUpdateCategory(id, { ...updates, updatedAt: now })
          set((state) => ({
            categories: state.categories.map((c) =>
              c.id === id ? { ...c, ...updates, updatedAt: now } : c
            ),
          }))
          const updated = useCategoryStore.getState().categories.find(c => c.id === id)
          if (updated) pushCategory(updated).catch(console.error)
        } catch {
          // Error updating category
        }
      },

      deleteCategory: async (id) => {
        const state = useCategoryStore.getState()
        const cat = state.categories.find(c => c.id === id)
        const children = state.categories.filter(c => c.parentId === id)

        try {
          // 1. Move children to root (parentId = null)
          if (children.length > 0) {
            const now = new Date().toISOString()
            for (const child of children) {
              await dbUpdateCategory(child.id!, { parentId: null, updatedAt: now })
              if (child.syncId) {
                pushCategory({ ...child, parentId: null, updatedAt: now }).catch(console.error)
              }
            }
          }

          // 2. Delete the category
          await dbDeleteCategory(id)
          if (cat?.syncId) deleteCategoryFromCloud(cat.syncId).catch(console.error)

          set((state) => ({
            categories: state.categories
              .filter((c) => c.id !== id)
              .map((c) => (c.parentId === id ? { ...c, parentId: null } : c)),
          }))
        } catch {
          // Error deleting category
        }
      },

      refreshFromDb: async () => {
        const categories = await getAllCategories()
        set({ categories })
      },
    }),
    { name: 'category-store' }
  )
)
