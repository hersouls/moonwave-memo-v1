import { useNavigate } from 'react-router-dom'
import type { Memo } from '@/lib/types'
import { IcLineBulb, IcLineClose } from '@/mw/icons'

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
      <div className="relative rounded-xl border border-primary-200 bg-white/95 backdrop-blur px-4 py-3 shadow-lg dark:bg-zinc-900/95">
        <button type="button"
          onClick={onDismiss}
          className="mw-icon-button absolute top-2 right-2"
          aria-label="닫기"
        >
          <IcLineClose size={16} />
        </button>

        <div className="flex items-start gap-3 pr-6">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-50 ">
            <IcLineBulb size={16} className="text-primary-500 " />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              지금 이 메모가 필요하지 않으세요?
            </p>
            <button type="button"
              onClick={handleClick}
              className="mw-button mw-button--tertiary-subtle mw-button--medium mt-1 truncate"
            >
              "{memo.title || '제목 없음'}"
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
