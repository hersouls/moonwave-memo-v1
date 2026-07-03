import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { StickyNote } from 'lucide-react'
import { useMemoStore } from '@/stores/memoStore'
import { useToastStore } from '@/stores/toastStore'
import { Spinner } from '@/components/ui/Spinner'

export function ShareTargetPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const addMemo = useMemoStore((s) => s.addMemo)
  const created = useRef(false)

  useEffect(() => {
    if (created.current) return
    created.current = true

    const title = searchParams.get('title') || ''
    const text = searchParams.get('text') || ''
    const url = searchParams.get('url') || ''

    const body = [text, url].filter(Boolean).join('\n\n')

    if (!title && !body) {
      navigate('/', { replace: true })
      return
    }

    addMemo({ title, body, folderId: null })
      .then((id) => {
        if (id) {
          useToastStore.getState().showToast('공유된 내용으로 메모가 생성되었습니다', 'success')
          navigate(`/memo/${id}`, { replace: true })
        } else {
          useToastStore.getState().showToast('메모 생성에 실패했습니다', 'error')
          navigate('/', { replace: true })
        }
      })
      .catch(() => {
        useToastStore.getState().showToast('메모 생성에 실패했습니다', 'error')
        navigate('/', { replace: true })
      })
  }, [searchParams, addMemo, navigate])

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
          공유된 내용으로 메모를 만드는 중...
        </p>
      </div>
    </div>
  )
}
