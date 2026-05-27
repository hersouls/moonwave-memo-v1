import { useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Hash,
  HelpCircle,
  Pencil,
  Palette,
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
import { Tooltip } from '@/components/ui/Tooltip'
import { SidebarAmbientImage } from '@/components/ui/SidebarAmbientImage'
import { FOLDER_COLORS } from '@/utils/constants'

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
  const currentView = useUIStore((s) => s.currentView)
  const setCurrentView = useUIStore((s) => s.setCurrentView)
  const openSettingsModal = useUIStore((s) => s.openSettingsModal)
  const openFAQModal = useUIStore((s) => s.openFAQModal)

  const folders = useFolderStore((s) => s.folders)
  const updateFolder = useFolderStore((s) => s.updateFolder)
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

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ folderId: number; folderName: string; folderColor: string; x: number; y: number } | null>(null)
  const [editingName, setEditingName] = useState('')
  const [isRenaming, setIsRenaming] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)

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
              <span className={clsx('text-xs tabular-nums', isActive ? 'text-primary-600/70 dark:text-primary-300/70' : 'text-zinc-400 dark:text-zinc-500')}>{count}</span>
            )}
          </>
        )}
      </button>
    )

    return !isSidebarOpen ? (
      <Tooltip content={`${label}${count !== undefined ? ` (${count})` : ''}`} placement="right">{button}</Tooltip>
    ) : button
  }

  const handleContextMenu = (e: React.MouseEvent, folder: { id?: number; name: string; color: string }) => {
    if (!folder.id) return
    e.preventDefault()
    setContextMenu({ folderId: folder.id, folderName: folder.name, folderColor: folder.color, x: e.clientX, y: e.clientY })
    setEditingName(folder.name)
    setIsRenaming(false)
    setShowColorPicker(false)
  }

  const handleRename = async () => {
    if (!contextMenu || !editingName.trim()) return
    await updateFolder(contextMenu.folderId, { name: editingName.trim() })
    setContextMenu(null)
    setIsRenaming(false)
  }

  const handleColorChange = async (color: string) => {
    if (!contextMenu) return
    await updateFolder(contextMenu.folderId, { color })
    setShowColorPicker(false)
    setContextMenu(null)
  }

  const handleDeleteFolder = async () => {
    if (!contextMenu) return
    const folder = folders.find((f) => f.id === contextMenu.folderId)
    const confirmed = window.confirm(
      `"${folder?.name || '폴더'}"를 삭제하시겠습니까?\n이 폴더의 메모는 기본 폴더로 이동됩니다.`
    )
    if (!confirmed) {
      setContextMenu(null)
      return
    }
    await deleteFolder(contextMenu.folderId)
    setContextMenu(null)
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
              () => { setCurrentView('calendar'); navigate('/calendar') }
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
                onClick={() => toggleSidebar()}
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

        {/* Tags Section with frequency */}
        {isSidebarOpen && allTags.length > 0 && (
          <section className="mt-6 px-2" aria-labelledby="tags-heading">
            <h2
              id="tags-heading"
              className="px-3 mb-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider"
            >
              태그
            </h2>
            <ul className="space-y-0.5">
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
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
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
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
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

      {/* Folder Context Menu (Portal) */}
      {contextMenu && createPortal(
        <>
          <div className="fixed inset-0 z-[100]" onClick={() => setContextMenu(null)} />
          <div
            className="fixed z-[101] min-w-[160px] bg-white dark:bg-zinc-800 rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-700 py-1 animate-in fade-in duration-100"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            {isRenaming ? (
              <div className="px-3 py-2">
                <input
                  autoFocus
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setContextMenu(null) }}
                  className="w-full px-2 py-1 text-sm border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
                <div className="flex gap-1 mt-2">
                  <button onClick={handleRename} className="flex-1 px-2 py-1 text-xs bg-primary-500 text-white rounded-lg hover:bg-primary-600">확인</button>
                  <button onClick={() => setContextMenu(null)} className="flex-1 px-2 py-1 text-xs bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-600">취소</button>
                </div>
              </div>
            ) : showColorPicker ? (
              <div className="px-3 py-2">
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">색상 선택</p>
                <div className="flex flex-wrap gap-2">
                  {FOLDER_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => handleColorChange(color)}
                      className={clsx(
                        'w-6 h-6 rounded-full transition-all',
                        contextMenu.folderColor === color ? 'ring-2 ring-primary-500 scale-110' : 'ring-1 ring-zinc-200 dark:ring-zinc-600 hover:scale-110'
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <>
                <button
                  onClick={() => setIsRenaming(true)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  이름 변경
                </button>
                <button
                  onClick={() => setShowColorPicker(true)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700"
                >
                  <Palette className="w-3.5 h-3.5" />
                  색상 변경
                </button>
                <button
                  onClick={handleDeleteFolder}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-danger-500 hover:bg-danger-50 dark:hover:bg-zinc-700"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  삭제
                </button>
              </>
            )}
          </div>
        </>,
        document.body
      )}
    </aside>
  )
}
