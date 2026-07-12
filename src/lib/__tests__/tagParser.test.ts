import { describe, it, expect } from 'vitest'
import { extractTags, mergeTagsOnBodyChange, normalizeAITags, normalizeTags } from '../tagParser'

describe('extractTags', () => {
  it('extracts Korean/English/underscore hashtags, deduped, in order', () => {
    expect(extractTags('#여행 계획 #travel_2026 그리고 #여행')).toEqual(['여행', 'travel_2026'])
  })

  it('returns [] when there are no hashtags', () => {
    expect(extractTags('해시태그 없는 본문')).toEqual([])
  })
})

describe('mergeTagsOnBodyChange', () => {
  it('preserves field-only tags (AI/수동) across body edits', () => {
    const merged = mergeTagsOnBodyChange(['ai태그'], '본문', '본문 수정')
    expect(merged).toEqual(['ai태그'])
  })

  it('removes a tag when its hashtag is deleted from the body', () => {
    const merged = mergeTagsOnBodyChange(['여행', 'ai태그'], '#여행 본문', '본문')
    expect(merged).toEqual(['ai태그'])
  })

  it('adds newly typed body hashtags', () => {
    const merged = mergeTagsOnBodyChange(['ai태그'], '본문', '본문 #새태그')
    expect(merged).toEqual(['새태그', 'ai태그'])
  })

  it('dedupes when a field tag is also typed as a body hashtag', () => {
    const merged = mergeTagsOnBodyChange(['여행'], '본문', '본문 #여행')
    expect(merged).toEqual(['여행'])
  })

  it('treats old tags as field-only when oldBody is empty', () => {
    const merged = mergeTagsOnBodyChange(['유지'], '', '새 본문')
    expect(merged).toEqual(['유지'])
  })
})

describe('normalizeTags', () => {
  it('does NOT cap the count — manual tags must never be silently truncated', () => {
    expect(normalizeTags(['a', 'b', 'c', 'd', 'e', 'f'])).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
  })
})

describe('normalizeAITags', () => {
  it('strips leading #, converts spaces to _, drops invalid chars', () => {
    expect(normalizeAITags(['#여행', '머신 러닝', 'C++'])).toEqual(['여행', '머신_러닝', 'C'])
  })

  it('dedupes and caps at 5', () => {
    expect(normalizeAITags(['a', 'a', 'b', 'c', 'd', 'e', 'f'])).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('filters out tags that normalize to empty', () => {
    expect(normalizeAITags(['!!!', '#', '  '])).toEqual([])
  })
})
