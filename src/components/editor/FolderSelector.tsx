import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import { useState, useRef, useCallback } from 'react'
import clsx from 'clsx'
import { useFolderStore } from '@/stores/folderStore'
import type { Folder } from '@/lib/types'

interface FolderSelectorProps {
  currentFolder?: Folder
  onFolderChange: (folderId: number) => void
  /** 래퍼 마진 오버라이드 — 탭과 한 행으로 병합할 때 mb 제거용 (기본 'mb-4') */
  className?: string
}

export function FolderSelector({ currentFolder, onFolderChange, className = 'mb-4' }: FolderSelectorProps) {
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
    <div className={clsx('relative', className)} onKeyDown={handleKeyDown}>
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
          {/* A11Y-05: role="listbox" — 공용 .ctx-menu 프리미티브 사용 */}
          <div
            ref={listRef}
            role="listbox"
            aria-label="폴더 선택"
            className="ctx-menu absolute left-0 top-full mt-1 z-[var(--z-dropdown)] min-w-[180px] origin-top-left animate-in fade-in zoom-in-95 slide-in-from-top-1 duration-150 ease-enter"
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
                className={clsx(
                  'ctx-menu__item text-sm',
                  focusedIndex === index && 'bg-[var(--ctx-menu-hover-bg)]'
                )}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: folder.color }}
                />
                <span className="ctx-menu__item-label truncate">{folder.name}</span>
                {folder.id === currentFolder?.id && (
                  <Check className="w-4 h-4 shrink-0 text-primary-500" aria-hidden="true" />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
