import { Tags, X } from 'lucide-react'

interface TagInputProps {
  tags: string[]
  onRemoveTag?: (tag: string) => void
  /** 태그 편집 모달 열기 — 지정하면 태그가 없어도 편집 버튼이 보인다. */
  onEdit?: () => void
}

export function TagInput({ tags, onRemoveTag, onEdit }: TagInputProps) {
  if (tags.length === 0 && !onEdit) return null

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-4 py-2">
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-primary-50 text-primary-700 dark:bg-primary-900 dark:text-primary-300"
        >
          #{tag}
          {onRemoveTag && (
            <button
              onClick={() => onRemoveTag(tag)}
              className="hover:text-primary-900 dark:hover:text-primary-100"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </span>
      ))}
      {onEdit && (
        <button
          onClick={onEdit}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
          aria-label="태그 편집"
        >
          <Tags className="w-3 h-3" />
          태그 편집
        </button>
      )}
    </div>
  )
}
