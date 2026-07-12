import type { Memo } from '@/lib/types'
import { extractTags } from '@/lib/tagParser'

/** suggestTags가 즉시 빈 배열을 반환하는 최소 본문 길이와 동일 (aiFeatures.ts). */
export const MIN_AI_BODY_LENGTH = 20

export interface BatchTagPlan {
  /** Phase A: 본문 해시태그 재추출만으로 복구 가능 (AI 불필요·즉시). */
  recover: Array<{ id: number; tags: string[] }>
  /** Phase B: AI 호출이 필요한 메모 id. */
  aiTargets: number[]
  /** 이미 태그 있음 / 휴지통 / 임시 메모 / 본문이 너무 짧아 제외된 수. */
  skipped: number
}

/**
 * 배치 태깅 대상 분류. 태그가 이미 있는 메모, 휴지통(deletedAt), 임시(ephemeral)
 * 메모는 건너뛴다. 본문에 해시태그가 있으면 재추출로 복구(recover), 없으면
 * 본문이 충분히 길 때만 AI 대상(aiTargets)으로 분류한다.
 */
export function planBatchTags(memos: Memo[], ids: number[]): BatchTagPlan {
  const idSet = new Set(ids)
  const recover: Array<{ id: number; tags: string[] }> = []
  const aiTargets: number[] = []
  let skipped = 0

  for (const memo of memos) {
    if (memo.id == null || !idSet.has(memo.id)) continue
    if (memo.deletedAt || memo.ephemeralExpiresAt || (memo.tags ?? []).length > 0) {
      skipped++
      continue
    }
    const bodyTags = extractTags(memo.body ?? '')
    if (bodyTags.length > 0) {
      recover.push({ id: memo.id, tags: bodyTags })
    } else if ((memo.body ?? '').trim().length >= MIN_AI_BODY_LENGTH) {
      aiTargets.push(memo.id)
    } else {
      skipped++
    }
  }

  return { recover, aiTargets, skipped }
}
