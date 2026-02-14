import type { ReactNode } from 'react'
import { Plus } from 'lucide-react'

interface FABProps {
  onClick: () => void
  icon?: ReactNode
}

export function FAB({ onClick, icon }: FABProps) {
  return (
    <button
      type="button"
      aria-label="새 작업 추가"
      onClick={onClick}
      className="
        fixed z-30
        bottom-24 right-4 lg:bottom-8 lg:right-8
        w-14 h-14
        flex items-center justify-center
        bg-primary-500 hover:bg-primary-600
        text-white rounded-full
        shadow-lg hover:shadow-xl
        transition-all duration-200
        active:scale-95
        focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2
      "
    >
      {icon ?? <Plus className="w-6 h-6" />}
    </button>
  )
}
