import { memo } from 'react'
import { useFolderStore } from '@/stores/folderStore'
import { useUIStore } from '@/stores/uiStore'
import { useMemoStats } from '@/hooks/useMemoStats'
import { useViewTransition } from '@/hooks/useViewTransition'
import { WidgetCard } from './WidgetCard'
import { IcLineFolder } from '@/mw/icons'
import { Link } from 'react-router-dom'

export const FolderList = memo(function FolderList() {
  const { navigateWithTransition } = useViewTransition()
  const folders = useFolderStore((s) => s.folders)
  const setActiveFolderId = useUIStore((s) => s.setActiveFolderId)
  const { folderCounts } = useMemoStats()

  const userFolders = folders
    .filter((f) => !f.isSystem)
    .sort((a, b) => a.sortOrder - b.sortOrder)

  const handleFolderClick = (folderId: number) => {
    setActiveFolderId(folderId)
    navigateWithTransition('/memos')
  }

  const handleEditClick = () => {
    navigateWithTransition('/settings')
  }

  return (
    <WidgetCard
      icon={IcLineFolder}
      title="폴더"
      meta={userFolders.length}
      collapsible
      action={
        <button
          type="button"
          onClick={handleEditClick}
          aria-label="폴더 편집"
          className="mw-text-button mw-text-button--ghost mw-text-button--medium mw-text-button--default"
        >
          <span>편집</span>
        </button>
      }
      bodyClassName="p-0"
    >
      {userFolders.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-5 py-6 text-center">
          <IcLineFolder size={20} className="text-zinc-400" aria-hidden="true" />
          <p className="text-sm text-zinc-500 dark:text-zinc-400">폴더가 없습니다</p>
          <button
            type="button"
            onClick={handleEditClick}
            className="mw-text-button mw-text-button--underline mw-text-button--medium mw-text-button--default"
          >
            <span>폴더 만들기</span>
          </button>
        </div>
      ) : (
        userFolders.map((folder) => {
          const count = folderCounts.get(folder.id!) || 0
          return (
            <Link
              key={folder.id}
              to="/memos"
              onClick={(e) => { e.preventDefault(); handleFolderClick(folder.id!) }}
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
            </Link>
          )
        })
      )}
    </WidgetCard>
  )
})
