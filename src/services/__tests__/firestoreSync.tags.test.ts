import { describe, it, expect, vi } from 'vitest'
import 'fake-indexeddb/auto'

// Avoid initialising the real Firebase app (needs runtime config).
vi.mock('@/lib/firebase', () => ({ firestore: {} }))

import { resolveRemoteTags } from '@/services/firestoreSync'

describe('resolveRemoteTags', () => {
  it('uses remote tags verbatim when present', () => {
    expect(resolveRemoteTags({ tags: ['여행'], body: '#다른태그 본문' })).toEqual(['여행'])
  })

  it('falls back to body hashtag extraction when remote tags are empty (레거시 문서)', () => {
    expect(resolveRemoteTags({ tags: [], body: '본문 #여행 #계획' })).toEqual(['여행', '계획'])
    expect(resolveRemoteTags({ body: '본문 #여행' })).toEqual(['여행'])
  })

  it('returns [] when neither tags nor body hashtags exist', () => {
    expect(resolveRemoteTags({ tags: [], body: '해시태그 없음' })).toEqual([])
    expect(resolveRemoteTags({})).toEqual([])
  })
})
