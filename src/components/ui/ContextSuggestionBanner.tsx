import { useNavigate } from 'react-router-dom'
import { X, Lightbulb } from 'lucide-react'
import type { Memo } from '@/lib/types'

interface ContextSuggestionBannerProps {
  memo: Memo
  onDismiss: () => void
}

export function ContextSuggestionBanner({ memo, onDismiss }: ContextSuggestionBannerProps) {
  const navigate = useNavigate()

  const handleClick = () => {
    if (memo.id) {
      navigate(`/memo/${memo.id}`)
    }
  }

  return (
    <div className="fixed bottom-20 left-4 right-4 z-30 mx-auto max-w-lg lg:left-auto lg:right-6 lg:bottom-6 lg:max-w-sm">
      <div className="relative rounded-xl border border-primary-200 bg-white/95 backdrop-blur px-4 py-3 shadow-lg dark:border-primary-800/50 dark:bg-zinc-900/95">
        <button
          onClick={onDismiss}
          className="absolute top-2 right-2 p-1 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          aria-label="닫기"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-3 pr-6">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-50 dark:bg-primary-900/30">
            <Lightbulb className="h-4 w-4 text-primary-500 dark:text-primary-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              지금 이 메모가 필요하지 않으세요?
            </p>
            <button
              onClick={handleClick}
              className="mt-1 text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline truncate block max-w-full text-left"
            >
              "{memo.title || '제목 없음'}"
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
