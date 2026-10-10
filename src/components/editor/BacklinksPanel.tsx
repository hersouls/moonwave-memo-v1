import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMemoStore } from '@/stores/memoStore'
import { IcLineChevronDown, IcLineChevronUp, IcMwLink } from '@/mw/icons'

interface BacklinksPanelProps {
  memoId?: number
  title: string
}

export function BacklinksPanel({ memoId, title }: BacklinksPanelProps) {
  const [isOpen, setIsOpen] = useState(false)
  const navigate = useNavigate()
  const memos = useMemoStore((s) => s.memos)

  const backlinks = useMemo(() => {
    if (!title.trim()) return []
    const pattern = `[[${title}]]`
    return memos.filter(
      (m) => m.id !== memoId && !m.deletedAt && m.body.includes(pattern)
    )
  }, [memos, memoId, title])

  if (backlinks.length === 0) return null

  return (
    <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden">
      <button type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="mw-button mw-button--tertiary-subtle mw-button--large w-full justify-start"
      >
        <IcMwLink size={16} className="text-primary-500" />
        <span className="flex-1 text-left">
          연결된 메모 ({backlinks.length})
        </span>
        {isOpen ? <IcLineChevronUp size={16} /> : <IcLineChevronDown size={16} />}
      </button>

      {isOpen && (
        <div className="px-3 pb-3 space-y-1 animate-in fade-in slide-in-from-top-1 duration-200">
          {backlinks.map((memo) => (
            <button type="button"
              key={memo.id}
              onClick={() => navigate(`/memo/${memo.id}`)}
              className="mw-text-button mw-text-button--ghost mw-text-button--medium mw-text-button--default w-full truncate"
            >
              <span>{memo.title || '제목 없음'}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
