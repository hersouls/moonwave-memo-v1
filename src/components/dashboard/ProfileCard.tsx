import { useNavigate } from 'react-router-dom'
import { LogIn } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { useSettingsStore } from '@/stores/settingsStore'

export function ProfileCard() {
  const user = useAuthStore((s) => s.user)
  const login = useAuthStore((s) => s.login)
  const isSigningIn = useAuthStore((s) => s.isSigningIn)
  const userProfile = useSettingsStore((s) => s.settings.userProfile)
  const navigate = useNavigate()

  if (!user) {
    return (
      <div className="flex items-center gap-4 rounded-2xl bg-white px-5 py-4 shadow-sm dark:bg-zinc-800">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-700">
          <span className="text-lg text-zinc-400 dark:text-zinc-500">?</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            로그인하세요
          </p>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            로그인하면 메모를 동기화할 수 있습니다
          </p>
        </div>
        <button
          onClick={login}
          disabled={isSigningIn}
          className="flex items-center gap-1.5 rounded-lg bg-primary-500 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-600 active:bg-primary-700 disabled:opacity-50"
        >
          <LogIn className="h-4 w-4" />
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
      onClick={() => navigate('/settings')}
      className="flex w-full items-center gap-4 rounded-2xl bg-white px-5 py-4 shadow-sm transition-colors hover:bg-zinc-50 active:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-750 dark:active:bg-zinc-700 text-left"
    >
      {photoURL ? (
        <img
          src={photoURL}
          alt={displayName}
          className="h-12 w-12 shrink-0 rounded-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900">
          <span className="text-lg font-semibold text-primary-600 dark:text-primary-300">
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
    </button>
  )
}
