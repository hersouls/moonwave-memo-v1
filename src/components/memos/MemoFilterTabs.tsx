import clsx from 'clsx'
import { ArrowUpDown } from 'lucide-react'
import { useFolderStore } from '@/stores/folderStore'
import { useUIStore } from '@/stores/uiStore'
import type { SortBy } from '@/lib/types'

const SORT_LABELS: Record<SortBy, string> = {
  updatedAt: '수정일',
  createdAt: '생성일',
  title: '이름순',
}
const SORT_ORDER: SortBy[] = ['updatedAt', 'createdAt', 'title']

export function MemoFilterTabs() {
  const folders = useFolderStore((s) => s.folders)
  const activeFilter = useUIStore((s) => s.activeFilter)
  const activeFolderId = useUIStore((s) => s.activeFolderId)
  const activeTag = useUIStore((s) => s.activeTag)
  const setActiveFilter = useUIStore((s) => s.setActiveFilter)
  const setActiveFolderId = useUIStore((s) => s.setActiveFolderId)
  const sortBy = useUIStore((s) => s.sortBy)
  const setSortBy = useUIStore((s) => s.setSortBy)
  // UX-01: hide when sidebar is open on desktop
  const isSidebarOpen = useUIStore((s) => s.isSidebarOpen)

  const userFolders = folders
    .filter((f) => !f.isSystem)
    .sort((a, b) => a.sortOrder - b.sortOrder)

  const isAllActive = activeFilter === 'all' && activeFolderId == null && activeTag == null
  const isStarredActive = activeFilter === 'starred'

  // A11Y-01: role="tablist" + UX-01: hide when sidebar open on desktop
  return (
    <div
      className={clsx('scrollbar-none flex gap-2 overflow-x-auto px-4 py-2 lg:px-0', isSidebarOpen && 'lg:hidden')}
      role="tablist"
      aria-label="메모 필터"
    >
      {/* A11Y-01: role="tab" + aria-selected */}
      <button
        onClick={() => setActiveFilter('all')}
        role="tab"
        aria-selected={isAllActive}
        className={clsx(
          'shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition-colors',
          isAllActive
            ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
            : 'border border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-700'
        )}
      >
        전체
      </button>

      <button
        onClick={() => setActiveFilter('starred')}
        role="tab"
        aria-selected={isStarredActive}
        className={clsx(
          'shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition-colors',
          isStarredActive
            ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
            : 'border border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-700'
        )}
      >
        중요
      </button>

      {/* Folder tabs */}
      {userFolders.map((folder) => {
        const isActive = activeFolderId === folder.id
        return (
          <button
            key={folder.id}
            onClick={() => setActiveFolderId(folder.id!)}
            role="tab"
            aria-selected={isActive}
            className={clsx(
              'shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition-colors',
              isActive
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                : 'border border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-700'
            )}
          >
            {folder.name}
          </button>
        )
      })}

      {/* Active tag indicator */}
      {activeTag && (
        <button
          onClick={() => setActiveFilter('all')}
          className="shrink-0 rounded-full bg-primary-500 px-4 py-1.5 text-xs font-medium text-white"
        >
          #{activeTag}
        </button>
      )}

      {/* Sort indicator chip */}
      <button
        onClick={() => {
          const idx = SORT_ORDER.indexOf(sortBy)
          setSortBy(SORT_ORDER[(idx + 1) % SORT_ORDER.length])
        }}
        className="shrink-0 flex items-center gap-1 rounded-full border border-zinc-200 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-700"
        aria-label={`정렬: ${SORT_LABELS[sortBy]}`}
      >
        <ArrowUpDown className="h-3 w-3" />
        {SORT_LABELS[sortBy]}
      </button>
    </div>
  )
}
