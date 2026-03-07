import { create } from 'zustand'

export const FOCUS_TIMER_DEFAULT_SECONDS = 25 * 60

interface FocusTimerState {
  seconds: number
  isRunning: boolean
  start: () => void
  pause: () => void
  reset: () => void
  tick: () => void
}

export const useFocusTimerStore = create<FocusTimerState>()((set, get) => ({
  seconds: FOCUS_TIMER_DEFAULT_SECONDS,
  isRunning: false,

  start: () => set({ isRunning: true }),
  pause: () => set({ isRunning: false }),
  reset: () => set({ seconds: FOCUS_TIMER_DEFAULT_SECONDS, isRunning: false }),

  tick: () => {
    const { seconds, isRunning } = get()
    if (!isRunning || seconds <= 0) {
      if (seconds <= 0 && isRunning) {
        set({ isRunning: false })
        navigator.vibrate?.(200)
      }
      return
    }
    set({ seconds: seconds - 1 })
  },
}))
