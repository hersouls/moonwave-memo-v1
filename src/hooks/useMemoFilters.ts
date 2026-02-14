import { useMemo } from 'react'
import { useMemoStore } from '@/stores/memoStore'
import { useUIStore } from '@/stores/uiStore'

export function useMemoFilters() {
  const memos = useMemoStore((s) => s.memos)
  const activeFilter = useUIStore((s) => s.activeFilter)
  const activeFolderId = useUIStore((s) => s.activeFolderId)
  const activeTag = useUIStore((s) => s.activeTag)
  const searchQuery = useUIStore((s) => s.searchQuery)
  const sortBy = useUIStore((s) => s.sortBy)

  return useMemo(() => {
    let filtered = memos.filter((m) => !m.deletedAt)

    // Filter by starred
    if (activeFilter === 'starred') {
      filtered = filtered.filter((m) => m.isStarred)
    }

    // Filter by folder
    if (activeFolderId != null) {
      filtered = filtered.filter((m) => m.folderId === activeFolderId)
    }

    // Filter by tag
    if (activeTag) {
      filtered = filtered.filter((m) => m.tags.includes(activeTag))
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      filtered = filtered.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          m.body.toLowerCase().includes(q) ||
          m.tags.some((t) => t.toLowerCase().includes(q))
      )
    }

    // Separate pinned and unpinned
    const pinned = filtered.filter((m) => m.isPinned)
    const unpinned = filtered.filter((m) => !m.isPinned)

    // Sort function
    const sortFn = (a: typeof memos[number], b: typeof memos[number]) => {
      if (sortBy === 'title') {
        return a.title.localeCompare(b.title, 'ko')
      }
      if (sortBy === 'createdAt') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      }
      // Default: updatedAt
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    }

    pinned.sort(sortFn)
    unpinned.sort(sortFn)

    return [...pinned, ...unpinned]
  }, [memos, activeFilter, activeFolderId, activeTag, searchQuery, sortBy])
}
