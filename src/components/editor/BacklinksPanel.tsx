import { useMemo, useState } from 'react'
import { Link2, ChevronDown, ChevronUp } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useMemoStore } from '@/stores/memoStore'

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
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
      >
        <Link2 className="h-4 w-4 text-primary-500" />
        <span className="flex-1 text-left">
          연결된 메모 ({backlinks.length})
        </span>
        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {isOpen && (
        <div className="px-3 pb-3 space-y-1 animate-in fade-in slide-in-from-top-1 duration-150">
          {backlinks.map((memo) => (
            <button
              key={memo.id}
              onClick={() => navigate(`/memo/${memo.id}`)}
              className="w-full text-left px-2 py-1.5 rounded-lg text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors truncate"
            >
              {memo.title || '제목 없음'}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
