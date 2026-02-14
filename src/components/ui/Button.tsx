import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import clsx from 'clsx'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  children: ReactNode
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-primary-500 text-white hover:bg-primary-600 active:bg-primary-700 focus-visible:ring-primary-500',
  secondary:
    'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 active:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 focus-visible:ring-zinc-400',
  ghost:
    'bg-transparent text-zinc-600 hover:bg-zinc-100 active:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800 focus-visible:ring-zinc-400',
  danger:
    'bg-danger-500 text-white hover:bg-danger-600 active:bg-danger-600 focus-visible:ring-danger-500',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-md gap-1',
  md: 'px-4 py-2 text-sm rounded-lg gap-1.5',
  lg: 'px-5 py-2.5 text-base rounded-lg gap-2',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={clsx(
          'inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          variantClasses[variant],
          sizeClasses[size],
          disabled && 'pointer-events-none opacity-50',
          className
        )}
        disabled={disabled}
        {...props}
      >
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
