import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react'
import { Fragment, useState, useEffect } from 'react'
import { useFolderStore } from '@/stores/folderStore'
import { FOLDER_COLORS } from '@/utils/constants'
import type { Folder } from '@/lib/types'

interface FolderEditModalProps {
  isOpen: boolean
  onClose: () => void
  folder: Folder | null
}

export function FolderEditModal({ isOpen, onClose, folder }: FolderEditModalProps) {
  const [name, setName] = useState('')
  const [color, setColor] = useState<string>(FOLDER_COLORS[0])
  const updateFolder = useFolderStore((s) => s.updateFolder)
  const deleteFolder = useFolderStore((s) => s.deleteFolder)

  useEffect(() => {
    if (folder) {
      setName(folder.name)
      setColor(folder.color)
    }
  }, [folder])

  const handleSave = async () => {
    if (!folder?.id || !name.trim()) return
    await updateFolder(folder.id, { name: name.trim(), color })
    onClose()
  }

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)

  const handleDelete = () => {
    if (!folder?.id || folder.isDefault || folder.isSystem) return
    setIsDeleteConfirmOpen(true)
  }

  const confirmDelete = async () => {
    if (!folder?.id) return
    await deleteFolder(folder.id)
    setIsDeleteConfirmOpen(false)
    onClose()
  }

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50">
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

        <div className="fixed inset-0 flex items-center justify-center p-4">
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <DialogPanel className="w-full max-w-sm bg-white dark:bg-zinc-800 rounded-2xl shadow-xl p-6">
              <DialogTitle className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4">
                폴더 편집
              </DialogTitle>

              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="폴더 이름"
                className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 mb-4"
                autoFocus
              />

              <div className="flex gap-2 mb-6">
                {FOLDER_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-full transition-all ${
                      color === c ? 'ring-2 ring-offset-2 ring-primary-500' : ''
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>

              <div className="flex justify-between">
                {!folder?.isDefault && !folder?.isSystem && (
                  <button
                    onClick={handleDelete}
                    className="px-4 py-2 text-sm font-medium text-danger-500 rounded-lg hover:bg-danger-50 dark:hover:bg-zinc-700"
                  >
                    삭제
                  </button>
                )}
                <div className="flex gap-2 ml-auto">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!name.trim()}
                    className="px-4 py-2 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 disabled:opacity-50"
                  >
                    저장
                  </button>
                </div>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>

        {/* Delete confirmation dialog */}
        {isDeleteConfirmOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setIsDeleteConfirmOpen(false)} />
            <div className="relative bg-white dark:bg-zinc-800 rounded-2xl shadow-xl p-6 max-w-xs w-full">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">폴더 삭제</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-5">
                &ldquo;{folder?.name}&rdquo; 폴더를 삭제하시겠습니까? 폴더 내 메모는 삭제되지 않습니다.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setIsDeleteConfirmOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700"
                >
                  취소
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-4 py-2 text-sm font-medium text-white bg-danger-500 rounded-lg hover:bg-danger-600"
                >
                  삭제
                </button>
              </div>
            </div>
          </div>
        )}
      </Dialog>
    </Transition>
  )
}
