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

// 자동 dismiss 타이머는 각 토스트 아이템 컴포넌트가 소유한다
// (퇴장 애니메이션 후 removeToast 호출 — 스토어는 상태만 관리)
export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  showToast: (message, type = 'info', options) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const duration = options?.duration ?? 3000

    const toast: Toast = { id, message, type, duration, action: options?.action }

    set((state) => {
      const toasts = [...state.toasts, toast]
      // Keep max 5 toasts
      if (toasts.length > 5) {
        toasts.shift()
      }
      return { toasts }
    })
  },

  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
  },
}))
