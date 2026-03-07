import { useState } from 'react'
import { X, Lightbulb } from 'lucide-react'

interface FeatureHintProps {
  id: string
  message: string
}

const DISMISSED_KEY = 'memo-dismissed-hints'

function getDismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]')
  } catch {
    return []
  }
}

export function FeatureHint({ id, message }: FeatureHintProps) {
  const [dismissed, setDismissed] = useState(() => getDismissed().includes(id))

  if (dismissed) return null

  const handleDismiss = () => {
    const list = getDismissed()
    if (!list.includes(id)) {
      localStorage.setItem(DISMISSED_KEY, JSON.stringify([...list, id]))
    }
    setDismissed(true)
  }

  return (
    <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 text-xs animate-in fade-in duration-300">
      <Lightbulb className="w-3.5 h-3.5 mt-0.5 shrink-0" />
      <span className="flex-1">{message}</span>
      <button
        onClick={handleDismiss}
        className="shrink-0 p-0.5 rounded hover:bg-primary-100 dark:hover:bg-primary-800/30 transition-colors"
        aria-label="힌트 닫기"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  )
}
