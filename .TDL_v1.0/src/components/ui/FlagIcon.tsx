import { Flag } from 'lucide-react'

interface FlagIconProps {
  flagged: boolean
  onClick: () => void
}

export function FlagIcon({ flagged, onClick }: FlagIconProps) {
  return (
    <button
      type="button"
      aria-label={flagged ? '플래그 해제' : '플래그 설정'}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className="flex-shrink-0 p-1.5 rounded-lg transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
    >
      <Flag
        className="w-4 h-4 transition-colors"
        fill={flagged ? '#EF4444' : 'none'}
        color={flagged ? '#EF4444' : '#d4d4d8'}
        strokeWidth={2}
      />
    </button>
  )
}
