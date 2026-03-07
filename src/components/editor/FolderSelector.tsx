import { ChevronDown, ChevronUp } from 'lucide-react'
import { useState, useRef, useCallback } from 'react'
import { useFolderStore } from '@/stores/folderStore'
import type { Folder } from '@/lib/types'

interface FolderSelectorProps {
  currentFolder?: Folder
  onFolderChange: (folderId: number) => void
}

export function FolderSelector({ currentFolder, onFolderChange }: FolderSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const listRef = useRef<HTMLDivElement>(null)
  const folders = useFolderStore((s) => s.folders).filter((f) => !f.isSystem)

  // A11Y-05: keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        setIsOpen(true)
        setFocusedIndex(0)
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setFocusedIndex((i) => Math.min(i + 1, folders.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setFocusedIndex((i) => Math.max(i - 1, 0))
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (focusedIndex >= 0 && focusedIndex < folders.length) {
          onFolderChange(folders[focusedIndex].id!)
          setIsOpen(false)
        }
        break
      case 'Escape':
        e.preventDefault()
        setIsOpen(false)
        break
    }
  }, [isOpen, focusedIndex, folders, onFolderChange])

  return (
    <div className="relative mb-4" onKeyDown={handleKeyDown}>
      {/* A11Y-05: aria-haspopup + aria-expanded */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 py-1 text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: currentFolder?.color || '#F59E0B' }}
        />
        <span>{currentFolder?.name || '내 메모'}</span>
        {isOpen ? (
          <ChevronUp className="w-3.5 h-3.5" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5" />
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          {/* A11Y-05: role="listbox" */}
          <div
            ref={listRef}
            role="listbox"
            aria-label="폴더 선택"
            className="absolute left-0 top-full mt-1 bg-white dark:bg-zinc-800 rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-700 py-1 z-20 min-w-[180px]"
          >
            {folders.map((folder, index) => (
              <button
                key={folder.id}
                role="option"
                aria-selected={folder.id === currentFolder?.id}
                onClick={() => {
                  onFolderChange(folder.id!)
                  setIsOpen(false)
                }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 ${focusedIndex === index ? 'bg-zinc-100 dark:bg-zinc-700' : ''}`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: folder.color }}
                />
                <span>{folder.name}</span>
                {folder.id === currentFolder?.id && (
                  <span className="ml-auto text-primary-500">✓</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
