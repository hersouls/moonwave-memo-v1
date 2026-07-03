import { useState, useEffect } from 'react'
import { Dialog, DialogHeader, DialogBody, DialogFooter } from '@/components/ui/Dialog'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Button } from '@/components/ui/Button'
import { ColorSwatchPicker } from './ColorSwatchPicker'
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
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
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
    <>
      <Dialog open={isOpen} onClose={onClose} size="sm">
        <DialogHeader title="폴더 편집" onClose={onClose} />

        <DialogBody>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="폴더 이름"
            className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 mb-4"
            autoFocus
            data-autofocus
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />

          <ColorSwatchPicker value={color} onChange={setColor} />
        </DialogBody>

        <DialogFooter>
          {!folder?.isDefault && !folder?.isSystem && (
            <button
              onClick={handleDelete}
              className="h-11 px-4 text-sm font-medium rounded-xl text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/20 active:bg-danger-100 dark:active:bg-danger-900/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-500 sm:mr-auto"
            >
              삭제
            </button>
          )}
          <Button variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={!name.trim()}>
            저장
          </Button>
        </DialogFooter>
      </Dialog>

      {/* 폴더 삭제 확인 — 공유 ConfirmDialog 사용 */}
      <ConfirmDialog
        open={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={confirmDelete}
        title="폴더 삭제"
        description={`"${folder?.name ?? ''}" 폴더를 삭제하시겠습니까?\n폴더 내 메모는 삭제되지 않습니다.`}
        confirmText="삭제"
        cancelText="취소"
        variant="danger"
      />
    </>
  )
}
