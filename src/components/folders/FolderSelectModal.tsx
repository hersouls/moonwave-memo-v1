import { useState } from 'react'
import { Dialog, DialogHeader, DialogBody } from '@/components/ui/Dialog'
import { useFolderStore } from '@/stores/folderStore'
import { useMemoStore } from '@/stores/memoStore'
import { useUIStore } from '@/stores/uiStore'
import { FolderCreateModal } from './FolderCreateModal'
import { IcLineAdd, IcLineCheck } from '@/mw/icons'

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
              <button type="button"
                key={folder.id}
                onClick={() => handleSelect(folder.id!)}
                aria-current={isCurrent ? 'true' : undefined}
                className="mw-sheet__item w-full"
              >
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: folder.color }}
                  aria-hidden="true"
                />
                <span className="text-zinc-800 dark:text-zinc-200 font-medium truncate">
                  {folder.name}
                </span>
                {isCurrent && <IcLineCheck size={20} className="ml-auto shrink-0 text-primary-500" />}
              </button>
            )
          })}

          <button type="button"
            onClick={() => setIsCreateOpen(true)}
            className="mw-sheet__item w-full"
          >
            <IcLineAdd size={16} className="flex-shrink-0" />
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
