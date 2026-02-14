import clsx from 'clsx'
import { useFolderStore } from '@/stores/folderStore'
import { useUIStore } from '@/stores/uiStore'

export function MemoFilterTabs() {
  const folders = useFolderStore((s) => s.folders)
  const activeFilter = useUIStore((s) => s.activeFilter)
  const activeFolderId = useUIStore((s) => s.activeFolderId)
  const activeTag = useUIStore((s) => s.activeTag)
  const setActiveFilter = useUIStore((s) => s.setActiveFilter)
  const setActiveFolderId = useUIStore((s) => s.setActiveFolderId)

  const userFolders = folders
    .filter((f) => !f.isSystem)
    .sort((a, b) => a.sortOrder - b.sortOrder)

  const isAllActive = activeFilter === 'all' && activeFolderId == null && activeTag == null
  const isStarredActive = activeFilter === 'starred'

  return (
    <div className="scrollbar-none flex gap-2 overflow-x-auto px-4 py-2 lg:px-0">
      {/* All */}
      <button
        onClick={() => setActiveFilter('all')}
        className={clsx(
          'shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition-colors',
          isAllActive
            ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
            : 'border border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-700'
        )}
      >
        전체
      </button>

      {/* Starred */}
      <button
        onClick={() => setActiveFilter('starred')}
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
    </div>
  )
}
