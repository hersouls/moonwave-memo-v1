import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { clsx } from 'clsx'

interface TaskGroupHeaderProps {
  label: string
  count: number
  color?: string
  defaultOpen?: boolean
  children: React.ReactNode
}

export function TaskGroupSection({
  label,
  count,
  color,
  defaultOpen = true,
  children,
}: TaskGroupHeaderProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 mb-2 text-sm font-medium select-none"
      >
        {isOpen ? (
          <ChevronDown className={clsx('w-4 h-4', color)} />
        ) : (
          <ChevronRight className={clsx('w-4 h-4', color)} />
        )}
        <span className={color}>{label}</span>
        <span
          className={clsx(
            'text-xs px-1.5 py-0.5 rounded-full',
            color?.includes('red')
              ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400',
          )}
        >
          {count}
        </span>
      </button>

      {isOpen && <div className="space-y-2">{children}</div>}
    </div>
  )
}
