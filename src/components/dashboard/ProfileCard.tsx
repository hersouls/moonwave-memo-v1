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
    return (
      <div className="card flex items-center gap-4 px-5 py-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-700">
          <span className="text-lg text-zinc-500 dark:text-zinc-400">?</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            로그인하세요
          </p>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            로그인하면 메모를 동기화할 수 있습니다
          </p>
        </div>
        <button type="button"
          onClick={login}
          disabled={isSigningIn}
          className="mw-button mw-button--secondary mw-button--medium mw-button--icon-left"
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
