import { memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Star } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'
import { useMemoStats } from '@/hooks/useMemoStats'

export const StatsRow = memo(function StatsRow() {
  const navigate = useNavigate()
  const setActiveFilter = useUIStore((s) => s.setActiveFilter)
  const { totalCount, starredCount } = useMemoStats()

  const handleAllClick = () => {
    setActiveFilter('all')
    navigate('/memos')
  }

  const handleStarredClick = () => {
    setActiveFilter('starred')
    navigate('/memos')
  }

  return (
    <div className="grid grid-cols-2 fold:flex fold:overflow-x-auto fold:scrollbar-none fold:-mx-4 fold:px-4 gap-3">
      <button
        onClick={handleAllClick}
        className="card card--interactive flex items-center gap-3 px-4 py-3.5"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-500 dark:bg-primary-900/20 dark:text-primary-400">
          <FileText className="h-4 w-4" />
        </div>
        <div className="text-left">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">전체</p>
          <p className="text-2xl font-semibold tracking-tight tabular-nums text-zinc-900 dark:text-zinc-100">{totalCount}</p>
        </div>
      </button>

      <button
        onClick={handleStarredClick}
        className="card card--interactive flex items-center gap-3 px-4 py-3.5"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-500 dark:bg-amber-900/20 dark:text-amber-400">
          <Star className="h-4 w-4" />
        </div>
        <div className="text-left">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">중요</p>
          <p className="text-2xl font-semibold tracking-tight tabular-nums text-zinc-900 dark:text-zinc-100">{starredCount}</p>
        </div>
      </button>
    </div>
  )
})
