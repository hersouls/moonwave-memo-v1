import { useRef } from 'react'
import { Calendar } from 'lucide-react'
import { formatDueDate } from '@/lib/dateUtils'

interface DatePickerProps {
  value?: string
  onChange: (date: string) => void
  placeholder?: string
  className?: string
}

export function DatePicker({ value, onChange, placeholder = '날짜 선택', className = '' }: DatePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleClick = () => {
    inputRef.current?.showPicker?.()
    inputRef.current?.focus()
  }

  return (
    <div
      className={`relative inline-flex items-center gap-2 cursor-pointer ${className}`}
      onClick={handleClick}
    >
      <Calendar className="w-4 h-4 text-zinc-400 dark:text-zinc-500 flex-shrink-0" />
      <span className="text-sm text-zinc-700 dark:text-zinc-300">
        {value ? formatDueDate(value) : placeholder}
      </span>
      <input
        ref={inputRef}
        type="date"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        tabIndex={-1}
      />
    </div>
  )
}
