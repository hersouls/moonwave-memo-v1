import { useRef, useState, useEffect, useCallback } from 'react'
import { Search, X, Clock, SlidersHorizontal } from 'lucide-react'
import clsx from 'clsx'
import { useUIStore } from '@/stores/uiStore'
import { SearchFilters } from './SearchFilters'

// F-08: Limit recent searches on narrow fold
const FOLD_MAX_RECENT_DISPLAY = 5

const RECENT_SEARCHES_KEY = 'memo-recent-searches'
const MAX_RECENT = 10

function getRecentSearches(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || '[]')
  } catch {
    return []
  }
}

function saveRecentSearch(query: string) {
  const recent = getRecentSearches().filter((q) => q !== query)
  recent.unshift(query)
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)))
}

function removeRecentSearch(query: string) {
  const recent = getRecentSearches().filter((q) => q !== query)
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recent))
}

export function MemoSearchBar() {
  const searchQuery = useUIStore((s) => s.searchQuery)
  const setSearchQuery = useUIStore((s) => s.setSearchQuery)
  const [isExpanded, setIsExpanded] = useState(!!searchQuery)
  const [showRecent, setShowRecent] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [recentSearches, setRecentSearches] = useState<string[]>(getRecentSearches)
  const isNarrowFold = useUIStore((s) => s.isNarrowFold)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // P-04: Debounced search
  const [localQuery, setLocalQuery] = useState(searchQuery)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleQueryChange = useCallback((value: string) => {
    setLocalQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setSearchQuery(value)
    }, 300)
  }, [setSearchQuery])

  // Sync when searchQuery changes externally
  useEffect(() => {
    setLocalQuery(searchQuery)
  }, [searchQuery])

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const handleExpand = () => {
    setIsExpanded(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const handleClear = () => {
    setLocalQuery('')
    setSearchQuery('')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!searchQuery) {
      setIsExpanded(false)
      setShowRecent(false)
    }
    inputRef.current?.focus()
  }

  const handleBlur = useCallback(() => {
    // Delay to allow click on recent search items
    setTimeout(() => {
      if (!containerRef.current?.contains(document.activeElement)) {
        setShowRecent(false)
        if (!searchQuery) {
          setIsExpanded(false)
        }
      }
    }, 150)
  }, [searchQuery])

  const handleSubmit = () => {
    if (searchQuery.trim()) {
      saveRecentSearch(searchQuery.trim())
      setRecentSearches(getRecentSearches())
    }
    setShowRecent(false)
  }

  const handleSelectRecent = (query: string) => {
    setLocalQuery(query)
    setSearchQuery(query)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setShowRecent(false)
    inputRef.current?.focus()
  }

  const handleRemoveRecent = (e: React.MouseEvent, query: string) => {
    e.stopPropagation()
    removeRecentSearch(query)
    setRecentSearches(getRecentSearches())
  }

  // Close recent dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowRecent(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

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
    <div className="px-4 lg:px-0" ref={containerRef}>
      <div className="relative">
        <div className="flex items-center gap-2.5 rounded-xl bg-zinc-100 px-4 py-2.5 fold:py-2 dark:bg-zinc-800">
          <Search className="h-4 w-4 shrink-0 text-zinc-400 dark:text-zinc-500" />
          <input
            ref={inputRef}
            type="text"
            value={localQuery}
            onChange={(e) => handleQueryChange(e.target.value)}
            onFocus={() => setShowRecent(true)}
            onBlur={handleBlur}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
            placeholder="메모 검색"
            className="flex-1 bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100 dark:placeholder:text-zinc-500"
          />
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={clsx(
              'rounded-full p-1 transition-colors',
              showFilters
                ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400'
                : 'text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            )}
            aria-label="필터"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
          </button>
          {searchQuery && (
            <button
              onClick={handleClear}
              className="rounded-full p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-700"
            >
              <X className="h-3.5 w-3.5 text-zinc-400" />
            </button>
          )}
        </div>

        {/* Recent searches dropdown */}
        {showRecent && !localQuery && recentSearches.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-1 z-20 rounded-xl border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900 animate-in fade-in slide-in-from-top-1 duration-150">
            <div className="px-3 py-1.5 text-[11px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">
              최근 검색
            </div>
            {recentSearches.slice(0, isNarrowFold ? FOLD_MAX_RECENT_DISPLAY : MAX_RECENT).map((query) => (
              <div
                key={query}
                role="button"
                tabIndex={0}
                onClick={() => handleSelectRecent(query)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelectRecent(query) } }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <Clock className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                <span className="flex-1 truncate text-left">{query}</span>
                <button
                  onClick={(e) => handleRemoveRecent(e, query)}
                  className="shrink-0 rounded-full p-0.5 text-zinc-300 hover:text-zinc-500 dark:text-zinc-600 dark:hover:text-zinc-400"
                  aria-label={`"${query}" 최근 검색 삭제`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filter chips */}
      {showFilters && (
        <div className="animate-in fade-in slide-in-from-top-1 duration-150">
          <SearchFilters />
        </div>
      )}
    </div>
  )
}
