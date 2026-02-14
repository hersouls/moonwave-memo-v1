import type { ReactNode } from 'react'

interface StatsCardProps {
  label: string
  value: string | number | ReactNode
  subValue?: string
  icon?: ReactNode
  valueColor?: 'default' | 'primary' | 'success' | 'warning' | 'danger'
  progress?: {
    value: number
    label?: string
  }
  className?: string
}

const valueColorStyles = {
  default: 'text-zinc-900 dark:text-zinc-100',
  primary: 'text-primary-600 dark:text-primary-400',
  success: 'text-success-600 dark:text-success-400',
  warning: 'text-warning-600 dark:text-warning-400',
  danger: 'text-danger-600 dark:text-danger-400',
}

export function StatsCard({
  label,
  value,
  subValue,
  icon,
  valueColor = 'default',
  progress,
  className = '',
}: StatsCardProps) {
  return (
    <div
      className={`bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 ${className}`}
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-sm text-zinc-500 dark:text-zinc-400">{label}</span>
        {icon && <span className="text-zinc-500 dark:text-zinc-400">{icon}</span>}
      </div>

      <div className={`text-2xl font-bold tabular-nums ${valueColorStyles[valueColor]}`}>
        {value}
      </div>

      {subValue && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{subValue}</p>
      )}

      {progress && (
        <div className="mt-3">
          {progress.label && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">
              {progress.label}
            </p>
          )}
          <div className="h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-500 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, progress.value))}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
