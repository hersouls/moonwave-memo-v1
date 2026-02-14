import { useRef, useState, useEffect } from 'react'
import { GripVertical, X } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Checkbox } from '@/components/ui/Checkbox'
import type { SubTask } from '@/lib/types'

interface SubtaskItemProps {
  subtask: SubTask
  onToggle: (id: string) => void
  onUpdate: (id: string, title: string) => void
  onDelete: (id: string) => void
  sortable?: boolean
}

export function SubtaskItem({ subtask, onToggle, onUpdate, onDelete, sortable = false }: SubtaskItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(subtask.title)
  const inputRef = useRef<HTMLInputElement>(null)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: subtask.id,
    disabled: !sortable,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isEditing])

  const handleSave = () => {
    const trimmed = editValue.trim()
    if (trimmed) {
      onUpdate(subtask.id, trimmed)
    } else {
      onDelete(subtask.id)
    }
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      setEditValue(subtask.title)
      setIsEditing(false)
    } else if (e.key === 'Backspace' && editValue === '') {
      onDelete(subtask.id)
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 py-1.5 group ${isDragging ? 'opacity-50' : ''}`}
    >
      {/* Drag handle */}
      {sortable ? (
        <div
          {...attributes}
          {...listeners}
          className="flex-shrink-0 cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical className="w-4 h-4 text-zinc-300 dark:text-zinc-600" />
        </div>
      ) : (
        <GripVertical className="w-4 h-4 text-zinc-300 dark:text-zinc-600 flex-shrink-0 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity" />
      )}

      {/* Checkbox */}
      <Checkbox
        checked={subtask.isCompleted}
        onChange={() => onToggle(subtask.id)}
        size="sm"
      />

      {/* Title */}
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="flex-1 text-sm bg-transparent border-none outline-none text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
          placeholder="하위 작업 입력"
        />
      ) : (
        <span
          onClick={() => setIsEditing(true)}
          className={`flex-1 text-sm cursor-text ${
            subtask.isCompleted
              ? 'line-through text-zinc-400 dark:text-zinc-500'
              : 'text-zinc-900 dark:text-zinc-100'
          }`}
        >
          {subtask.title}
        </span>
      )}

      {/* Delete */}
      <button
        type="button"
        onClick={() => onDelete(subtask.id)}
        className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        aria-label="하위 작업 삭제"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
