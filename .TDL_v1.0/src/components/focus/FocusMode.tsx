import { Play, Pause, SkipForward, X } from 'lucide-react'
import { FocusTimer } from './FocusTimer'
import { useFocusStore } from '@/stores/focusStore'
import { useFocusTimer } from '@/hooks/useFocusTimer'
import { DEFAULT_WORK_DURATION, DEFAULT_BREAK_DURATION, LONG_BREAK_DURATION } from '@/lib/focusTypes'

export function FocusMode() {
  const isActive = useFocusStore((s) => s.isActive)
  const taskTitle = useFocusStore((s) => s.taskTitle)
  const phase = useFocusStore((s) => s.phase)
  const timeRemaining = useFocusStore((s) => s.timeRemaining)
  const isRunning = useFocusStore((s) => s.isRunning)
  const sessionsCompleted = useFocusStore((s) => s.sessionsCompleted)
  const togglePause = useFocusStore((s) => s.togglePause)
  const skipPhase = useFocusStore((s) => s.skipPhase)
  const stopFocus = useFocusStore((s) => s.stopFocus)

  // Drive the timer
  useFocusTimer()

  if (!isActive) return null

  const totalTime =
    phase === 'work'
      ? DEFAULT_WORK_DURATION
      : sessionsCompleted % 4 === 0
        ? LONG_BREAK_DURATION
        : DEFAULT_BREAK_DURATION

  return (
    <div className="fixed inset-0 z-[100] bg-white dark:bg-zinc-950 flex flex-col items-center justify-center p-6">
      {/* Close button */}
      <button
        type="button"
        onClick={stopFocus}
        className="absolute top-4 right-4 p-2 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Task title */}
      <h2 className="text-lg font-medium text-zinc-600 dark:text-zinc-400 mb-8 text-center max-w-sm truncate">
        {taskTitle}
      </h2>

      {/* Timer */}
      <FocusTimer
        timeRemaining={timeRemaining}
        totalTime={totalTime}
        phase={phase === 'idle' ? 'work' : phase}
      />

      {/* Session count */}
      <div className="mt-6 flex items-center gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className={`w-3 h-3 rounded-full transition-colors ${
              i < sessionsCompleted % 4
                ? 'bg-primary-500'
                : 'bg-zinc-200 dark:bg-zinc-700'
            }`}
          />
        ))}
        <span className="ml-2 text-sm text-zinc-400">
          {sessionsCompleted}회 완료
        </span>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4 mt-8">
        <button
          type="button"
          onClick={togglePause}
          className="w-16 h-16 rounded-full bg-primary-500 hover:bg-primary-600 text-white flex items-center justify-center transition-colors shadow-lg"
        >
          {isRunning ? (
            <Pause className="w-7 h-7" />
          ) : (
            <Play className="w-7 h-7 ml-0.5" />
          )}
        </button>

        <button
          type="button"
          onClick={skipPhase}
          className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center transition-colors"
          title="다음 단계로"
        >
          <SkipForward className="w-5 h-5" />
        </button>
      </div>

      {/* Phase indicator text */}
      <p className="mt-6 text-sm text-zinc-400">
        {phase === 'work'
          ? '집중하세요. 타이머가 끝나면 휴식 시간이 됩니다.'
          : '잠시 쉬세요. 다음 집중 세션을 준비합니다.'}
      </p>
    </div>
  )
}
