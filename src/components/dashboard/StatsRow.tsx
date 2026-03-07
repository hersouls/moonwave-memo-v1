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
        className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3.5 shadow-sm transition-colors hover:bg-zinc-50 active:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-750 dark:active:bg-zinc-700"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-100 dark:bg-primary-900">
          <FileText className="h-4.5 w-4.5 text-primary-600 dark:text-primary-300" />
        </div>
        <div className="text-left">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">전체</p>
          <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{totalCount}</p>
        </div>
      </button>

      <button
        onClick={handleStarredClick}
        className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3.5 shadow-sm transition-colors hover:bg-zinc-50 active:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-750 dark:active:bg-zinc-700"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-warning-100 dark:bg-warning-900/30">
          <Star className="h-4.5 w-4.5 text-warning-500 dark:text-warning-400" />
        </div>
        <div className="text-left">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">중요</p>
          <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{starredCount}</p>
        </div>
      </button>
    </div>
  )
})
