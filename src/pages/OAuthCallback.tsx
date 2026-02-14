import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { Loader2 } from 'lucide-react'

export function OAuthCallback() {
  const navigate = useNavigate()
  const { user, isLoading, isSigningIn } = useAuthStore()

  useEffect(() => {
    // Once auth state resolves and we have a user (or auth finished), redirect
    if (!isLoading && !isSigningIn) {
      navigate('/', { replace: true })
    }
  }, [user, isLoading, isSigningIn, navigate])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white dark:bg-gray-900">
      <Loader2 className="mb-4 h-8 w-8 animate-spin text-primary-500" />
      <p className="text-sm text-gray-500 dark:text-gray-400">
        로그인 처리 중...
      </p>
    </div>
  )
}
