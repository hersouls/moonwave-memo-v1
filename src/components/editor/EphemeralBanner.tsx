import { useState, useEffect } from 'react'
import { Flame } from 'lucide-react'
import clsx from 'clsx'

interface EphemeralBannerProps {
  expiresAt: string
  onSave: () => void
}

export function EphemeralBanner({ expiresAt, onSave }: EphemeralBannerProps) {
  const [remaining, setRemaining] = useState(() => calcRemaining(expiresAt))

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(calcRemaining(expiresAt))
    }, 1000)
    return () => clearInterval(interval)
  }, [expiresAt])

  const isUrgent = remaining <= 5 * 60 // less than 5 minutes
  const isExpired = remaining <= 0

  const minutes = Math.max(0, Math.floor(remaining / 60))
  const seconds = Math.max(0, remaining % 60)
  const display = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  return (
    <div
      className={clsx(
        'flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors',
        isExpired
          ? 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-400'
          : isUrgent
            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
            : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
      )}
    >
      <Flame
        className={clsx(
          'h-4 w-4 shrink-0',
          isUrgent && !isExpired && 'animate-pulse'
        )}
      />
      <span className="flex-1">
        {isExpired ? '만료됨' : `남은 시간 ${display}`}
      </span>
      <button
        onClick={onSave}
        className="shrink-0 px-3 py-1 text-xs font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600 transition-colors"
      >
        영구 저장
      </button>
    </div>
  )
}

function calcRemaining(expiresAt: string): number {
  const diff = new Date(expiresAt).getTime() - Date.now()
  return Math.floor(diff / 1000)
}
