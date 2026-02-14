import { useMemo } from 'react'
import { ChevronLeft, ChevronRight, Hash, Star, StickyNote, Trash2 } from 'lucide-react'
import clsx from 'clsx'
import { useUIStore, type CurrentView } from '@/stores/uiStore'
import { useFolderStore } from '@/stores/folderStore'
import { useMemoStore } from '@/stores/memoStore'
import { useAuthStore } from '@/stores/authStore'
import { useSettingsStore } from '@/stores/settingsStore'

export function Sidebar() {
  const { isSidebarOpen, toggleSidebar, activeFolderId, setActiveFolderId, activeFilter, setActiveFilter, activeTag, setActiveTag, setCurrentView } = useUIStore()
  const { folders } = useFolderStore()
  const { memos } = useMemoStore()
  const { user } = useAuthStore()
  const { settings } = useSettingsStore()

  const userFolders = folders.filter((f) => !f.isSystem)
  const trashFolder = folders.find((f) => f.isSystem)

  const activeMemos = memos.filter((m) => !m.deletedAt)
  const trashedCount = memos.filter((m) => !!m.deletedAt).length

  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    activeMemos.forEach((m) => m.tags.forEach((t) => tagSet.add(t)))
    return Array.from(tagSet).sort()
  }, [activeMemos])

  const folderCounts = useMemo(() => {
    const counts: Record<number, number> = {}
    activeMemos.forEach((m) => {
      if (m.folderId != null) {
        counts[m.folderId] = (counts[m.folderId] || 0) + 1
      }
    })
    return counts
  }, [activeMemos])

  const displayName = user?.displayName || settings.userProfile.name
  const avatarUrl = user?.photoURL || undefined

  const handleViewChange = (view: CurrentView) => {
    setCurrentView(view)
  }

  return (
    <aside
      className={clsx(
        'sidebar hidden flex-col border-r border-gray-100 bg-gray-50/80 transition-all duration-200 md:flex dark:border-gray-800 dark:bg-gray-900/80',
        isSidebarOpen ? 'w-64' : 'w-16'
      )}
    >
      {/* User profile */}
      <div className="flex items-center gap-3 border-b border-gray-100 p-4 dark:border-gray-800">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-100 dark:bg-primary-900">
          {avatarUrl ? (
            <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
          ) : (
            <span className="text-sm font-semibold text-primary-700 dark:text-primary-300">
              {displayName.charAt(0)}
            </span>
          )}
        </div>
        {isSidebarOpen && (
          <span className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">
            {displayName}
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 scrollbar-none">
        {/* All memos */}
        <button
          onClick={() => {
            setActiveFilter('all')
            handleViewChange('memos')
          }}
          className={clsx(
            'mb-0.5 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
            activeFilter === 'all' && !activeFolderId && !activeTag
              ? 'bg-primary-50 font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
              : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
          )}
        >
          <StickyNote className="h-4 w-4 shrink-0" />
          {isSidebarOpen && (
            <>
              <span className="flex-1 truncate text-left">모든 메모</span>
              <span className="text-xs text-gray-400 dark:text-gray-500">{activeMemos.length}</span>
            </>
          )}
        </button>

        {/* Starred */}
        <button
          onClick={() => {
            setActiveFilter('starred')
            handleViewChange('memos')
          }}
          className={clsx(
            'mb-0.5 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
            activeFilter === 'starred'
              ? 'bg-primary-50 font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
              : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
          )}
        >
          <Star className="h-4 w-4 shrink-0" />
          {isSidebarOpen && (
            <>
              <span className="flex-1 truncate text-left">중요 메모</span>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {activeMemos.filter((m) => m.isStarred).length}
              </span>
            </>
          )}
        </button>

        {/* Divider */}
        {isSidebarOpen && (
          <div className="my-3 border-t border-gray-100 dark:border-gray-800" />
        )}

        {/* Folders */}
        {isSidebarOpen && (
          <div className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            폴더
          </div>
        )}

        {userFolders.map((folder) => (
          <button
            key={folder.id}
            onClick={() => {
              setActiveFolderId(folder.id!)
              handleViewChange('memos')
            }}
            className={clsx(
              'mb-0.5 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
              activeFolderId === folder.id
                ? 'bg-primary-50 font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
            )}
          >
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: folder.color }}
            />
            {isSidebarOpen && (
              <>
                <span className="flex-1 truncate text-left">{folder.name}</span>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {folderCounts[folder.id!] || 0}
                </span>
              </>
            )}
          </button>
        ))}

        {/* Trash */}
        {trashFolder && (
          <button
            onClick={() => {
              setActiveFolderId(trashFolder.id!)
              handleViewChange('memos')
            }}
            className={clsx(
              'mb-0.5 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
              activeFolderId === trashFolder.id
                ? 'bg-gray-200 font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-200'
                : 'text-gray-500 hover:bg-gray-100 dark:text-gray-500 dark:hover:bg-gray-800'
            )}
          >
            <Trash2 className="h-4 w-4 shrink-0" />
            {isSidebarOpen && (
              <>
                <span className="flex-1 truncate text-left">{trashFolder.name}</span>
                <span className="text-xs text-gray-400 dark:text-gray-500">{trashedCount}</span>
              </>
            )}
          </button>
        )}

        {/* Tags */}
        {isSidebarOpen && allTags.length > 0 && (
          <>
            <div className="my-3 border-t border-gray-100 dark:border-gray-800" />
            <div className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              태그
            </div>

            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => {
                  setActiveTag(tag)
                  handleViewChange('memos')
                }}
                className={clsx(
                  'mb-0.5 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  activeTag === tag
                    ? 'bg-primary-50 font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                )}
              >
                <Hash className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                <span className="flex-1 truncate text-left">{tag}</span>
              </button>
            ))}
          </>
        )}
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-gray-100 p-2 dark:border-gray-800">
        <button
          onClick={toggleSidebar}
          className="flex w-full items-center justify-center rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
          aria-label={isSidebarOpen ? '사이드바 접기' : '사이드바 펼치기'}
        >
          {isSidebarOpen ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
      </div>
    </aside>
  )
}
