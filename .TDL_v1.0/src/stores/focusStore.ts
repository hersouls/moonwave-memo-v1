import { create } from 'zustand'
import type { FocusPhase } from '@/lib/focusTypes'
import {
  DEFAULT_WORK_DURATION,
  DEFAULT_BREAK_DURATION,
  LONG_BREAK_DURATION,
} from '@/lib/focusTypes'

interface FocusState {
  isActive: boolean
  taskId: number | null
  taskTitle: string
  phase: FocusPhase
  timeRemaining: number
  isRunning: boolean
  sessionsCompleted: number
  workDuration: number
  breakDuration: number

  startFocus: (taskId: number, taskTitle: string) => void
  togglePause: () => void
  tick: () => void
  skipPhase: () => void
  stopFocus: () => void
}

export const useFocusStore = create<FocusState>((set, get) => ({
  isActive: false,
  taskId: null,
  taskTitle: '',
  phase: 'idle',
  timeRemaining: DEFAULT_WORK_DURATION,
  isRunning: false,
  sessionsCompleted: 0,
  workDuration: DEFAULT_WORK_DURATION,
  breakDuration: DEFAULT_BREAK_DURATION,

  startFocus: (taskId, taskTitle) => {
    set({
      isActive: true,
      taskId,
      taskTitle,
      phase: 'work',
      timeRemaining: DEFAULT_WORK_DURATION,
      isRunning: true,
      sessionsCompleted: 0,
    })
  },

  togglePause: () => {
    set((s) => ({ isRunning: !s.isRunning }))
  },

  tick: () => {
    const state = get()
    if (!state.isRunning || !state.isActive) return

    if (state.timeRemaining <= 1) {
      // Phase transition
      if (state.phase === 'work') {
        const newSessions = state.sessionsCompleted + 1
        const isLongBreak = newSessions % 4 === 0
        set({
          phase: 'break',
          timeRemaining: isLongBreak ? LONG_BREAK_DURATION : DEFAULT_BREAK_DURATION,
          sessionsCompleted: newSessions,
          isRunning: false, // Pause at transition
        })
      } else {
        // Break finished → next work session
        set({
          phase: 'work',
          timeRemaining: DEFAULT_WORK_DURATION,
          isRunning: false, // Pause at transition
        })
      }
    } else {
      set({ timeRemaining: state.timeRemaining - 1 })
    }
  },

  skipPhase: () => {
    const state = get()
    if (state.phase === 'work') {
      const newSessions = state.sessionsCompleted + 1
      const isLongBreak = newSessions % 4 === 0
      set({
        phase: 'break',
        timeRemaining: isLongBreak ? LONG_BREAK_DURATION : DEFAULT_BREAK_DURATION,
        sessionsCompleted: newSessions,
        isRunning: false,
      })
    } else {
      set({
        phase: 'work',
        timeRemaining: DEFAULT_WORK_DURATION,
        isRunning: false,
      })
    }
  },

  stopFocus: () => {
    set({
      isActive: false,
      taskId: null,
      taskTitle: '',
      phase: 'idle',
      timeRemaining: DEFAULT_WORK_DURATION,
      isRunning: false,
      sessionsCompleted: 0,
    })
  },
}))
