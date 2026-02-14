import { clsx } from 'clsx'
import type { ReactNode, ButtonHTMLAttributes } from 'react'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  color?: 'primary' | 'secondary' | 'danger'
  plain?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const iconButtonColors = {
  primary: {
    solid: 'bg-primary-500 hover:bg-primary-600 text-white',
    plain: 'text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-900/30',
  },
  secondary: {
    solid: 'bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-200',
    plain: 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800',
  },
  danger: {
    solid: 'bg-danger-500 hover:bg-danger-600 text-white',
    plain: 'text-danger-600 hover:bg-danger-50 dark:text-danger-400 dark:hover:bg-danger-900/30',
  },
}

const iconButtonSizes = {
  sm: 'p-2 min-w-[40px] min-h-[40px]',
  md: 'p-2.5 min-w-[44px] min-h-[44px]',
  lg: 'p-3 min-w-[48px] min-h-[48px]',
}

export function IconButton({
  children,
  color = 'secondary',
  plain = false,
  size = 'md',
  className,
  disabled,
  ...props
}: IconButtonProps) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center rounded-lg transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        iconButtonColors[color][plain ? 'plain' : 'solid'],
        iconButtonSizes[size],
        className
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}
