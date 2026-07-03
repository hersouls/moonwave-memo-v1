import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import clsx from 'clsx'
import { Spinner } from './Spinner'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'text'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  /** 진행 중 상태 — 스피너 표시 + 클릭 비활성화 */
  loading?: boolean
  children: ReactNode
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--color-accent)] text-[var(--color-on-accent)] hover:bg-[var(--color-accent-hover)] active:bg-[var(--color-accent-pressed)] focus-visible:ring-primary-500/60',
  secondary:
    'bg-[var(--dialog-btn-secondary-bg)] text-[var(--color-text-primary)] hover:bg-[var(--dialog-btn-secondary-hover-bg)] active:bg-[var(--dialog-btn-secondary-pressed-bg)] focus-visible:ring-zinc-400/60',
  ghost:
    'bg-transparent text-zinc-600 hover:bg-[var(--color-surface-hover)] active:bg-[var(--color-surface-active)] dark:text-zinc-300 focus-visible:ring-zinc-400/60',
  text:
    'bg-transparent text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] active:bg-[var(--color-surface-active)] focus-visible:ring-zinc-400/60',
  danger:
    'bg-danger-500 text-white hover:bg-danger-600 active:bg-danger-700 focus-visible:ring-danger-500/60',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-4 text-xs rounded-lg gap-1',
  md: 'h-11 px-4 text-sm rounded-xl gap-1.5',
  lg: 'h-12 px-4 text-base rounded-xl gap-2',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = 'primary', size = 'md', fullWidth, loading, className, children, disabled, ...props },
    ref
  ) => {
    const isDisabled = disabled || loading
    return (
      <button
        ref={ref}
        className={clsx(
          'inline-flex items-center justify-center font-medium',
          'transition-[background-color,transform,box-shadow] duration-150 ease-standard active:scale-[0.98]',
          'focus-visible:outline-none focus-visible:ring-2',
          variantClasses[variant],
          sizeClasses[size],
          fullWidth && 'w-full',
          isDisabled && 'pointer-events-none opacity-50',
          className
        )}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && <Spinner size="sm" label="" />}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
