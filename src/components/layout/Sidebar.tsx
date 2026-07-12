import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Hash,
  HelpCircle,
  MoreHorizontal,
  Pencil,
  Settings,
  Star,
  StickyNote,
  Trash2,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useUIStore } from '@/stores/uiStore'
import { useFolderStore } from '@/stores/folderStore'
import { useMemoStore } from '@/stores/memoStore'
import { useMemoStats } from '@/hooks/useMemoStats'
import { useToastStore } from '@/stores/toastStore'
import { useViewTransition } from '@/hooks/useViewTransition'
import { Tooltip } from '@/components/ui/Tooltip'
import { ContextMenu } from '@/components/ui/ContextMenu'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { FolderEditModal } from '@/components/folders/FolderEditModal'
import { SidebarAmbientImage } from '@/components/ui/SidebarAmbientImage'
import type { Folder } from '@/lib/types'

/** 메모 개수 배지 — 사이드바 확장 행/모바일 내비 공용 (tabular-nums, 2자리 최소 폭) */
export function CountBadge({ count, className }: { count: number; className?: string }) {
  return (
    <span
      className={clsx(
        'inline-flex min-w-[1.625rem] items-center justify-center rounded-full px-1.5 py-0.5',
        'bg-[var(--color-bg-tertiary)] text-[11px] leading-none tabular-nums text-zinc-500 dark:text-zinc-400',
        className
      )}
    >
      {count > 999 ? '999+' : count}
    </span>
  )
}

export function Sidebar() {
  const { navigateWithTransition } = useViewTransition()
  const isSidebarOpenStore = useUIStore((s) => s.isSidebarOpen)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const isTablet = useUIStore((s) => s.isTablet)
  const tabletSidebarOpen = useUIStore((s) => s.tabletSidebarOpen)
  const toggleTabletSidebar = useUIStore((s) => s.toggleTabletSidebar)
  const isFocusMode = useUIStore((s) => s.isFocusMode)
  // Tablet (768–1023) shows a collapsible rail with its own non-persisted state,
  // defaulting to collapsed; desktop keeps the persisted expand/collapse preference.
  const isSidebarOpen = isTablet ? tabletSidebarOpen : isSidebarOpenStore
  const handleToggleSidebar = isTablet ? toggleTabletSidebar : toggleSidebar
  const activeFolderId = useUIStore((s) => s.activeFolderId)
  const setActiveFolderId = useUIStore((s) => s.setActiveFolderId)
  const activeFilter = useUIStore((s) => s.activeFilter)
  const setActiveFilter = useUIStore((s) => s.setActiveFilter)
  const activeTag = useUIStore((s) => s.activeTag)
  const setActiveTag = useUIStore((s) => s.setActiveTag)
  const isTagsSectionOpen = useUIStore((s) => s.isTagsSectionOpen)
  const toggleTagsSection = useUIStore((s) => s.toggleTagsSection)
  const setTagsSectionOpen = useUIStore((s) => s.setTagsSectionOpen)
  const currentView = useUIStore((s) => s.currentView)
  const setCurrentView = useUIStore((s) => s.setCurrentView)
  const openSettingsModal = useUIStore((s) => s.openSettingsModal)
  const openFAQModal = useUIStore((s) => s.openFAQModal)

  const folders = useFolderStore((s) => s.folders)
  const deleteFolder = useFolderStore((s) => s.deleteFolder)

  // P-09: Use shared useMemoStats hook instead of duplicate calculations
  const { totalCount, starredCount, deletedCount: trashedCount, folderCounts, allTags, tagCounts } = useMemoStats()

  const userFolders = folders.filter((f) => !f.isSystem)
  const trashFolder = folders.find((f) => f.isSystem)

  const moveToFolder = useMemoStore((s) => s.moveToFolder)

  // Drag & drop state
  const [dragOverFolderId, setDragOverFolderId] = useState<number | null>(null)

  const handleFolderDragOver = useCallback((e: React.DragEvent, folderId: number) => {
    if (!e.dataTransfer.types.includes('application/memo-id')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverFolderId(folderId)
  }, [])

  const handleFolderDragLeave = useCallback(() => {
    setDragOverFolderId(null)
  }, [])

  const handleFolderDrop = useCallback(async (e: React.DragEvent, folderId: number) => {
    e.preventDefault()
    setDragOverFolderId(null)
    const memoIdStr = e.dataTransfer.getData('application/memo-id')
    if (!memoIdStr) return
    const memoId = Number(memoIdStr)
    if (!Number.isFinite(memoId)) return
    try {
      await moveToFolder(memoId, folderId)
      const currentFolders = useFolderStore.getState().folders
      const folder = currentFolders.find((f) => f.id === folderId)
      useToastStore.getState().showToast(`"${folder?.name ?? '폴더'}"로 이동했습니다`, 'success')
    } catch {
      useToastStore.getState().showToast('메모 이동에 실패했습니다', 'error')
    }
  }, [moveToFolder])

  // 폴더 관리: 케밥/우클릭 공용 ContextMenu + 편집 모달 + 삭제 확인 다이얼로그
  const [folderMenu, setFolderMenu] = useState<{ folder: Folder; x: number; y: number } | null>(null)
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null)
  const [deletingFolder, setDeletingFolder] = useState<Folder | null>(null)

  const handleViewChange = () => {
    setCurrentView('memos')
    navigateWithTransition('/memos')
  }

  // 로고 클릭도 View Transition을 타도록 (수정키/휠클릭은 브라우저 기본 동작 유지)
  const handleLogoClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    e.preventDefault()
    navigateWithTransition('/')
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
          'w-full flex items-center gap-3 py-2.5 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
          // 접힌 rail에서는 아이콘을 중앙 정렬 (px-3 좌우 비대칭 방지)
          isSidebarOpen ? 'px-3' : 'justify-center px-0',
          isActive
            ? (activeStyle || 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300')
            : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
        )}
        aria-current={isActive ? 'page' : undefined}
      >
        <span className="relative flex-shrink-0">
          {icon}
          {/* Collapsed state badge */}
          {!isSidebarOpen && count !== undefined && count > 0 && (
            <span className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] flex items-center justify-center rounded-full bg-primary-500 text-[9px] font-bold text-white px-0.5 leading-none">
              {count > 99 ? '99+' : count}
            </span>
          )}
        </span>
        {isSidebarOpen && (
          <>
            <span className={clsx('text-sm truncate flex-1 text-left', isActive ? 'font-semibold' : 'font-medium')}>{label}</span>
            {count !== undefined && (
              // 폴더 행(group)에서는 호버/포커스 시 케밥 버튼에 자리를 내준다
              <CountBadge count={count} className="transition-opacity group-hover:opacity-0 group-focus-within:opacity-0" />
            )}
          </>
        )}
      </button>
    )

    return !isSidebarOpen ? (
      <Tooltip content={`${label}${count !== undefined ? ` (${count})` : ''}`} placement="right">{button}</Tooltip>
    ) : button
  }

  const handleContextMenu = (e: React.MouseEvent, folder: Folder) => {
    if (!folder.id) return
    e.preventDefault()
    setFolderMenu({ folder, x: e.clientX, y: e.clientY })
  }

  const handleDeleteFolder = async () => {
    if (!deletingFolder?.id) return
    await deleteFolder(deletingFolder.id)
    setDeletingFolder(null)
  }

  return (
    <aside
      inert={isFocusMode || undefined}
      className={clsx(
        'hidden md:flex flex-col fixed h-screen bg-[var(--color-bg-secondary)] border-r border-zinc-200 dark:border-zinc-800 z-40',
        // 콘텐츠 마진(App)과 동일한 300ms/spring 커브 — 접기/포커스 모드 desync 방지
        'transition-[width,transform,opacity] duration-300 ease-spring',
        isSidebarOpen ? 'w-64' : 'w-16',
        isFocusMode && '-translate-x-full opacity-0 pointer-events-none'
      )}
      role="complementary"
      aria-label="사이드 네비게이션"
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-zinc-200 dark:border-zinc-800">
        <Link
          to="/"
          onClick={handleLogoClick}
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
        <ul className="space-y-1 px-2">
          {/* All Memos */}
          <li>
            {navButton(
              '모든 메모',
              <StickyNote className="w-5 h-5" aria-hidden="true" />,
              activeFilter === 'all' && !activeFolderId && !activeTag,
              () => { setActiveFilter('all'); handleViewChange() },
              totalCount
            )}
          </li>

          {/* Starred */}
          <li>
            {navButton(
              '중요 메모',
              <Star className="w-5 h-5" aria-hidden="true" />,
              activeFilter === 'starred',
              () => { setActiveFilter('starred'); handleViewChange() },
              starredCount
            )}
          </li>

          {/* Calendar */}
          <li>
            {navButton(
              '캘린더',
              <Calendar className="w-5 h-5" aria-hidden="true" />,
              currentView === 'calendar',
              () => { setCurrentView('calendar'); navigateWithTransition('/calendar') }
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
            <ul className="space-y-0.5">
              {userFolders.map((folder) => {
                const count = folderCounts.get(folder.id!) || 0
                return (
                  <li
                    key={folder.id}
                    className={clsx(
                      'group relative',
                      count === 0 && activeFolderId !== folder.id && 'opacity-50',
                      dragOverFolderId === folder.id && 'ring-2 ring-primary-500 rounded-lg bg-primary-50 dark:bg-primary-900/20'
                    )}
                    onContextMenu={(e) => handleContextMenu(e, folder)}
                    onDragOver={(e) => handleFolderDragOver(e, folder.id!)}
                    onDragLeave={handleFolderDragLeave}
                    onDrop={(e) => handleFolderDrop(e, folder.id!)}
                  >
                    {navButton(
                      folder.name,
                      <span
                        className="block w-3 h-3 rounded-full"
                        style={{ backgroundColor: folder.color }}
                        aria-hidden="true"
                      />,
                      activeFolderId === folder.id,
                      () => { setActiveFolderId(folder.id!); handleViewChange() },
                      count
                    )}
                    {/* 폴더 관리 케밥 — 호버/키보드 포커스 시 노출 (우클릭은 단축 경로) */}
                    {isSidebarOpen && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          const rect = e.currentTarget.getBoundingClientRect()
                          setFolderMenu({ folder, x: rect.left, y: rect.bottom + 4 })
                        }}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 dark:text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-zinc-200/70 dark:hover:bg-zinc-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                        aria-label={`${folder.name} 폴더 관리`}
                        aria-haspopup="menu"
                      >
                        <MoreHorizontal className="w-4 h-4" aria-hidden="true" />
                      </button>
                    )}
                  </li>
                )
              })}

              {/* Trash */}
              {trashFolder && (
                <li>
                  {navButton(
                    trashFolder.name,
                    <Trash2 className="w-5 h-5" aria-hidden="true" />,
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

        {/* TECH-03: Collapsed tags icon with badge */}
        {!isSidebarOpen && allTags.length > 0 && (
          <div className="mt-6 px-2">
            <Tooltip content={`태그 (${allTags.length})`} placement="right">
              <button
                onClick={() => { setTagsSectionOpen(true); handleToggleSidebar() }}
                className="w-full flex items-center justify-center px-3 py-2.5 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors relative"
                aria-label="태그 목록 보기"
              >
                <Hash className="w-5 h-5" aria-hidden="true" />
                {allTags.length > 0 && (
                  <span className="absolute -top-0.5 right-1 min-w-[16px] h-[16px] flex items-center justify-center rounded-full bg-primary-500 text-[9px] font-bold text-white px-0.5 leading-none">
                    {allTags.length > 99 ? '99+' : allTags.length}
                  </span>
                )}
              </button>
            </Tooltip>
          </div>
        )}

        {/* Tags Section with frequency — 목록이 길어 기본 접힘, 토글로 펼침 */}
        {isSidebarOpen && allTags.length > 0 && (
          <section className="mt-6 px-2" aria-labelledby="tags-heading">
            <h2 id="tags-heading" className="mb-2">
              <button
                type="button"
                onClick={toggleTagsSection}
                aria-expanded={isTagsSectionOpen}
                aria-controls="sidebar-tags-list"
                className="w-full flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                <span>태그</span>
                <span className="font-normal tabular-nums normal-case">({allTags.length})</span>
                <ChevronDown
                  className={clsx(
                    'w-3.5 h-3.5 ml-auto transition-transform duration-200',
                    isTagsSectionOpen && 'rotate-180'
                  )}
                  aria-hidden="true"
                />
              </button>
            </h2>
            {isTagsSectionOpen && (
              <ul id="sidebar-tags-list" className="space-y-0.5">
                {allTags.map((tag) => {
                  const count = tagCounts.get(tag) || 0
                  return (
                    <li key={tag}>
                      {navButton(
                        tag,
                        <Hash className={clsx(
                          'w-4 h-4',
                          count >= 10 ? 'text-primary-500' : count >= 5 ? 'text-primary-400' : 'text-zinc-400'
                        )} aria-hidden="true" />,
                        activeTag === tag,
                        () => { setActiveTag(tag); handleViewChange() },
                        count
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        )}

        {/* Ambient Image — sidebar bottom */}
        {isSidebarOpen && <SidebarAmbientImage />}

        {/* Help & Settings */}
        <div className="mt-6 px-2">
          <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4">
            <ul className="space-y-1">
              <li>
                {(() => {
                  const helpBtn = (
                    <button
                      onClick={openFAQModal}
                      className={clsx(
                        'w-full flex items-center gap-3 py-2.5 rounded-lg transition-colors text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
                        isSidebarOpen ? 'px-3' : 'justify-center px-0'
                      )}
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
              <li>
                {(() => {
                  const settingsBtn = (
                    <button
                      onClick={openSettingsModal}
                      className={clsx(
                        'w-full flex items-center gap-3 py-2.5 rounded-lg transition-colors text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
                        isSidebarOpen ? 'px-3' : 'justify-center px-0'
                      )}
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
              onClick={handleToggleSidebar}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 min-h-[44px] rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              aria-label="사이드바 펼치기"
              aria-expanded={false}
            >
              <ChevronRight className="w-5 h-5" aria-hidden="true" />
            </button>
          </Tooltip>
        ) : (
          <button
            onClick={handleToggleSidebar}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 min-h-[44px] rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            aria-label="사이드바 접기"
            aria-expanded={true}
          >
            <ChevronLeft className="w-5 h-5" aria-hidden="true" />
            <span className="text-sm">접기</span>
          </button>
        )}
      </div>

      {/* 폴더 관리 메뉴 — 키보드 접근 가능한 공용 ContextMenu 프리미티브 (뷰포트 클램핑 내장) */}
      {folderMenu && (
        <ContextMenu
          position={{ x: folderMenu.x, y: folderMenu.y }}
          items={[
            { label: '폴더 편집', icon: Pencil, onSelect: () => setEditingFolder(folderMenu.folder) },
            'divider',
            { label: '삭제', icon: Trash2, danger: true, onSelect: () => setDeletingFolder(folderMenu.folder) },
          ]}
          onClose={() => setFolderMenu(null)}
        />
      )}

      {/* 이름·색상 편집 — 기존 폴더 편집 모달 재사용 */}
      <FolderEditModal
        isOpen={editingFolder != null}
        onClose={() => setEditingFolder(null)}
        folder={editingFolder}
      />

      {/* 삭제 확인 — window.confirm 대체 */}
      <ConfirmDialog
        open={deletingFolder != null}
        onClose={() => setDeletingFolder(null)}
        onConfirm={handleDeleteFolder}
        title="폴더 삭제"
        description={`"${deletingFolder?.name ?? ''}" 폴더를 삭제하시겠습니까?\n이 폴더의 메모는 기본 폴더로 이동됩니다.`}
        variant="danger"
        confirmText="삭제"
      />
    </aside>
  )
}
