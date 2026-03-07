import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMemoStore } from '@/stores/memoStore'
import { useToastStore } from '@/stores/toastStore'

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

    addMemo({ title, body, folderId: null }).then((id) => {
      if (id) {
        useToastStore.getState().showToast('공유된 내용으로 메모가 생성되었습니다', 'success')
        navigate(`/memo/${id}`, { replace: true })
      } else {
        navigate('/', { replace: true })
      }
    })
  }, [searchParams, addMemo, navigate])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
