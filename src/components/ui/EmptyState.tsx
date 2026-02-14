import type { ReactNode } from 'react'
import { clsx } from 'clsx'

type EmptyStateSize = 'sm' | 'md' | 'lg'

interface EmptyStateProps {
  icon: ReactNode
  title: string
  description?: string
  action?: ReactNode
  size?: EmptyStateSize
  className?: string
}

const sizeConfig = {
  sm: { wrapper: 'py-8', iconBox: 'h-12 w-12', iconSize: 'h-6 w-6', title: 'text-sm', desc: 'text-xs' },
  md: { wrapper: 'py-16', iconBox: 'h-16 w-16', iconSize: 'h-8 w-8', title: 'text-base', desc: 'text-sm' },
  lg: { wrapper: 'py-24', iconBox: 'h-20 w-20', iconSize: 'h-10 w-10', title: 'text-lg', desc: 'text-sm' },
}

export function EmptyState({ icon, title, description, action, size = 'md', className }: EmptyStateProps) {
  const s = sizeConfig[size]
  return (
    <div className={clsx('flex flex-col items-center justify-center text-center', s.wrapper, className)}>
      <div className={clsx('flex items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800 mb-4', s.iconBox)}>
        {icon}
      </div>
      <p className={clsx('font-medium text-zinc-500 dark:text-zinc-400', s.title)}>{title}</p>
      {description && (
        <p className={clsx('mt-1.5 text-zinc-400 dark:text-zinc-500 max-w-xs', s.desc)}>{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
