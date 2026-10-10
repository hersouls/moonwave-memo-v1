import { useEffect, useRef } from 'react'
import { useFocusTimerStore, FOCUS_TIMER_DEFAULT_SECONDS, acquireWakeLock } from '@/hooks/useFocusTimer'
import { IcFillPlay, IcLineClose, IcLinePause, IcLineUndo } from '@/mw/icons'

export function FloatingTimer() {
  const seconds = useFocusTimerStore((s) => s.seconds)
  const isRunning = useFocusTimerStore((s) => s.isRunning)
  const start = useFocusTimerStore((s) => s.start)
  const pause = useFocusTimerStore((s) => s.pause)
  const reset = useFocusTimerStore((s) => s.reset)
  const tick = useFocusTimerStore((s) => s.tick)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(tick, 1000)
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isRunning, tick])

  // Re-acquire wake lock when returning from background
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && isRunning) acquireWakeLock()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [isRunning])

  // Don't render if timer hasn't been started (still at default and not running)
  if (seconds === FOCUS_TIMER_DEFAULT_SECONDS && !isRunning) return null

  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  const progress = 1 - seconds / FOCUS_TIMER_DEFAULT_SECONDS

  return (
    <div className="fixed bottom-20 right-4 z-30 md:bottom-10 md:right-6 animate-in slide-in-from-bottom duration-200">
      <div className="flex items-center gap-2 rounded-2xl border border-[var(--border-secondary)] bg-[var(--surface-floating)] px-3 py-2 shadow-md">
        {/* Progress ring */}
        <svg className="h-8 w-8 -rotate-90" viewBox="0 0 32 32">
          <circle
            cx="16" cy="16" r="13"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="text-zinc-700 dark:text-zinc-300"
            opacity="0.2"
          />
          <circle
            cx="16" cy="16" r="13"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeDasharray={`${progress * 81.68} 81.68`}
            strokeLinecap="round"
            className="text-primary-400 "
          />
        </svg>

        <span className="font-mono text-sm tabular-nums text-[var(--text-primary)] min-w-[3.5ch]">
          {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
        </span>

        <button type="button"
          onClick={() => (isRunning ? pause() : start())}
          className="mw-button mw-button--tertiary-subtle mw-button--medium"
          aria-label={isRunning ? '일시정지' : '시작'}
        >
          {isRunning ? <IcLinePause size={16} /> : <IcFillPlay size={16} />}
        </button>

        <button type="button"
          onClick={reset}
          className="mw-button mw-button--tertiary-subtle mw-button--medium"
          aria-label="초기화"
        >
          {seconds === 0 ? <IcLineClose size={16} /> : <IcLineUndo size={16} />}
        </button>
      </div>
    </div>
  )
}
