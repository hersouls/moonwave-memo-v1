import { useState, useEffect } from 'react'
import { Share, Plus, X } from 'lucide-react'
import { isIOSSafari, isPWAStandalone } from '@/utils/platform'

const DISMISSED_KEY = 'memo-ios-install-dismissed'
const DISMISS_EXPIRY_DAYS = 14

function isDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY)
    if (!raw) return false
    const expiry = JSON.parse(raw) as number
    if (Date.now() > expiry) {
      localStorage.removeItem(DISMISSED_KEY)
      return false
    }
    return true
  } catch {
    return false
  }
}

function dismiss() {
  const expiry = Date.now() + DISMISS_EXPIRY_DAYS * 24 * 60 * 60 * 1000
  localStorage.setItem(DISMISSED_KEY, JSON.stringify(expiry))
}

export function IOSInstallBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (isIOSSafari() && !isPWAStandalone() && !isDismissed()) {
      setVisible(true)
    }
  }, [])

  if (!visible) return null

  const handleDismiss = () => {
    dismiss()
    setVisible(false)
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] pb-[env(safe-area-inset-bottom,0px)] animate-in slide-in-from-bottom duration-300">
      <div className="mx-3 mb-3 rounded-2xl bg-white dark:bg-zinc-800 shadow-2xl shadow-black/20 border border-zinc-200 dark:border-zinc-700 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <div className="flex items-center gap-2.5">
            <img
              src="/icons/apple-touch-icon-180.png"
              alt="Memo"
              className="w-10 h-10 rounded-xl"
            />
            <div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Memo 앱 설치
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                홈 화면에서 바로 실행하세요
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1.5 rounded-full text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
            aria-label="닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Steps */}
        <div className="px-4 py-3 space-y-2.5">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary-50 dark:bg-primary-900/30 shrink-0">
              <span className="text-xs font-bold text-primary-600 dark:text-primary-400">1</span>
            </div>
            <p className="text-sm text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
              하단의 공유
              <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-primary-500 text-white">
                <Share className="w-3.5 h-3.5" />
              </span>
              버튼을 탭하세요
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary-50 dark:bg-primary-900/30 shrink-0">
              <span className="text-xs font-bold text-primary-600 dark:text-primary-400">2</span>
            </div>
            <p className="text-sm text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-zinc-200 dark:bg-zinc-600 text-zinc-700 dark:text-zinc-200">
                <Plus className="w-3.5 h-3.5" />
              </span>
              홈 화면에 추가를 선택하세요
            </p>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="px-4 pb-3 flex justify-end">
          <button
            onClick={handleDismiss}
            className="text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
          >
            다시 보지 않기
          </button>
        </div>

        {/* Arrow pointing down (to Safari toolbar) */}
        <div className="flex justify-center -mb-1.5">
          <div className="w-4 h-4 rotate-45 bg-white dark:bg-zinc-800 border-r border-b border-zinc-200 dark:border-zinc-700 translate-y-2" />
        </div>
      </div>
    </div>
  )
}
