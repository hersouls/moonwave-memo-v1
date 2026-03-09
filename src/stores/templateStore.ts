import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { MemoColor } from '@/lib/types'

export interface CustomTemplate {
  id: string
  name: string
  icon: string
  color: MemoColor
  title: string
  body: string
  createdAt: string
  updatedAt: string
}

interface TemplateState {
  customTemplates: CustomTemplate[]
  addTemplate: (t: Omit<CustomTemplate, 'id' | 'createdAt' | 'updatedAt'>) => string
  updateTemplate: (id: string, t: Partial<Pick<CustomTemplate, 'name' | 'icon' | 'color' | 'title' | 'body'>>) => void
  deleteTemplate: (id: string) => void
}

export const useTemplateStore = create<TemplateState>()(
  persist(
    (set) => ({
      customTemplates: [],

      addTemplate: (t) => {
        const id = crypto.randomUUID()
        const now = new Date().toISOString()
        set((state) => ({
          customTemplates: [
            ...state.customTemplates,
            { ...t, id, createdAt: now, updatedAt: now },
          ],
        }))
        return id
      },

      updateTemplate: (id, updates) => {
        set((state) => ({
          customTemplates: state.customTemplates.map((t) =>
            t.id === id
              ? { ...t, ...updates, updatedAt: new Date().toISOString() }
              : t
          ),
        }))
      },

      deleteTemplate: (id) => {
        set((state) => ({
          customTemplates: state.customTemplates.filter((t) => t.id !== id),
        }))
      },
    }),
    { name: 'memo-custom-templates', version: 1 }
  )
)
