import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { Attachment } from '@/lib/types'
import {
  getAttachmentsByTask,
  addAttachment as dbAddAttachment,
  deleteAttachment as dbDeleteAttachment,
} from '@/services/database'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const MAX_FILES_PER_TASK = 5

interface AttachmentState {
  attachments: Record<number, Attachment[]>
  isLoading: boolean
  error: string | null

  loadAttachments: (taskId: number) => Promise<void>
  addAttachment: (taskId: number, file: File) => Promise<boolean>
  deleteAttachment: (id: number, taskId: number) => Promise<void>
  getCount: (taskId: number) => number
}

async function createThumbnail(file: File): Promise<Blob | undefined> {
  if (!file.type.startsWith('image/')) return undefined

  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const maxSize = 200
      let w = img.width
      let h = img.height
      if (w > h) {
        if (w > maxSize) { h = (h * maxSize) / w; w = maxSize }
      } else {
        if (h > maxSize) { w = (w * maxSize) / h; h = maxSize }
      }
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, w, h)
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url)
        resolve(blob ?? undefined)
      }, 'image/jpeg', 0.7)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(undefined)
    }
    img.src = url
  })
}

export const useAttachmentStore = create<AttachmentState>()(
  devtools(
    (set, get) => ({
      attachments: {},
      isLoading: false,
      error: null,

      loadAttachments: async (taskId) => {
        set({ isLoading: true, error: null })
        try {
          const attachments = await getAttachmentsByTask(taskId)
          set((state) => ({
            attachments: { ...state.attachments, [taskId]: attachments },
            isLoading: false,
          }))
        } catch (err) {
          set({ error: (err as Error).message, isLoading: false })
        }
      },

      addAttachment: async (taskId, file) => {
        const current = get().attachments[taskId] || []
        if (current.length >= MAX_FILES_PER_TASK) {
          set({ error: `최대 ${MAX_FILES_PER_TASK}개까지 첨부할 수 있습니다.` })
          return false
        }
        if (file.size > MAX_FILE_SIZE) {
          set({ error: '파일 크기는 5MB를 초과할 수 없습니다.' })
          return false
        }

        try {
          const thumbnailData = await createThumbnail(file)
          const id = await dbAddAttachment({
            taskId,
            filename: file.name,
            mimeType: file.type,
            size: file.size,
            data: file,
            thumbnailData,
            createdAt: new Date().toISOString(),
          })

          const newAttachment: Attachment = {
            id,
            taskId,
            filename: file.name,
            mimeType: file.type,
            size: file.size,
            data: file,
            thumbnailData,
            createdAt: new Date().toISOString(),
          }

          set((state) => ({
            attachments: {
              ...state.attachments,
              [taskId]: [...(state.attachments[taskId] || []), newAttachment],
            },
            error: null,
          }))
          return true
        } catch (err) {
          set({ error: (err as Error).message })
          return false
        }
      },

      deleteAttachment: async (id, taskId) => {
        try {
          await dbDeleteAttachment(id)
          set((state) => ({
            attachments: {
              ...state.attachments,
              [taskId]: (state.attachments[taskId] || []).filter((a) => a.id !== id),
            },
          }))
        } catch (err) {
          set({ error: (err as Error).message })
        }
      },

      getCount: (taskId) => {
        return (get().attachments[taskId] || []).length
      },
    }),
    { name: 'attachment-store' }
  )
)
