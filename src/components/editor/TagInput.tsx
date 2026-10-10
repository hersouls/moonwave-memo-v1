
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
            <button type="button"
              onClick={() => onRemoveTag(tag)}
              className="mw-icon-button"
            >
              <IcLineClose size={12} />
            </button>
          )}
        </span>
      ))}
      {onEdit && (
        <button type="button"
          onClick={onEdit}
          className="mw-button mw-button--tertiary-subtle mw-button--small mw-button--icon-left"
          aria-label="태그 편집"
        >
          <IcMwTag size={12} />
          태그 편집
        </button>
      )}
    </div>
  )
}

import { IcLineClose, IcMwTag } from '@/mw/icons'