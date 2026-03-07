import { useState, memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderOpen, ChevronDown, ChevronUp } from 'lucide-react'
import { useFolderStore } from '@/stores/folderStore'
import { useUIStore } from '@/stores/uiStore'
import { useMemoStats } from '@/hooks/useMemoStats'

export const FolderList = memo(function FolderList() {
  const navigate = useNavigate()
  const folders = useFolderStore((s) => s.folders)
  const setActiveFolderId = useUIStore((s) => s.setActiveFolderId)
  const { folderCounts } = useMemoStats()
  const [isCollapsed, setIsCollapsed] = useState(false)

  const userFolders = folders
    .filter((f) => !f.isSystem)
    .sort((a, b) => a.sortOrder - b.sortOrder)

  const handleFolderClick = (folderId: number) => {
    setActiveFolderId(folderId)
    navigate('/memos')
  }

  const handleEditClick = () => {
    navigate('/settings')
  }

  return (
    <div className="rounded-2xl bg-white shadow-sm dark:bg-zinc-800">
      {/* Header */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="flex w-full items-center justify-between px-5 py-3.5"
      >
        <div className="flex items-center gap-2.5">
          <FolderOpen className="h-4.5 w-4.5 text-zinc-500 dark:text-zinc-400" />
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            폴더
          </span>
          <span className="text-xs text-zinc-400 dark:text-zinc-500">
            {userFolders.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            role="button"
            tabIndex={0}
            aria-label="폴더 편집"
            onClick={(e) => {
              e.stopPropagation()
              handleEditClick()
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation()
                handleEditClick()
              }
            }}
            className="text-xs font-medium text-primary-500 hover:text-primary-600 dark:text-primary-400"
          >
            편집
          </span>
          {isCollapsed ? (
            <ChevronDown className="h-4 w-4 text-zinc-400" />
          ) : (
            <ChevronUp className="h-4 w-4 text-zinc-400" />
          )}
        </div>
      </button>

      {/* Folder items */}
      {!isCollapsed && (
        <div className="border-t border-zinc-100 dark:border-zinc-700">
          {userFolders.length === 0 ? (
            <p className="px-5 py-4 text-center text-sm text-zinc-400 dark:text-zinc-500">
              폴더가 없습니다
            </p>
          ) : (
            userFolders.map((folder) => {
              const count = folderCounts.get(folder.id!) || 0
              return (
                <button
                  key={folder.id}
                  onClick={() => handleFolderClick(folder.id!)}
                  className="flex w-full items-center gap-3 px-5 py-3 transition-colors hover:bg-zinc-50 active:bg-zinc-100 dark:hover:bg-zinc-750 dark:active:bg-zinc-700"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: folder.color }}
                  />
                  <span className="flex-1 text-left text-sm text-zinc-700 dark:text-zinc-300 truncate">
                    {folder.name}
                  </span>
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">
                    {count}
                  </span>
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
})
