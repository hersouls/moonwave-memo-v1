import { useRef, useState } from 'react'
import { Tooltip } from '@/components/ui/Tooltip'
import { compressImage } from '@/utils/imageCompression'
import { addMemoImage } from '@/services/database'
import { generateSyncId } from '@/utils/id'
import { nowISO } from '@/lib/dateUtils'
import { useToastStore } from '@/stores/toastStore'
import { IcLineGallery } from '@/mw/icons'

interface ImageInsertButtonProps {
  onInsert: (markdown: string) => void
  memoId?: number
}

export function ImageInsertButton({ onInsert, memoId }: ImageInsertButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const handleClick = () => {
    inputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !memoId) return

    // Reset input so same file can be selected again
    e.target.value = ''

    if (!file.type.startsWith('image/')) {
      useToastStore.getState().showToast('이미지 파일만 고를 수 있어요', 'warning')
      return
    }

    setIsProcessing(true)
    try {
      const compressed = await compressImage(file, 1024, 0.75)

      const imageId = await addMemoImage({
        memoId,
        syncId: generateSyncId(),
        data: compressed.dataUrl,
        filename: file.name,
        width: compressed.width,
        height: compressed.height,
        size: compressed.originalSize,
        createdAt: nowISO(),
      })

      const markdown = `![\uC774\uBBF8\uC9C0](memo-image:${imageId})`
      onInsert(markdown)
      useToastStore.getState().showToast('이미지를 추가했어요', 'success')
    } catch (err) {
      console.error('Failed to insert image:', err)
      useToastStore.getState().showToast('이미지를 추가하지 못했어요. 다시 시도해 주세요', 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <>
      <Tooltip content="\uC774\uBBF8\uC9C0 \uC0BD\uC785">
        <button type="button"
          onClick={handleClick}
          disabled={isProcessing || !memoId}
          className="mw-icon-button"
          aria-label="\uC774\uBBF8\uC9C0 \uC0BD\uC785"
        >
          <IcLineGallery className="w-[18px] h-[18px]" />
        </button>
      </Tooltip>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        aria-hidden="true"
      />
    </>
  )
}
