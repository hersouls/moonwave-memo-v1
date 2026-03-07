import { useState, useEffect, useRef } from 'react'
import { Play, Pause, RotateCcw } from 'lucide-react'

export function FocusTimer() {
  const [seconds, setSeconds] = useState(25 * 60) // 25 min default
  const [isRunning, setIsRunning] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (isRunning && seconds > 0) {
      intervalRef.current = setInterval(() => setSeconds((s) => s - 1), 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isRunning, seconds])

  useEffect(() => {
    if (seconds === 0 && isRunning) {
      setIsRunning(false)
      navigator.vibrate?.(200)
    }
  }, [seconds, isRunning])

  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60

  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-xs tabular-nums">
        {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
      </span>
      <button
        onClick={() => setIsRunning(!isRunning)}
        className="rounded p-0.5 transition-colors hover:bg-white/20"
        aria-label={isRunning ? '\uC77C\uC2DC\uC815\uC9C0' : '\uC2DC\uC791'}
      >
        {isRunning ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
      </button>
      <button
        onClick={() => {
          setIsRunning(false)
          setSeconds(25 * 60)
        }}
        className="rounded p-0.5 transition-colors hover:bg-white/20"
        aria-label="\uCD08\uAE30\uD654"
      >
        <RotateCcw className="h-3 w-3" />
      </button>
    </div>
  )
}
