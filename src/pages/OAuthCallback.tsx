import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { StickyNote } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'

export function OAuthCallback() {
  const navigate = useNavigate()
  const { user, isLoading, isSigningIn } = useAuthStore()
  // 10초 이상 지연되면 홈으로 돌아갈 수 있는 안내를 표시
  const [isDelayed, setIsDelayed] = useState(false)

  useEffect(() => {
    // Once auth state resolves and we have a user (or auth finished), redirect
    if (!isLoading && !isSigningIn) {
      navigate('/', { replace: true })
    }
  }, [user, isLoading, isSigningIn, navigate])

  useEffect(() => {
    const timer = setTimeout(() => setIsDelayed(true), 10_000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--color-bg-primary)]">
      <div className="flex flex-col items-center animate-in fade-in duration-300">
        {/* 브랜드 마크 */}
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500">
            <StickyNote className="h-6 w-6 text-white" aria-hidden="true" />
          </div>
          <span className="text-lg font-bold text-[var(--color-text-primary)]">Memo</span>
        </div>

        <Spinner size="md" className="w-6 h-6 text-primary-500" label="" />
        <p className="mt-4 text-sm text-[var(--color-text-secondary)]" role="status">
          로그인 처리 중...
        </p>

        {/* 지연 시 복귀 경로 제공 */}
        {isDelayed && (
          <div className="mt-8 flex flex-col items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <p className="text-xs text-[var(--color-text-tertiary)]">문제가 있나요?</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/', { replace: true })}
            >
              홈으로 돌아가기
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
