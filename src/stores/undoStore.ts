import { create } from 'zustand'
import type { Memo } from '@/lib/types'
import { useMemoStore } from './memoStore'

interface UndoEntry {
  type: 'delete-memo' | 'delete-memos'
  memos: Memo[]
  timestamp: number
}

interface UndoState {
  current: UndoEntry | null
  isVisible: boolean
  timeoutId: ReturnType<typeof setTimeout> | null

  pushUndo: (entry: UndoEntry) => void
  undo: () => Promise<void>
  dismiss: () => void
}

/** 실행 취소 토스트 자동 소멸 시간(ms). UndoToast 진행바가 이 값에 동기화된다. */
export const UNDO_TIMEOUT = 5000

export const useUndoStore = create<UndoState>()((set, get) => ({
  current: null,
  isVisible: false,
  timeoutId: null,

  pushUndo: (entry) => {
    const prev = get().timeoutId
    if (prev) clearTimeout(prev)

    const timeoutId = setTimeout(() => {
      set({ current: null, isVisible: false, timeoutId: null })
    }, UNDO_TIMEOUT)

    set({ current: entry, isVisible: true, timeoutId })
  },

  undo: async () => {
    const { current, timeoutId } = get()
    if (!current) return
    if (timeoutId) clearTimeout(timeoutId)

    for (const memo of current.memos) {
      if (memo.id) {
        await useMemoStore.getState().restore(memo.id)
      }
    }

    set({ current: null, isVisible: false, timeoutId: null })
  },

  dismiss: () => {
    const { timeoutId } = get()
    if (timeoutId) clearTimeout(timeoutId)
    set({ current: null, isVisible: false, timeoutId: null })
  },
}))
