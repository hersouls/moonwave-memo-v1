import { useMemo } from 'react'
import { createPortal } from 'react-dom'
import type { Memo } from '@/lib/types'
import { formatMemoDate } from '@/utils/format'
import { stripMarkdown, maskSensitiveData } from '@/utils/textUtils'
import { useFolderStore } from '@/stores/folderStore'

interface MemoHoverPreviewProps {
  memo: Memo
  anchorRect: DOMRect
}

export function MemoHoverPreview({ memo, anchorRect }: MemoHoverPreviewProps) {
  const folder = useFolderStore((s) =>
    memo.folderId != null ? s.folders.find((f) => f.id === memo.folderId) ?? null : null
  )

  const bodyText = useMemo(() =>
    stripMarkdown(maskSensitiveData(memo.body.replace(/!\[.*?\]\(memo-image:\d+\)/g, '[이미지]'))).slice(0, 200),
    [memo.body]
  )

  // Position: right of card, flip left if near edge
  const previewWidth = 320
  const gap = 8
  let left = anchorRect.right + gap
  let top = anchorRect.top

  if (left + previewWidth > window.innerWidth - 16) {
    left = anchorRect.left - previewWidth - gap
  }

  const maxTop = window.innerHeight - 280
  if (top > maxTop) top = maxTop
  if (top < 8) top = 8

  return createPortal(
    <div
      className="fixed z-[60] w-80 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-700 p-4 bg-white dark:bg-zinc-800 animate-in fade-in-0 zoom-in-95 duration-150 pointer-events-none"
      style={{ left, top }}
    >
      <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 mb-2 line-clamp-2">
        {memo.title || '제목 없음'}
      </h4>

      {bodyText && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed mb-3 line-clamp-6">
          {bodyText}
        </p>
      )}

      {memo.tags && memo.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {memo.tags.slice(0, 5).map((tag) => (
            <span key={tag} className="px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-primary-50 text-primary-600 dark:bg-primary-900/50 dark:text-primary-400">
              #{tag}
            </span>
          ))}
          {memo.tags.length > 5 && (
            <span className="text-[10px] text-zinc-400">+{memo.tags.length - 5}</span>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 text-[11px] text-zinc-400 dark:text-zinc-500">
        {folder && <span className="truncate max-w-[80px]">{folder.name}</span>}
        {folder && <span>·</span>}
        <span>{formatMemoDate(memo.updatedAt)}</span>
        {memo.body.length > 0 && (
          <>
            <span>·</span>
            <span>{memo.body.length}자</span>
          </>
        )}
      </div>
    </div>,
    document.body
  )
}
