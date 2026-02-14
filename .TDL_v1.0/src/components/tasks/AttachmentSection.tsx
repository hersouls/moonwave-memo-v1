import { useEffect, useRef, useState } from 'react'
import { Paperclip, Plus, X, FileText, Image as ImageIcon } from 'lucide-react'
import { useAttachmentStore } from '@/stores/attachmentStore'
import type { Attachment } from '@/lib/types'

interface AttachmentSectionProps {
  taskId: number
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

function AttachmentItem({ attachment, onDelete }: { attachment: Attachment; onDelete: () => void }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    if (attachment.thumbnailData) {
      const url = URL.createObjectURL(attachment.thumbnailData)
      setPreviewUrl(url)
      return () => URL.revokeObjectURL(url)
    } else if (attachment.mimeType.startsWith('image/')) {
      const url = URL.createObjectURL(attachment.data)
      setPreviewUrl(url)
      return () => URL.revokeObjectURL(url)
    }
  }, [attachment])

  const isImage = attachment.mimeType.startsWith('image/')

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 group">
      {/* Preview/Icon */}
      {previewUrl ? (
        <img src={previewUrl} alt={attachment.filename} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
      ) : (
        <div className="w-10 h-10 rounded-lg bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center flex-shrink-0">
          {isImage ? (
            <ImageIcon className="w-5 h-5 text-zinc-400" />
          ) : (
            <FileText className="w-5 h-5 text-zinc-400" />
          )}
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate">
          {attachment.filename}
        </p>
        <p className="text-[10px] text-zinc-400">{formatFileSize(attachment.size)}</p>
      </div>

      {/* Delete */}
      <button
        type="button"
        onClick={onDelete}
        className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400 hover:text-red-500 hover:bg-zinc-200 dark:hover:bg-zinc-700"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

export function AttachmentSection({ taskId }: AttachmentSectionProps) {
  const attachments = useAttachmentStore((s) => s.attachments[taskId] || [])
  const loadAttachments = useAttachmentStore((s) => s.loadAttachments)
  const addAttachment = useAttachmentStore((s) => s.addAttachment)
  const deleteAttachment = useAttachmentStore((s) => s.deleteAttachment)
  const error = useAttachmentStore((s) => s.error)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadAttachments(taskId)
  }, [taskId, loadAttachments])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    for (const file of Array.from(files)) {
      await addAttachment(taskId, file)
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="py-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400">
          <Paperclip className="w-4 h-4" />
          <span>첨부 파일</span>
          {attachments.length > 0 && (
            <span className="text-xs text-zinc-400">{attachments.length}/5</span>
          )}
        </div>
        {attachments.length < 5 && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 text-sm text-primary-500 hover:text-primary-600"
          >
            <Plus className="w-3.5 h-3.5" />
            추가
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf,text/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      {error && (
        <p className="text-xs text-red-500 mb-2">{error}</p>
      )}

      {attachments.length > 0 && (
        <div className="space-y-1.5 mt-2">
          {attachments.map((att) => (
            <AttachmentItem
              key={att.id}
              attachment={att}
              onDelete={() => deleteAttachment(att.id!, taskId)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
