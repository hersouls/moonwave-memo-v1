import { clsx } from 'clsx'
import { Check } from 'lucide-react'

interface CheckboxProps {
  checked: boolean
  onChange: () => void
  size?: 'sm' | 'md'
}

const sizeStyles = {
  sm: {
    outer: 'w-5 h-5',
    icon: 'w-3 h-3',
  },
  md: {
    outer: 'w-6 h-6',
    icon: 'w-4 h-4',
  },
}

export function Checkbox({ checked, onChange, size = 'md' }: CheckboxProps) {
  const styles = sizeStyles[size]

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={(e) => {
        e.stopPropagation()
        onChange()
      }}
      className={clsx(
        'flex-shrink-0 inline-flex items-center justify-center rounded-full border-2 transition-all duration-200',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2',
        styles.outer,
        checked
          ? 'bg-primary-500 border-primary-500'
          : 'border-zinc-300 dark:border-zinc-600 hover:border-primary-400 dark:hover:border-primary-500'
      )}
    >
      {checked && <Check className={clsx(styles.icon, 'text-white')} strokeWidth={3} />}
    </button>
  )
}
