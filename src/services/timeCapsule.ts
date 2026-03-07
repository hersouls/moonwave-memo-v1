import type { Memo } from '@/lib/types'

export interface TimeCapsuleResult {
  found: boolean
  memo?: Memo
  yearsAgo?: number
}

export function findTimeCapsuleMemo(memos: Memo[]): TimeCapsuleResult {
  const today = new Date()
  const todayMonth = today.getMonth()
  const todayDate = today.getDate()

  const activeMemos = memos.filter((m) => !m.deletedAt)
  if (activeMemos.length === 0) return { found: false }

  // Find memos created on this date in previous years
  const candidates: (Memo & { yearsAgo: number })[] = []

  for (const memo of activeMemos) {
    const created = new Date(memo.createdAt)
    const yearDiff = today.getFullYear() - created.getFullYear()

    if (yearDiff >= 1 && created.getMonth() === todayMonth && created.getDate() === todayDate) {
      candidates.push({ ...memo, yearsAgo: yearDiff })
    }
  }

  if (candidates.length === 0) return { found: false }

  // Pick the best: starred first, then longest body, then most recent year
  candidates.sort((a, b) => {
    if (a.isStarred !== b.isStarred) return a.isStarred ? -1 : 1
    if (a.body.length !== b.body.length) return b.body.length - a.body.length
    return a.yearsAgo - b.yearsAgo
  })

  const best = candidates[0]
  return { found: true, memo: best, yearsAgo: best.yearsAgo }
}
