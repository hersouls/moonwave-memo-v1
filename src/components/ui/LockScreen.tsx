import { Lock, Fingerprint, Loader2 } from 'lucide-react'
import { useAppLockStore } from '@/hooks/useAppLock'

export function LockScreen() {
  const isLocked = useAppLockStore((s) => s.isLocked)
  const isAuthenticating = useAppLockStore((s) => s.isAuthenticating)
  const unlock = useAppLockStore((s) => s.unlock)

  if (!isLocked) return null

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl">
      <Lock className="w-12 h-12 text-zinc-400 dark:text-zinc-500 mb-4" />
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
        앱이 잠겨 있습니다
      </h2>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
        생체 인증으로 잠금 해제하세요
      </p>
      <button
        onClick={unlock}
        disabled={isAuthenticating}
        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary-500 text-white font-medium text-sm hover:bg-primary-600 disabled:opacity-50 transition-colors"
      >
        {isAuthenticating ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Fingerprint className="w-5 h-5" />
        )}
        잠금 해제
      </button>
    </div>
  )
}
