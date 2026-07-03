import { useNavigate } from 'react-router-dom'
import { Hash } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'
import { useMemoStats } from '@/hooks/useMemoStats'
import { WidgetCard } from './WidgetCard'

export function TagCloud() {
  const navigate = useNavigate()
  const setActiveTag = useUIStore((s) => s.setActiveTag)
  const setActiveFilter = useUIStore((s) => s.setActiveFilter)
  const { allTags } = useMemoStats()

  const handleTagClick = (tag: string | null) => {
    if (tag === null) {
      setActiveFilter('all')
    } else {
      setActiveTag(tag)
    }
    navigate('/memos')
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
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleTagClick(null)}
            className="rounded-full bg-zinc-900 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            모든 태그
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => handleTagClick(tag)}
              className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 active:bg-zinc-200 dark:border-white/10 dark:bg-white/[0.06] dark:text-zinc-300 dark:hover:bg-white/10 dark:active:bg-white/15"
            >
              #{tag}
            </button>
          ))}
        </div>
      )}
    </WidgetCard>
  )
}
