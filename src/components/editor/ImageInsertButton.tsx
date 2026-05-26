import { useRef, useState } from 'react'
import { ImagePlus } from 'lucide-react'
import { compressImage } from '@/utils/imageCompression'
import { addMemoImage } from '@/services/database'
import { generateSyncId } from '@/utils/id'
import { nowISO } from '@/lib/dateUtils'
import { useToastStore } from '@/stores/toastStore'

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
      useToastStore.getState().showToast('\uC774\uBBF8\uC9C0 \uD30C\uC77C\uB9CC \uC120\uD0DD\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4', 'warning')
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
      useToastStore.getState().showToast('\uC774\uBBF8\uC9C0\uAC00 \uCD94\uAC00\uB418\uC5C8\uC2B5\uB2C8\uB2E4', 'success')
    } catch (err) {
      console.error('Failed to insert image:', err)
      useToastStore.getState().showToast('\uC774\uBBF8\uC9C0 \uCD94\uAC00\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4', 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <>
      <button
        onClick={handleClick}
        disabled={isProcessing || !memoId}
        className="inline-flex items-center justify-center size-9 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 transition-[background-color,color,transform] duration-150 active:scale-[0.94] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 disabled:opacity-30 disabled:pointer-events-none"
        title={'\uC774\uBBF8\uC9C0 \uC0BD\uC785'}
        aria-label={'\uC774\uBBF8\uC9C0 \uC0BD\uC785'}
      >
        <ImagePlus className="w-[18px] h-[18px]" />
      </button>
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
