import { describe, it, expect } from 'vitest'
import { planWatch } from '../watchPlan'

describe('planWatch (§4.4 감시자 재지정)', () => {
  it('starts a watch when none is active', () => {
    expect(planWatch(false, null, 'D:/Memo')).toBe('start')
  })

  it('is a no-op when already watching the same root', () => {
    expect(planWatch(true, 'D:/Memo', 'D:/Memo')).toBe('noop')
  })

  it('restarts when the primary folder changed (regression: stale watcher)', () => {
    // 폴더 변경 A→B: 감시자가 A에 남으면 미러 겹침 가드가 잘못된 루트로 판단한다.
    expect(planWatch(true, 'D:/Memo/A', 'D:/Memo/B')).toBe('restart')
  })

  it('restarts even if a previous root was somehow lost while flagged watching', () => {
    expect(planWatch(true, null, 'D:/Memo')).toBe('restart')
  })
})
