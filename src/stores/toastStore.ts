import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: string
  message: string
  type: ToastType
  duration: number
  action?: { label: string; onClick: () => void }
}

interface ToastState {
  toasts: Toast[]
  showToast: (
    message: string,
    type?: ToastType,
    options?: { duration?: number; action?: Toast['action'] }
  ) => void
  removeToast: (id: string) => void
}

const timeoutMap = new Map<string, ReturnType<typeof setTimeout>>()

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  showToast: (message, type = 'info', options) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const duration = options?.duration ?? 3000

    const toast: Toast = { id, message, type, duration, action: options?.action }

    set((state) => {
      const toasts = [...state.toasts, toast]
      // Keep max 5 toasts
      if (toasts.length > 5) {
        const removed = toasts.shift()!
        const oldTimeout = timeoutMap.get(removed.id)
        if (oldTimeout) {
          clearTimeout(oldTimeout)
          timeoutMap.delete(removed.id)
        }
      }
      return { toasts }
    })

    const timeout = setTimeout(() => {
      get().removeToast(id)
    }, duration)
    timeoutMap.set(id, timeout)
  },

  removeToast: (id) => {
    const timeout = timeoutMap.get(id)
    if (timeout) {
      clearTimeout(timeout)
      timeoutMap.delete(id)
    }
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
  },
}))
