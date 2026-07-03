import { useState } from 'react'
import { Check, Plus } from 'lucide-react'
import clsx from 'clsx'
import { Dialog, DialogHeader, DialogBody } from '@/components/ui/Dialog'
import { useFolderStore } from '@/stores/folderStore'
import { useMemoStore } from '@/stores/memoStore'
import { useUIStore } from '@/stores/uiStore'
import { FolderCreateModal } from './FolderCreateModal'

export function FolderSelectModal() {
  const isOpen = useUIStore((s) => s.isFolderSelectOpen)
  const memoId = useUIStore((s) => s.isFolderSelectMemoId)
  const closeFolderSelect = useUIStore((s) => s.closeFolderSelect)
  const folders = useFolderStore((s) => s.folders).filter((f) => !f.isSystem)
  const memos = useMemoStore((s) => s.memos)
  const moveToFolder = useMemoStore((s) => s.moveToFolder)
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  const currentMemo = memos.find((m) => m.id === memoId)

  const handleSelect = async (folderId: number) => {
    if (memoId) {
      await moveToFolder(memoId, folderId)
    }
    closeFolderSelect()
  }

  return (
    <>
      <Dialog open={isOpen} onClose={closeFolderSelect} size="md">
        <DialogHeader title="이동할 폴더 선택" onClose={closeFolderSelect} />

        <DialogBody className="-mx-2 max-h-[min(55vh,420px)] overflow-y-auto overscroll-contain scrollbar-thin">
          {folders.map((folder) => {
            const isCurrent = currentMemo?.folderId === folder.id
            return (
              <button
                key={folder.id}
                onClick={() => handleSelect(folder.id!)}
                aria-current={isCurrent ? 'true' : undefined}
                className={clsx(
                  'w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-colors',
                  'hover:bg-zinc-50 dark:hover:bg-zinc-800 active:bg-zinc-100 dark:active:bg-zinc-700',
                  'focus:outline-none focus-visible:bg-zinc-50 dark:focus-visible:bg-zinc-800',
                  isCurrent && 'bg-primary-50/50 dark:bg-primary-900/10'
                )}
              >
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: folder.color }}
                  aria-hidden="true"
                />
                <span className="text-zinc-800 dark:text-zinc-200 font-medium truncate">
                  {folder.name}
                </span>
                {isCurrent && <Check className="w-5 h-5 ml-auto shrink-0 text-primary-500" />}
              </button>
            )
          })}

          <button
            onClick={() => setIsCreateOpen(true)}
            className={clsx(
              'w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-colors',
              'text-zinc-500 dark:text-zinc-400',
              'hover:bg-zinc-50 dark:hover:bg-zinc-800 active:bg-zinc-100 dark:active:bg-zinc-700',
              'focus:outline-none focus-visible:bg-zinc-50 dark:focus-visible:bg-zinc-800'
            )}
          >
            <Plus className="w-4 h-4 flex-shrink-0" />
            <span>새 폴더</span>
          </button>
        </DialogBody>
      </Dialog>

      <FolderCreateModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={(folderId) => {
          setIsCreateOpen(false)
          handleSelect(folderId)
        }}
      />
    </>
  )
}
