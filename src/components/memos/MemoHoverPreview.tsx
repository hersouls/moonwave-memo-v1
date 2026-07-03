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
      className="fixed z-[var(--z-tooltip)] w-80 rounded-xl shadow-lg border border-[var(--card-hairline)] p-4 bg-[var(--color-bg-elevated)] animate-in fade-in-0 zoom-in-95 duration-150 pointer-events-none"
      style={{ left, top }}
    >
      <h4 className="font-semibold tracking-[-0.01em] text-sm text-zinc-900 dark:text-zinc-100 mb-2 line-clamp-2">
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
            <span key={tag} className="px-1.5 py-0.5 text-[11px] font-medium rounded-full bg-primary-50 text-primary-600 dark:bg-primary-900/50 dark:text-primary-400">
              #{tag}
            </span>
          ))}
          {memo.tags.length > 5 && (
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400">+{memo.tags.length - 5}</span>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 text-[11px] tracking-[0.01em] tabular-nums text-zinc-500 dark:text-zinc-400">
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
