import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, Hash } from 'lucide-react'
import { clsx } from 'clsx'
import { useUIStore } from '@/stores/uiStore'
import { useMemoStats } from '@/hooks/useMemoStats'
import { useViewTransition } from '@/hooks/useViewTransition'
import { WidgetCard } from './WidgetCard'

/** 대시보드에서 기본으로 노출할 상위 태그 수 — 나머지는 "더 보기"로 펼침 */
const VISIBLE_LIMIT = 12

export function TagCloud() {
  const navigate = useNavigate()
  const { navigateWithTransition } = useViewTransition()
  const setActiveTag = useUIStore((s) => s.setActiveTag)
  const setActiveFilter = useUIStore((s) => s.setActiveFilter)
  const { allTags, tagCounts } = useMemoStats()
  const [showAll, setShowAll] = useState(false)

  // 대시보드는 "요약" 화면 — 가나다순 전체 나열 대신 자주 쓰는 태그를 먼저 보여준다.
  const sortedTags = useMemo(
    () =>
      [...allTags].sort((a, b) => {
        const diff = (tagCounts.get(b) || 0) - (tagCounts.get(a) || 0)
        return diff !== 0 ? diff : a.localeCompare(b, 'ko')
      }),
    [allTags, tagCounts]
  )

  const hasOverflow = sortedTags.length > VISIBLE_LIMIT
  const visibleTags = showAll ? sortedTags : sortedTags.slice(0, VISIBLE_LIMIT)
  const hiddenCount = sortedTags.length - VISIBLE_LIMIT

  const handleTagClick = (tag: string | null) => {
    if (tag === null) {
      setActiveFilter('all')
    } else {
      setActiveTag(tag)
    }
    navigateWithTransition('/memos')
  }

  return (
    <WidgetCard icon={Hash} title="태그" meta={allTags.length} collapsible>
      {allTags.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-2 text-center">
          <Hash className="h-5 w-5 text-zinc-400" aria-hidden="true" />
          <p className="text-sm text-zinc-500 dark:text-zinc-400">태그가 없습니다</p>
          <button
            type="button"
            onClick={() => navigate('/memo/new')}
            className="text-xs font-medium text-primary-600 hover:underline dark:text-primary-400"
          >
            메모 작성하기
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleTagClick(null)}
              className="rounded-full bg-zinc-900 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              모든 태그
            </button>
            {visibleTags.map((tag) => (
              <button
                key={tag}
                onClick={() => handleTagClick(tag)}
                className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 active:bg-zinc-200 dark:border-white/10 dark:bg-white/[0.06] dark:text-zinc-300 dark:hover:bg-white/10 dark:active:bg-white/15"
              >
                #{tag}
              </button>
            ))}
          </div>
          {hasOverflow && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              aria-expanded={showAll}
              className="mt-3 flex items-center gap-1 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              <span>{showAll ? '접기' : `+${hiddenCount}개 더 보기`}</span>
              <ChevronDown
                aria-hidden="true"
                className={clsx('h-3.5 w-3.5 transition-transform duration-200', showAll && 'rotate-180')}
              />
            </button>
          )}
        </>
      )}
    </WidgetCard>
  )
}
