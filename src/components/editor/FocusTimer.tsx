import { useEffect, useRef } from 'react'
import { Play, Pause, RotateCcw } from 'lucide-react'
import { useFocusTimerStore } from '@/hooks/useFocusTimer'

export function FocusTimer() {
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

  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60

  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-xs tabular-nums">
        {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
      </span>
      <button
        onClick={() => (isRunning ? pause() : start())}
        className="rounded p-0.5 transition-colors hover:bg-white/20"
        aria-label={isRunning ? '일시정지' : '시작'}
      >
        {isRunning ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
      </button>
      <button
        onClick={reset}
        className="rounded p-0.5 transition-colors hover:bg-white/20"
        aria-label="초기화"
      >
        <RotateCcw className="h-3 w-3" />
      </button>
    </div>
  )
}
