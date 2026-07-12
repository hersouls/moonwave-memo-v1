import { describe, it, expect } from 'vitest'
import type { Memo } from '@/lib/types'
import { planBatchTags } from '../batchTags'

let nextId = 1
function makeMemo(overrides: Partial<Memo> = {}): Memo {
  return {
    id: nextId++,
    title: '메모',
    body: '이 본문은 AI 태깅 최소 길이인 20자를 충분히 넘습니다.',
    folderId: null,
    tags: [],
    isStarred: false,
    color: 'white',
    isPinned: false,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('planBatchTags', () => {
  it('skips memos that already have tags, are trashed, or are ephemeral', () => {
    const memos = [
      makeMemo({ tags: ['이미태그'] }),
      makeMemo({ deletedAt: '2026-07-02T00:00:00.000Z' }),
      makeMemo({ ephemeralExpiresAt: '2026-07-12T01:00:00.000Z' }),
    ]
    const plan = planBatchTags(memos, memos.map((m) => m.id!))
    expect(plan.recover).toEqual([])
    expect(plan.aiTargets).toEqual([])
    expect(plan.skipped).toBe(3)
  })

  it('recovers tags from body hashtags without AI', () => {
    const memo = makeMemo({ body: '본문에 #여행 #계획 해시태그가 있음' })
    const plan = planBatchTags([memo], [memo.id!])
    expect(plan.recover).toEqual([{ id: memo.id, tags: ['여행', '계획'] }])
    expect(plan.aiTargets).toEqual([])
    expect(plan.skipped).toBe(0)
  })

  it('routes hashtag-less memos with enough body to AI targets', () => {
    const memo = makeMemo()
    const plan = planBatchTags([memo], [memo.id!])
    expect(plan.recover).toEqual([])
    expect(plan.aiTargets).toEqual([memo.id])
  })

  it('skips memos whose body is too short for AI', () => {
    const memo = makeMemo({ body: '짧은 본문' })
    const plan = planBatchTags([memo], [memo.id!])
    expect(plan.aiTargets).toEqual([])
    expect(plan.skipped).toBe(1)
  })

  it('ignores memos not included in ids', () => {
    const inList = makeMemo()
    const outOfList = makeMemo()
    const plan = planBatchTags([inList, outOfList], [inList.id!])
    expect(plan.aiTargets).toEqual([inList.id])
    expect(plan.skipped).toBe(0)
  })
})
