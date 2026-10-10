import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUIStore } from '@/stores/uiStore'
import { useMemoStats } from '@/hooks/useMemoStats'
import { useViewTransition } from '@/hooks/useViewTransition'
import { WidgetCard } from './WidgetCard'
import { IcMwTag } from '@/mw/icons'

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
    <WidgetCard icon={IcMwTag} title="태그" meta={allTags.length} collapsible>
      {allTags.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-2 text-center">
          <IcMwTag size={20} className="text-zinc-400" aria-hidden="true" />
          <p className="text-sm text-zinc-500 dark:text-zinc-400">아직 태그가 없어요</p>
          <button
            type="button"
            onClick={() => navigate('/memo/new')}
            className="mw-text-button mw-text-button--underline mw-text-button--medium mw-text-button--default"
          >
            <span>메모 쓰기</span>
          </button>
        </div>
      ) : (
        <>
          <div className="memo-chip-wrap">
            <button type="button"
              onClick={() => handleTagClick(null)}
              className="mw-select-chip mw-select-chip--on"
            >
              모든 태그
            </button>
            {visibleTags.map((tag) => (
              <button
                key={tag}
                onClick={() => handleTagClick(tag)}
                className="mw-select-chip mw-select-chip--off\"
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
              className="mw-text-button mw-text-button--ghost mw-text-button--medium mw-text-button--default mt-2"
            >
              <span>{showAll ? '접기' : `${hiddenCount}개 더 보기`}</span>
            </button>
          )}
        </>
      )}
    </WidgetCard>
  )
}
