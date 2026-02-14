import type { ReactNode, MouseEvent } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  onClick?: (e: MouseEvent) => void
  variant?: 'default' | 'interactive'
}

export function Card({ children, className = '', onClick, variant = 'default' }: CardProps) {
  const baseStyles =
    'bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4'

  const variantStyles = {
    default: '',
    interactive:
      'cursor-pointer hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-md transition-all duration-200',
  }

  return (
    <div
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </div>
  )
}
