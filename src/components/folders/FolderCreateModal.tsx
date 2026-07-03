import { useEffect, useState } from 'react'
import { Dialog, DialogHeader, DialogBody, DialogFooter } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { ColorSwatchPicker } from './ColorSwatchPicker'
import { useFolderStore } from '@/stores/folderStore'
import { FOLDER_COLORS } from '@/utils/constants'

interface FolderCreateModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated?: (folderId: number) => void
}

export function FolderCreateModal({ isOpen, onClose, onCreated }: FolderCreateModalProps) {
  const [name, setName] = useState('')
  const [color, setColor] = useState<string>(FOLDER_COLORS[0])
  const addFolder = useFolderStore((s) => s.addFolder)

  // 열릴 때마다 입력 상태 초기화
  useEffect(() => {
    if (isOpen) {
      setName('')
      setColor(FOLDER_COLORS[0])
    }
  }, [isOpen])

  const handleCreate = async () => {
    if (!name.trim()) return
    const id = await addFolder(name.trim(), color)
    if (id && onCreated) {
      onCreated(id)
    } else {
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onClose={onClose} size="sm">
      <DialogHeader title="새 폴더" onClose={onClose} />

      <DialogBody>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="폴더 이름"
          className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 mb-4"
          autoFocus
          data-autofocus
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
        />

        <ColorSwatchPicker value={color} onChange={setColor} />
      </DialogBody>

      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>
          취소
        </Button>
        <Button variant="primary" onClick={handleCreate} disabled={!name.trim()}>
          만들기
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
