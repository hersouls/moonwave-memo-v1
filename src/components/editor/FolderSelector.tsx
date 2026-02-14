import { ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import { useFolderStore } from '@/stores/folderStore'
import type { Folder } from '@/lib/types'

interface FolderSelectorProps {
  currentFolder?: Folder
  onFolderChange: (folderId: number) => void
}

export function FolderSelector({ currentFolder, onFolderChange }: FolderSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const folders = useFolderStore((s) => s.folders).filter((f) => !f.isSystem)

  return (
    <div className="relative mb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 py-1 text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
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
          <div className="absolute left-0 top-full mt-1 bg-white dark:bg-zinc-800 rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-700 py-1 z-20 min-w-[180px]">
            {folders.map((folder) => (
              <button
                key={folder.id}
                onClick={() => {
                  onFolderChange(folder.id!)
                  setIsOpen(false)
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700"
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
