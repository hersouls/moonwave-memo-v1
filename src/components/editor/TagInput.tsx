import { X } from 'lucide-react'

interface TagInputProps {
  tags: string[]
  onRemoveTag?: (tag: string) => void
}

export function TagInput({ tags, onRemoveTag }: TagInputProps) {
  if (tags.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1.5 px-4 py-2">
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
    </div>
  )
}
