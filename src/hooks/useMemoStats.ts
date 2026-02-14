import { useMemo } from 'react'
import { useMemoStore } from '@/stores/memoStore'

export function useMemoStats() {
  const memos = useMemoStore((s) => s.memos)

  return useMemo(() => {
    const activeMemos = memos.filter((m) => !m.deletedAt)
    const deletedMemos = memos.filter((m) => !!m.deletedAt)

    const totalCount = activeMemos.length
    const starredCount = activeMemos.filter((m) => m.isStarred).length
    const deletedCount = deletedMemos.length

    const folderCounts = new Map<number, number>()
    for (const memo of activeMemos) {
      if (memo.folderId != null) {
        folderCounts.set(memo.folderId, (folderCounts.get(memo.folderId) || 0) + 1)
      }
    }

    const tagSet = new Set<string>()
    for (const memo of activeMemos) {
      for (const tag of memo.tags) {
        tagSet.add(tag)
      }
    }
    const allTags = Array.from(tagSet).sort((a, b) => a.localeCompare(b, 'ko'))

    return {
      totalCount,
      starredCount,
      deletedCount,
      folderCounts,
      allTags,
    }
  }, [memos])
}
