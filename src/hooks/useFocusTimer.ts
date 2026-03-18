import { create } from 'zustand'

export const FOCUS_TIMER_DEFAULT_SECONDS = 25 * 60

// ─── Wake Lock ────────────────────────────────────
let wakeLockSentinel: WakeLockSentinel | null = null

export async function acquireWakeLock() {
  if (!('wakeLock' in navigator)) return
  try {
    wakeLockSentinel = await navigator.wakeLock.request('screen')
    wakeLockSentinel.addEventListener('release', () => { wakeLockSentinel = null })
  } catch { /* not supported or denied */ }
}

function releaseWakeLock() {
  wakeLockSentinel?.release()
  wakeLockSentinel = null
}

// ─── Store ────────────────────────────────────────
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

  start: () => {
    set({ isRunning: true })
    acquireWakeLock()
  },
  pause: () => {
    set({ isRunning: false })
    releaseWakeLock()
  },
  reset: () => {
    set({ seconds: FOCUS_TIMER_DEFAULT_SECONDS, isRunning: false })
    releaseWakeLock()
  },

  tick: () => {
    const { seconds, isRunning } = get()
    if (!isRunning || seconds <= 0) {
      if (seconds <= 0 && isRunning) {
        set({ isRunning: false })
        releaseWakeLock()
        navigator.vibrate?.(200)
      }
      return
    }
    set({ seconds: seconds - 1 })
  },
}))
