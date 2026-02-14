import { useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'

export function MemoSearchBar() {
  const searchQuery = useUIStore((s) => s.searchQuery)
  const setSearchQuery = useUIStore((s) => s.setSearchQuery)
  const [isExpanded, setIsExpanded] = useState(!!searchQuery)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleExpand = () => {
    setIsExpanded(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const handleClear = () => {
    setSearchQuery('')
    if (!searchQuery) {
      setIsExpanded(false)
    }
    inputRef.current?.focus()
  }

  const handleBlur = () => {
    if (!searchQuery) {
      setIsExpanded(false)
    }
  }

  if (!isExpanded) {
    return (
      <div className="px-4 lg:px-0">
        <button
          onClick={handleExpand}
          className="flex w-full items-center gap-2.5 rounded-xl bg-zinc-100 px-4 py-2.5 text-sm text-zinc-400 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-500 dark:hover:bg-zinc-700"
        >
          <Search className="h-4 w-4" />
          메모 검색
        </button>
      </div>
    )
  }

  return (
    <div className="px-4 lg:px-0">
      <div className="flex items-center gap-2.5 rounded-xl bg-zinc-100 px-4 py-2.5 dark:bg-zinc-800">
        <Search className="h-4 w-4 shrink-0 text-zinc-400 dark:text-zinc-500" />
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onBlur={handleBlur}
          placeholder="메모 검색"
          className="flex-1 bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100 dark:placeholder:text-zinc-500"
        />
        {searchQuery && (
          <button
            onClick={handleClear}
            className="rounded-full p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-700"
          >
            <X className="h-3.5 w-3.5 text-zinc-400" />
          </button>
        )}
      </div>
    </div>
  )
}
