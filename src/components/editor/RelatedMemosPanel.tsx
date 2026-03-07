import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Link2, ChevronDown, ChevronUp } from 'lucide-react'
import Fuse from 'fuse.js'
import { useMemoStore } from '@/stores/memoStore'
import type { Memo } from '@/lib/types'

interface RelatedMemosPanelProps {
  memoId?: number
  tags: string[]
  body: string
}

interface ScoredMemo {
  memo: Memo
  score: number
}

export function RelatedMemosPanel({ memoId, tags, body }: RelatedMemosPanelProps) {
  const memos = useMemoStore((s) => s.memos)
  const navigate = useNavigate()
  const [isExpanded, setIsExpanded] = useState(true)

  const relatedMemos = useMemo(() => {
    if (!memoId && !body) return []

    const activeMemos = memos.filter((m) => !m.deletedAt && m.id !== memoId)
    if (activeMemos.length === 0) return []

    const scored: ScoredMemo[] = []

    // Tag overlap scoring
    if (tags.length > 0) {
      for (const memo of activeMemos) {
        const overlap = memo.tags.filter((t) => tags.includes(t)).length
        if (overlap > 0) {
          scored.push({ memo, score: overlap * 10 })
        }
      }
    }

    // Fuse.js content similarity scoring
    if (body.trim().length > 20) {
      const fuse = new Fuse(activeMemos, {
        keys: ['title', 'body'],
        threshold: 0.6,
        includeScore: true,
        minMatchCharLength: 3,
      })

      // Use first 200 chars of body as search query
      const query = body.slice(0, 200)
      const results = fuse.search(query, { limit: 10 })

      for (const result of results) {
        const existing = scored.find((s) => s.memo.id === result.item.id)
        const fuseScore = (1 - (result.score ?? 1)) * 5
        if (existing) {
          existing.score += fuseScore
        } else {
          scored.push({ memo: result.item, score: fuseScore })
        }
      }
    }

    // Sort by score descending and take top 5
    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, 5).map((s) => s.memo)
  }, [memos, memoId, tags, body])

  if (relatedMemos.length === 0) return null

  return (
    <div className="rounded-2xl bg-white dark:bg-zinc-800 shadow-sm border border-zinc-100 dark:border-zinc-700/50 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-700/30 transition-colors"
      >
        <Link2 className="w-4 h-4 text-primary-500 shrink-0" />
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex-1">
          연관 메모
        </span>
        <span className="text-xs text-zinc-400 dark:text-zinc-500 mr-1">
          {relatedMemos.length}
        </span>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-zinc-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-zinc-400" />
        )}
      </button>

      {isExpanded && (
        <ul className="px-4 pb-3 space-y-1">
          {relatedMemos.map((memo) => (
            <li key={memo.id}>
              <button
                onClick={() => navigate(`/memo/${memo.id}`)}
                className="w-full text-left py-1.5 px-2 -mx-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors group"
              >
                <p className="text-sm text-zinc-700 dark:text-zinc-300 truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                  {memo.title || '제목 없음'}
                </p>
                {memo.tags.length > 0 && (
                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate mt-0.5">
                    {memo.tags.slice(0, 3).map((t) => `#${t}`).join(' ')}
                  </p>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
