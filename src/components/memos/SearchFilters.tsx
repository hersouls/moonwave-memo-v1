import { Star, Calendar, Palette, X } from 'lucide-react'
import clsx from 'clsx'
import { useUIStore } from '@/stores/uiStore'
import type { MemoColor } from '@/lib/types'

const DATE_OPTIONS: { value: 'all' | 'today' | 'week' | 'month'; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'today', label: '오늘' },
  { value: 'week', label: '이번 주' },
  { value: 'month', label: '이번 달' },
]

const COLOR_OPTIONS: { value: MemoColor; bg: string }[] = [
  { value: 'white', bg: 'bg-white border border-zinc-200 dark:bg-zinc-700 dark:border-zinc-600' },
  { value: 'yellow', bg: 'bg-amber-200 dark:bg-amber-700' },
  { value: 'green', bg: 'bg-emerald-200 dark:bg-emerald-700' },
  { value: 'blue', bg: 'bg-blue-200 dark:bg-blue-700' },
  { value: 'pink', bg: 'bg-pink-200 dark:bg-pink-700' },
  { value: 'purple', bg: 'bg-purple-200 dark:bg-purple-700' },
]

export function SearchFilters() {
  const searchFilters = useUIStore((s) => s.searchFilters)
  const setSearchFilters = useUIStore((s) => s.setSearchFilters)
  const resetSearchFilters = useUIStore((s) => s.resetSearchFilters)

  const hasActiveFilters =
    searchFilters.dateRange !== 'all' ||
    searchFilters.starredOnly ||
    searchFilters.colorFilter !== null

  return (
    <div className="flex flex-wrap items-center gap-2 py-2 fold:flex-nowrap fold:overflow-x-auto fold:scrollbar-none fold:-mx-2 fold:px-2">
      {/* Date range chips */}
      <div className="flex items-center gap-1">
        <Calendar className="h-3.5 w-3.5 text-zinc-400" />
        {DATE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setSearchFilters({ dateRange: opt.value })}
            className={clsx(
              'px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
              searchFilters.dateRange === opt.value
                ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Starred toggle */}
      <button
        onClick={() => setSearchFilters({ starredOnly: !searchFilters.starredOnly })}
        className={clsx(
          'flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
          searchFilters.starredOnly
            ? 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300'
            : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
        )}
      >
        <Star className={clsx('h-3 w-3', searchFilters.starredOnly && 'fill-current')} />
        중요
      </button>

      {/* Color filter */}
      <div className="flex items-center gap-1">
        <Palette className="h-3.5 w-3.5 text-zinc-400" />
        {COLOR_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() =>
              setSearchFilters({
                colorFilter: searchFilters.colorFilter === opt.value ? null : opt.value,
              })
            }
            className={clsx(
              'h-5 w-5 rounded-full transition-all',
              opt.bg,
              searchFilters.colorFilter === opt.value
                ? 'ring-2 ring-primary-500 ring-offset-1 dark:ring-offset-zinc-900'
                : 'hover:scale-110'
            )}
            aria-label={`${opt.value} 색상 필터`}
          />
        ))}
      </div>

      {/* Reset button */}
      {hasActiveFilters && (
        <button
          onClick={resetSearchFilters}
          className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
        >
          <X className="h-3 w-3" />
          초기화
        </button>
      )}
    </div>
  )
}
