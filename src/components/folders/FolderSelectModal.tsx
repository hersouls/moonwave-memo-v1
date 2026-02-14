import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react'
import { Fragment, useState } from 'react'
import { Check, Plus } from 'lucide-react'
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
      <Transition show={isOpen} as={Fragment}>
        <Dialog onClose={closeFolderSelect} className="relative z-50">
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/40" />
          </TransitionChild>

          <div className="fixed inset-0 flex items-end justify-center lg:items-center">
            <TransitionChild
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="translate-y-full lg:translate-y-0 lg:opacity-0 lg:scale-95"
              enterTo="translate-y-0 lg:opacity-100 lg:scale-100"
              leave="ease-in duration-200"
              leaveFrom="translate-y-0 lg:opacity-100 lg:scale-100"
              leaveTo="translate-y-full lg:translate-y-0 lg:opacity-0 lg:scale-95"
            >
              <DialogPanel className="w-full max-w-md bg-white dark:bg-zinc-800 rounded-t-2xl lg:rounded-2xl shadow-xl">
                <div className="flex justify-center pt-3 pb-1 lg:hidden">
                  <div className="w-10 h-1 bg-zinc-300 dark:bg-zinc-600 rounded-full" />
                </div>

                <DialogTitle className="text-lg font-bold text-zinc-900 dark:text-zinc-100 px-6 py-4">
                  이동할 폴더 선택
                </DialogTitle>

                <div className="pb-4">
                  {folders.map((folder) => (
                    <button
                      key={folder.id}
                      onClick={() => handleSelect(folder.id!)}
                      className="w-full flex items-center gap-3 px-6 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                    >
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: folder.color }}
                      />
                      <span className="text-zinc-800 dark:text-zinc-200 font-medium">
                        {folder.name}
                      </span>
                      {currentMemo?.folderId === folder.id && (
                        <Check className="w-5 h-5 ml-auto text-zinc-500" />
                      )}
                    </button>
                  ))}

                  <button
                    onClick={() => setIsCreateOpen(true)}
                    className="w-full flex items-center gap-3 px-6 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors text-zinc-500 dark:text-zinc-400"
                  >
                    <Plus className="w-3 h-3" />
                    <span>새 폴더</span>
                  </button>
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </Dialog>
      </Transition>

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
