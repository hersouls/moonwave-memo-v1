import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  Hash,
  HelpCircle,
  Settings,
  Star,
  StickyNote,
  Trash2,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useUIStore } from '@/stores/uiStore'
import { useFolderStore } from '@/stores/folderStore'
import { useMemoStore } from '@/stores/memoStore'
import { Tooltip } from '@/components/ui/Tooltip'

export function Sidebar() {
  const navigate = useNavigate()
  const isSidebarOpen = useUIStore((s) => s.isSidebarOpen)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const activeFolderId = useUIStore((s) => s.activeFolderId)
  const setActiveFolderId = useUIStore((s) => s.setActiveFolderId)
  const activeFilter = useUIStore((s) => s.activeFilter)
  const setActiveFilter = useUIStore((s) => s.setActiveFilter)
  const activeTag = useUIStore((s) => s.activeTag)
  const setActiveTag = useUIStore((s) => s.setActiveTag)
  const setCurrentView = useUIStore((s) => s.setCurrentView)
  const openSettingsModal = useUIStore((s) => s.openSettingsModal)
  const openFAQModal = useUIStore((s) => s.openFAQModal)

  const { folders } = useFolderStore()
  const { memos } = useMemoStore()

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

  const handleViewChange = () => {
    setCurrentView('memos')
    navigate('/memos')
  }

  const navButton = (
    label: string,
    icon: React.ReactNode,
    isActive: boolean,
    onClick: () => void,
    count?: number,
    activeStyle?: string
  ) => {
    const button = (
      <button
        onClick={onClick}
        className={clsx(
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
          isActive
            ? (activeStyle || 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300')
            : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
        )}
        role="menuitem"
        aria-current={isActive ? 'page' : undefined}
      >
        {icon}
        {isSidebarOpen && (
          <>
            <span className="text-sm font-medium truncate flex-1 text-left">{label}</span>
            {count !== undefined && (
              <span className="text-xs text-zinc-400 dark:text-zinc-500">{count}</span>
            )}
          </>
        )}
      </button>
    )

    return !isSidebarOpen ? (
      <Tooltip content={label} placement="right">{button}</Tooltip>
    ) : button
  }

  return (
    <aside
      className={clsx(
        'hidden lg:flex flex-col fixed h-screen bg-zinc-50 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 transition-all duration-300 z-40',
        isSidebarOpen ? 'w-64' : 'w-16'
      )}
      role="complementary"
      aria-label="사이드 네비게이션"
      aria-expanded={isSidebarOpen}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-zinc-200 dark:border-zinc-800">
        <Link
          to="/"
          className="flex items-center gap-3 overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-lg"
          aria-label="홈으로 이동"
        >
          <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <StickyNote className="w-5 h-5 text-white" aria-hidden="true" />
          </div>
          {isSidebarOpen && (
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-zinc-900 dark:text-zinc-100 truncate">
                Memo
              </span>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4" aria-label="주 메뉴">
        <ul className="space-y-1 px-2" role="menubar">
          {/* All Memos */}
          <li role="none">
            {navButton(
              '모든 메모',
              <StickyNote className="w-5 h-5 flex-shrink-0" aria-hidden="true" />,
              activeFilter === 'all' && !activeFolderId && !activeTag,
              () => { setActiveFilter('all'); handleViewChange() },
              activeMemos.length
            )}
          </li>

          {/* Starred */}
          <li role="none">
            {navButton(
              '중요 메모',
              <Star className="w-5 h-5 flex-shrink-0" aria-hidden="true" />,
              activeFilter === 'starred',
              () => { setActiveFilter('starred'); handleViewChange() },
              activeMemos.filter((m) => m.isStarred).length
            )}
          </li>
        </ul>

        {/* Folders Section */}
        {(isSidebarOpen || userFolders.length > 0) && (
          <section className="mt-6 px-2" aria-labelledby="folders-heading">
            {isSidebarOpen && (
              <h2
                id="folders-heading"
                className="px-3 mb-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider"
              >
                폴더
              </h2>
            )}
            <ul className="space-y-0.5" role="menu">
              {userFolders.map((folder) => (
                <li key={folder.id} role="none">
                  {navButton(
                    folder.name,
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: folder.color }}
                      aria-hidden="true"
                    />,
                    activeFolderId === folder.id,
                    () => { setActiveFolderId(folder.id!); handleViewChange() },
                    folderCounts[folder.id!] || 0
                  )}
                </li>
              ))}

              {/* Trash */}
              {trashFolder && (
                <li role="none">
                  {navButton(
                    trashFolder.name,
                    <Trash2 className="w-5 h-5 flex-shrink-0" aria-hidden="true" />,
                    activeFolderId === trashFolder.id,
                    () => { setActiveFolderId(trashFolder.id!); handleViewChange() },
                    trashedCount,
                    'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200'
                  )}
                </li>
              )}
            </ul>
          </section>
        )}

        {/* Tags Section */}
        {isSidebarOpen && allTags.length > 0 && (
          <section className="mt-6 px-2" aria-labelledby="tags-heading">
            <h2
              id="tags-heading"
              className="px-3 mb-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider"
            >
              태그
            </h2>
            <ul className="space-y-0.5" role="menu">
              {allTags.map((tag) => (
                <li key={tag} role="none">
                  {navButton(
                    tag,
                    <Hash className="w-4 h-4 flex-shrink-0 text-zinc-400" aria-hidden="true" />,
                    activeTag === tag,
                    () => { setActiveTag(tag); handleViewChange() }
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Help & Settings */}
        <div className="mt-6 px-2">
          <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4">
            <ul className="space-y-1" role="menu">
              <li role="none">
                {(() => {
                  const helpBtn = (
                    <button
                      onClick={openFAQModal}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                      role="menuitem"
                    >
                      <HelpCircle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                      {isSidebarOpen && (
                        <span className="text-sm font-medium truncate">도움말</span>
                      )}
                    </button>
                  )
                  return !isSidebarOpen ? (
                    <Tooltip content="도움말" placement="right">{helpBtn}</Tooltip>
                  ) : helpBtn
                })()}
              </li>
              <li role="none">
                {(() => {
                  const settingsBtn = (
                    <button
                      onClick={openSettingsModal}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                      role="menuitem"
                    >
                      <Settings className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                      {isSidebarOpen && (
                        <span className="text-sm font-medium truncate">설정</span>
                      )}
                    </button>
                  )
                  return !isSidebarOpen ? (
                    <Tooltip content="설정" placement="right">{settingsBtn}</Tooltip>
                  ) : settingsBtn
                })()}
              </li>
            </ul>
          </div>
        </div>
      </nav>

      {/* Collapse Toggle */}
      <div className="p-2 border-t border-zinc-200 dark:border-zinc-800">
        {!isSidebarOpen ? (
          <Tooltip content="사이드바 펼치기" placement="right">
            <button
              onClick={toggleSidebar}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 min-h-[44px] rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              aria-label="사이드바 펼치기"
              aria-expanded={false}
            >
              <ChevronRight className="w-5 h-5" aria-hidden="true" />
            </button>
          </Tooltip>
        ) : (
          <button
            onClick={toggleSidebar}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 min-h-[44px] rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            aria-label="사이드바 접기"
            aria-expanded={true}
          >
            <ChevronLeft className="w-5 h-5" aria-hidden="true" />
            <span className="text-sm">접기</span>
          </button>
        )}
      </div>
    </aside>
  )
}
