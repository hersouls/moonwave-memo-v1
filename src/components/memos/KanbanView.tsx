import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Folder as FolderIcon, Inbox } from 'lucide-react'
import clsx from 'clsx'
import type { Memo } from '@/lib/types'
import { useFolderStore } from '@/stores/folderStore'
import { formatMemoDate } from '@/utils/format'

interface KanbanViewProps {
  memos: Memo[]
}

interface KanbanColumn {
  id: number | null
  name: string
  color: string | null
  memos: Memo[]
}

export function KanbanView({ memos }: KanbanViewProps) {
  const folders = useFolderStore((s) => s.folders)
  const navigate = useNavigate()

  const columns = useMemo<KanbanColumn[]>(() => {
    const folderMap = new Map<number | null, Memo[]>()

    // Group memos by folderId
    for (const memo of memos) {
      const key = memo.folderId ?? null
      if (!folderMap.has(key)) {
        folderMap.set(key, [])
      }
      folderMap.get(key)!.push(memo)
    }

    const result: KanbanColumn[] = []

    // Add folder columns in order
    for (const folder of folders) {
      if (folder.isSystem || folder.id == null) continue
      const folderMemos = folderMap.get(folder.id) || []
      result.push({
        id: folder.id,
        name: folder.name,
        color: folder.color,
        memos: folderMemos,
      })
    }

    // Add uncategorized column
    const uncategorized = folderMap.get(null) || []
    if (uncategorized.length > 0) {
      result.unshift({
        id: null,
        name: '\uBBF8\uBD84\uB958',
        color: null,
        memos: uncategorized,
      })
    }

    return result
  }, [memos, folders])

  if (columns.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-zinc-400 dark:text-zinc-500">
        <p className="text-sm">{'\uBA54\uBAA8\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4'}</p>
      </div>
    )
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 px-1 -mx-1 snap-x snap-mandatory scrollbar-thin">
      {columns.map((column) => (
        <div
          key={column.id ?? 'uncategorized'}
          className="flex flex-col min-w-[280px] max-w-[320px] shrink-0 snap-start"
        >
          {/* Column header */}
          <div className="flex items-center gap-2 px-3 py-2.5 mb-2">
            {column.color ? (
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: column.color }}
              />
            ) : (
              <Inbox className="w-4 h-4 text-zinc-400 dark:text-zinc-500 shrink-0" />
            )}
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
              {column.name}
            </span>
            <span className="text-xs text-zinc-400 dark:text-zinc-500 ml-auto shrink-0">
              {column.memos.length}
            </span>
          </div>

          {/* Column body */}
          <div className="flex flex-col gap-2 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 p-2 flex-1 overflow-y-auto max-h-[calc(100dvh-220px)]">
            {column.memos.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-zinc-300 dark:text-zinc-600">
                <FolderIcon className="w-8 h-8" />
              </div>
            ) : (
              column.memos.map((memo) => (
                <KanbanCard
                  key={memo.id}
                  memo={memo}
                  onClick={() => navigate(`/memo/${memo.id}`)}
                />
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function KanbanCard({ memo, onClick }: { memo: Memo; onClick: () => void }) {
  const bodyPreview = memo.body
    .replace(/^#{1,6}\s/gm, '')
    .replace(/[*_~`>]/g, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1')
    .trim()
    .slice(0, 120)

  return (
    <button
      onClick={onClick}
      className={clsx(
        'w-full text-left p-3 rounded-xl bg-white dark:bg-zinc-800',
        'shadow-sm hover:shadow-md transition-all duration-150',
        'hover:-translate-y-0.5 active:scale-[0.98]'
      )}
    >
      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate mb-1">
        {memo.title || '\uC81C\uBAA9 \uC5C6\uC74C'}
      </p>

      {bodyPreview && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed mb-2">
          {bodyPreview}
        </p>
      )}

      {memo.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {memo.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-primary-50 text-primary-600 dark:bg-primary-900/50 dark:text-primary-400"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 dark:text-zinc-500">
        {memo.isStarred && (
          <span className="text-primary-500">{'\u2605'}</span>
        )}
        <span>{formatMemoDate(memo.updatedAt)}</span>
      </div>
    </button>
  )
}
