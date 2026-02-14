import { clsx } from 'clsx'

interface FocusTimerProps {
  timeRemaining: number // seconds
  totalTime: number // seconds
  phase: 'work' | 'break' | 'idle'
}

export function FocusTimer({ timeRemaining, totalTime, phase }: FocusTimerProps) {
  const minutes = Math.floor(timeRemaining / 60)
  const seconds = timeRemaining % 60
  const progress = totalTime > 0 ? (totalTime - timeRemaining) / totalTime : 0

  const size = 220
  const strokeWidth = 8
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - progress)

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-zinc-200 dark:text-zinc-700"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={clsx(
            'transition-[stroke-dashoffset] duration-1000 ease-linear',
            phase === 'work'
              ? 'stroke-primary-500'
              : 'stroke-emerald-500',
          )}
        />
      </svg>

      {/* Time display */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-5xl font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </span>
        <span
          className={clsx(
            'text-sm font-medium mt-1',
            phase === 'work'
              ? 'text-primary-500'
              : 'text-emerald-500',
          )}
        >
          {phase === 'work' ? '집중 시간' : '휴식 시간'}
        </span>
      </div>
    </div>
  )
}
