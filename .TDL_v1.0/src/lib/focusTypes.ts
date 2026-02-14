export type FocusPhase = 'work' | 'break' | 'idle'

export interface FocusSession {
  taskId: number
  taskTitle: string
  phase: FocusPhase
  timeRemaining: number // seconds
  workDuration: number // seconds (default 25 * 60)
  breakDuration: number // seconds (default 5 * 60)
  sessionsCompleted: number
  isRunning: boolean
}

export const DEFAULT_WORK_DURATION = 25 * 60 // 25 minutes
export const DEFAULT_BREAK_DURATION = 5 * 60 // 5 minutes
export const LONG_BREAK_DURATION = 15 * 60 // 15 minutes (every 4 sessions)
