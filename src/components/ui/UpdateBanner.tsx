import { usePwaUpdateStore } from '@/stores/pwaUpdateStore'
import { Download, X } from 'lucide-react'

export function UpdateBanner() {
  const { isUpdateAvailable, applyUpdate, dismiss } = usePwaUpdateStore()

  if (!isUpdateAvailable) return null

  return (
    <div className="fixed inset-x-0 top-0 z-50 animate-in slide-in-from-top duration-300">
      {/* 노치 영역까지 브랜드 색이 채워지도록 margin 대신 padding으로 안전 영역 확보 */}
      <div
        className="flex items-center justify-between gap-3 bg-primary-500 px-4 py-2.5 text-white shadow-sm"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.625rem)' }}
      >
        <div className="flex items-center gap-2">
          <Download className="h-4 w-4 shrink-0" />
          <span className="text-sm font-medium">새 버전이 있습니다</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={applyUpdate}
            className="rounded-md bg-white/20 px-3 py-1 text-xs font-semibold transition-colors hover:bg-white/30"
          >
            업데이트
          </button>

          <button
            onClick={dismiss}
            className="rounded-full p-0.5 transition-colors hover:bg-white/20"
            aria-label="닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
