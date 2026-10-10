import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMemoStore } from '@/stores/memoStore'
import { IcLineClose, IcLineDocument } from '@/mw/icons'

const LAST_VIEWED_KEY = 'memo-last-viewed-id'

export function setLastViewedMemo(memoId: number) {
  localStorage.setItem(LAST_VIEWED_KEY, String(memoId))
}

export function ContinueBanner() {
  const [memoId, setMemoId] = useState<number | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const navigate = useNavigate()
  const memos = useMemoStore((s) => s.memos)

  useEffect(() => {
    const stored = localStorage.getItem(LAST_VIEWED_KEY)
    if (stored) {
      const id = Number(stored)
      const exists = memos.some((m) => m.id === id && !m.deletedAt)
      if (exists) {
        setMemoId(id)
      }
    }
  }, [memos])

  if (!memoId || dismissed) return null

  const memo = memos.find((m) => m.id === memoId)
  if (!memo) return null

  return (
    <div className="mx-4 lg:mx-0 mb-3 flex items-center gap-3 p-3 rounded-xl bg-primary-50 dark:bg-primary-900/10 border border-primary-200 dark:border-primary-800 animate-in fade-in slide-in-from-top-2 duration-200">
      <IcLineDocument size={20} className="text-primary-500 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-primary-700 dark:text-primary-300">
          이전에 보던 메모가 있습니다
        </p>
        <p className="text-xs text-primary-500 dark:text-primary-400 truncate">
          {memo.title || '제목 없음'}
        </p>
      </div>
      <button type="button"
        onClick={() => {
          navigate(`/memo/${memoId}`)
          setDismissed(true)
        }}
        className="mw-button mw-button--primary mw-button--small shrink-0"
      >
        이어서 보기
      </button>
      <button type="button"
        onClick={() => setDismissed(true)}
        className="mw-icon-button shrink-0"
      >
        <IcLineClose size={16} />
      </button>
    </div>
  )
}
