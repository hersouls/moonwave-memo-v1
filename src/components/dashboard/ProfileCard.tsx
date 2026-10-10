import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { IcMwDoor } from '@/mw/icons'

export function ProfileCard() {
  const user = useAuthStore((s) => s.user)
  const login = useAuthStore((s) => s.login)
  const isSigningIn = useAuthStore((s) => s.isSigningIn)
  const userProfile = useSettingsStore((s) => s.settings.userProfile)

  if (!user) {
    // 좁은 칸에서는 버튼이 글 아래로 내려가요: 글이 한 글자씩 꺾이지 않아요
    return (
      <div className="card flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4">
        <div className="min-w-40 flex-1">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            로그인하면 기기끼리 메모가 이어져요
          </p>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            로그인하지 않아도 이 기기에서는 모든 기능을 쓸 수 있어요.
          </p>
        </div>
        <button type="button"
          onClick={login}
          disabled={isSigningIn}
          className="mw-button mw-button--secondary mw-button--medium mw-button--icon-left shrink-0"
        >
          <IcMwDoor size={16} />
          로그인
        </button>
      </div>
    )
  }

  const displayName = user.displayName || userProfile.name || '사용자'
  const email = user.email
  const photoURL = user.photoURL || userProfile.avatarUrl

  return (
    <button
      type="button"
      onClick={() => useUIStore.getState().openSettingsModal()}
      className="mw-surface mw-surface--link w-full text-left"
    >
      <span className="flex items-center gap-4">
      {photoURL ? (
        <img
          src={photoURL}
          alt={displayName}
          className="h-12 w-12 shrink-0 rounded-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-100 ">
          <span className="text-lg font-semibold text-primary-600 ">
            {displayName.charAt(0)}
          </span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
          {displayName}
        </p>
        {email && (
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400 truncate">
            {email}
          </p>
        )}
      </div>
    </span>
    </button>
  )
}
