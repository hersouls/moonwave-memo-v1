import type { ReactNode } from 'react'
import { clsx } from 'clsx'

type EmptyStateSize = 'sm' | 'md' | 'lg'

interface EmptyStateProps {
  icon: ReactNode
  title: string
  description?: string
  action?: ReactNode
  illustration?: ReactNode
  size?: EmptyStateSize
  className?: string
}

const sizeConfig = {
  sm: { wrapper: 'py-8', iconBox: 'h-12 w-12', iconSize: 'h-6 w-6', title: 'text-sm', desc: 'text-xs' },
  md: { wrapper: 'py-16', iconBox: 'h-16 w-16', iconSize: 'h-8 w-8', title: 'text-base', desc: 'text-sm' },
  lg: { wrapper: 'py-24', iconBox: 'h-20 w-20', iconSize: 'h-10 w-10', title: 'text-lg', desc: 'text-sm' },
}

export function EmptyState({ icon, title, description, action, illustration, size = 'md', className }: EmptyStateProps) {
  const s = sizeConfig[size]
  return (
    <div className={clsx('empty-state', s.wrapper, className)}>
      {illustration ? (
        <div className="mb-6 animate-empty-in">
          {illustration}
        </div>
      ) : (
        <div className={clsx('empty-state__icon animate-empty-in', s.iconBox)}>
          {icon}
        </div>
      )}
      <p className={clsx('empty-state__title animate-empty-in', s.title)} style={{ animationDelay: '50ms' }}>
        {title}
      </p>
      {description && (
        <p className={clsx('empty-state__desc animate-empty-in', s.desc)} style={{ animationDelay: '100ms' }}>
          {description}
        </p>
      )}
      {action && (
        <div className="empty-state__action animate-empty-in" style={{ animationDelay: '150ms' }}>
          {action}
        </div>
      )}
    </div>
  )
}
