import { useMemo, useRef } from 'react'
import Fuse, { type IFuseOptions } from 'fuse.js'
import { useMemoStore } from '@/stores/memoStore'
import { useFolderStore } from '@/stores/folderStore'
import { useUIStore } from '@/stores/uiStore'
import type { Memo } from '@/lib/types'

// PERF: Stable Fuse.js options object — avoids re-creating on every render
const FUSE_OPTIONS: IFuseOptions<Memo> = {
  keys: ['title', 'body', 'tags'],
  threshold: 0.3,
  ignoreLocation: true,
  minMatchCharLength: 1,
}

export function useMemoFilters() {
  const memos = useMemoStore((s) => s.memos)
  const activeFilter = useUIStore((s) => s.activeFilter)
  const activeFolderId = useUIStore((s) => s.activeFolderId)
  const activeTag = useUIStore((s) => s.activeTag)
  const searchQuery = useUIStore((s) => s.searchQuery)
  const sortBy = useUIStore((s) => s.sortBy)
  const searchFilters = useUIStore((s) => s.searchFilters)
  const folders = useFolderStore((s) => s.folders)

  // PERF: Cache Fuse index — only rebuild when memos array changes
  const fuseRef = useRef<{ memos: typeof memos; index: Fuse<Memo> } | null>(null)
  if (!fuseRef.current || fuseRef.current.memos !== memos) {
    const activeMemos = memos.filter((m) => !m.deletedAt)
    fuseRef.current = { memos, index: new Fuse(activeMemos, FUSE_OPTIONS) }
  }

  return useMemo(() => {
    // B-01: Support trash view - show deleted memos when in trash folder
    const trashFolder = folders.find((f) => f.isSystem)
    const isTrashView = trashFolder != null && activeFolderId === trashFolder.id

    let filtered: typeof memos
    if (isTrashView) {
      filtered = memos.filter((m) => !!m.deletedAt)
    } else {
      filtered = memos.filter((m) => !m.deletedAt)
    }

    // Filter by starred
    if (activeFilter === 'starred') {
      filtered = filtered.filter((m) => m.isStarred)
    }

    // Filter by folder (skip when in trash view - show all deleted memos)
    if (activeFolderId != null && !isTrashView) {
      filtered = filtered.filter((m) => m.folderId === activeFolderId)
    }

    // Filter by tag
    if (activeTag !== null) {
      filtered = filtered.filter((m) => m.tags.includes(activeTag))
    }

    // PERF: Use cached Fuse index for search instead of creating new instance per query
    if (searchQuery.trim()) {
      const fuseResults = fuseRef.current!.index.search(searchQuery.trim())
      const matchIds = new Set(fuseResults.map((r) => r.item.id))
      filtered = filtered.filter((m) => matchIds.has(m.id))
    }

    // Advanced search filters (skip if already filtered by starred via activeFilter)
    if (searchFilters.starredOnly && activeFilter !== 'starred') {
      filtered = filtered.filter((m) => m.isStarred)
    }

    if (searchFilters.colorFilter) {
      filtered = filtered.filter((m) => m.color === searchFilters.colorFilter)
    }

    if (searchFilters.dateRange !== 'all') {
      const now = new Date()
      let cutoff: Date

      if (searchFilters.dateRange === 'today') {
        cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      } else if (searchFilters.dateRange === 'week') {
        cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      } else {
        // month
        cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      }

      filtered = filtered.filter((m) => new Date(m.updatedAt) >= cutoff)
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
  }, [memos, activeFilter, activeFolderId, activeTag, searchQuery, sortBy, searchFilters, folders])
}
