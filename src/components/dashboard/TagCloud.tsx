import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Hash, ChevronDown, ChevronUp } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'
import { useMemoStats } from '@/hooks/useMemoStats'

export function TagCloud() {
  const navigate = useNavigate()
  const setActiveTag = useUIStore((s) => s.setActiveTag)
  const setActiveFilter = useUIStore((s) => s.setActiveFilter)
  const { allTags } = useMemoStats()
  const [isCollapsed, setIsCollapsed] = useState(false)

  const handleTagClick = (tag: string | null) => {
    if (tag === null) {
      setActiveFilter('all')
    } else {
      setActiveTag(tag)
    }
    navigate('/memos')
  }

  return (
    <div className="rounded-2xl bg-white shadow-sm dark:bg-zinc-800">
      {/* Header */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="flex w-full items-center justify-between px-5 py-3.5"
      >
        <div className="flex items-center gap-2.5">
          <Hash className="h-4.5 w-4.5 text-zinc-500 dark:text-zinc-400" />
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            태그
          </span>
          <span className="text-xs text-zinc-400 dark:text-zinc-500">
            {allTags.length}
          </span>
        </div>
        {isCollapsed ? (
          <ChevronDown className="h-4 w-4 text-zinc-400" />
        ) : (
          <ChevronUp className="h-4 w-4 text-zinc-400" />
        )}
      </button>

      {/* Tag chips */}
      {!isCollapsed && (
        <div className="border-t border-zinc-100 px-5 py-4 dark:border-zinc-700">
          {allTags.length === 0 ? (
            <p className="text-center text-sm text-zinc-400 dark:text-zinc-500">
              태그가 없습니다
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleTagClick(null)}
                className="rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                모든 태그
              </button>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => handleTagClick(tag)}
                  className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 active:bg-zinc-200 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
