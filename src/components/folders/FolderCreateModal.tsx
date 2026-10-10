import { useEffect, useState } from 'react'
import { Dialog, DialogHeader, DialogBody, DialogFooter } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { ColorSwatchPicker } from './ColorSwatchPicker'
import { useFolderStore } from '@/stores/folderStore'
import { FOLDER_COLORS } from '@/utils/constants'
import { TextField } from '@/mw/TextField'

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
        <TextField
          label="폴더 이름"
          value={name}
          onChange={(e) => setName(e.target.value)}
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
