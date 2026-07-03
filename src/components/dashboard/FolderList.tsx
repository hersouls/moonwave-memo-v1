import { memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderOpen } from 'lucide-react'
import { useFolderStore } from '@/stores/folderStore'
import { useUIStore } from '@/stores/uiStore'
import { useMemoStats } from '@/hooks/useMemoStats'
import { WidgetCard } from './WidgetCard'

export const FolderList = memo(function FolderList() {
  const navigate = useNavigate()
  const folders = useFolderStore((s) => s.folders)
  const setActiveFolderId = useUIStore((s) => s.setActiveFolderId)
  const { folderCounts } = useMemoStats()

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
    <WidgetCard
      icon={FolderOpen}
      title="폴더"
      meta={userFolders.length}
      collapsible
      action={
        <button
          type="button"
          onClick={handleEditClick}
          aria-label="폴더 편집"
          className="rounded-md px-2 py-1.5 text-xs font-medium text-primary-600 transition-colors hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-900/20"
        >
          편집
        </button>
      }
      bodyClassName="p-0"
    >
      {userFolders.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-5 py-6 text-center">
          <FolderOpen className="h-5 w-5 text-zinc-400" aria-hidden="true" />
          <p className="text-sm text-zinc-500 dark:text-zinc-400">폴더가 없습니다</p>
          <button
            type="button"
            onClick={handleEditClick}
            className="text-xs font-medium text-primary-600 hover:underline dark:text-primary-400"
          >
            폴더 만들기
          </button>
        </div>
      ) : (
        userFolders.map((folder) => {
          const count = folderCounts.get(folder.id!) || 0
          return (
            <button
              key={folder.id}
              onClick={() => handleFolderClick(folder.id!)}
              className="list-item list-item--button flex w-full items-center gap-3"
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: folder.color }}
              />
              <span className="flex-1 text-left text-sm text-zinc-700 dark:text-zinc-300 truncate">
                {folder.name}
              </span>
              <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                {count}
              </span>
            </button>
          )
        })
      )}
    </WidgetCard>
  )
})
