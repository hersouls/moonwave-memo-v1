import { useAppLockStore } from '@/hooks/useAppLock'
import { Spinner } from './Spinner'
import { IcLineLock, IcMwFingerprint } from '@/mw/icons'

export function LockScreen() {
  const isLocked = useAppLockStore((s) => s.isLocked)
  const isAuthenticating = useAppLockStore((s) => s.isAuthenticating)
  const unlock = useAppLockStore((s) => s.unlock)

  if (!isLocked) return null

  return (
    <div className="fixed inset-0 z-[var(--z-lock)] flex flex-col items-center justify-center bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl">
      <IcLineLock size={48} className="text-zinc-500 dark:text-zinc-400 mb-4" />
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
        앱이 잠겨 있습니다
      </h2>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
        생체 인증으로 잠금 해제하세요
      </p>
      <button type="button"
        onClick={unlock}
        disabled={isAuthenticating}
        className="mw-button mw-button--primary mw-button--large"
      >
        {isAuthenticating ? (
          <Spinner size="md" label="인증 중" />
        ) : (
          <IcMwFingerprint size={20} />
        )}
        잠금 해제
      </button>
    </div>
  )
}
