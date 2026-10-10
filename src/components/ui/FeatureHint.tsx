import { useState } from 'react'
import { IcLineBulb, IcLineClose } from '@/mw/icons'

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
    <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-primary-50 text-primary-700 text-xs animate-in fade-in duration-300">
      <IcLineBulb size={16} className="mt-0.5 shrink-0" />
      <span className="flex-1">{message}</span>
      <button type="button"
        onClick={handleDismiss}
        className="mw-icon-button shrink-0"
        aria-label="힌트 닫기"
      >
        <IcLineClose size={12} />
      </button>
    </div>
  )
}
