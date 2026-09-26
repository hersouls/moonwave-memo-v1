import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import 'fake-indexeddb/auto'

// A live listener that errors is detached by Firestore for good. It must be re-attached
// with capped exponential backoff while its session lives — and never after logout.

const { subs } = vi.hoisted(() => ({
  subs: [] as Array<{ path: string; next: (snap: unknown) => unknown; error: (err: Error) => void; closed: boolean }>,
}))

vi.mock('@/lib/firebase', () => ({ firestore: {} }))
vi.mock('@/services/settingsSync', () => ({ initSettingsSync: async () => {}, stopSettingsSync: () => {} }))
vi.mock('@/services/syncFolder', () => ({
  notifyMemoSaved: vi.fn(), notifyMemoDeleted: vi.fn(), notifyFolderCreated: vi.fn(),
  notifyFolderRenamed: vi.fn(), notifyFolderDeleted: vi.fn(),
}))
vi.mock('firebase/firestore', () => ({
  collection: (_f: unknown, path: string) => ({ __path: path }),
  doc: (_f: unknown, path: string, id: string) => ({ __path: `${path}/${id}` }),
  getDocs: async () => ({ docs: [] }),
  setDoc: async () => {},
  deleteDoc: async () => {},
  onSnapshot: (ref: { __path: string }, ...args: unknown[]) => {
    const [next, error] = args.filter((a) => typeof a === 'function') as [
      (snap: unknown) => unknown, (err: Error) => void,
    ]
    const sub = { path: ref.__path, next, error, closed: false }
    subs.push(sub)
    return () => { sub.closed = true }
  },
  waitForPendingWrites: async () => {},
}))

import { db } from '@/services/database'
import { initSync, stopSync, listenerRetryDelay } from '@/services/firestoreSync'
import { getSyncStatus } from '@/services/syncStatus'
import { useToastStore } from '@/stores/toastStore'

const MEMOS = 'users/u1/memos'
const memoSubs = () => subs.filter((s) => s.path === MEMOS)
const latestMemoSub = () => memoSubs().at(-1)!
const disconnectToasts = () =>
  useToastStore.getState().toasts.filter((t) => t.message === '메모 동기화 연결이 끊어졌습니다').length

describe('live listener re-subscription', () => {
  beforeEach(async () => {
    stopSync()
    subs.length = 0
    useToastStore.setState({ toasts: [] })
    await Promise.all([db.memos.clear(), db.folders.clear(), db.syncMeta.clear()])
    await initSync('u1')
    // Only timers are faked; fake-indexeddb schedules with setImmediate.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  })

  afterEach(() => {
    stopSync()
    vi.useRealTimers()
  })

  it('backs off exponentially with a cap', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(listenerRetryDelay)).toEqual([1000, 2000, 4000, 8000, 16000, 32000, 60000, 60000])
  })

  it('re-subscribes a failed listener after the backoff delay and reports the outage', async () => {
    expect(memoSubs()).toHaveLength(1)

    latestMemoSub().error(new Error('unavailable'))
    await vi.advanceTimersByTimeAsync(0)
    expect(getSyncStatus().status).toBe('error')
    expect(disconnectToasts()).toBe(1)

    await vi.advanceTimersByTimeAsync(999)
    expect(memoSubs()).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(memoSubs()).toHaveLength(2)

    // Fails again straight away → the next wait doubles, and the user isn't re-toasted.
    latestMemoSub().error(new Error('unavailable'))
    await vi.advanceTimersByTimeAsync(1999)
    expect(memoSubs()).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(1)
    expect(memoSubs()).toHaveLength(3)
    expect(disconnectToasts()).toBe(1)

    // A server-confirmed snapshot proves recovery: the backoff starts over.
    await latestMemoSub().next({ docChanges: () => [], metadata: { fromCache: false } })
    latestMemoSub().error(new Error('unavailable'))
    await vi.advanceTimersByTimeAsync(1000)
    expect(memoSubs()).toHaveLength(4)
  })

  it('a cache-only snapshot does not reset the backoff', async () => {
    latestMemoSub().error(new Error('unavailable'))
    await vi.advanceTimersByTimeAsync(1000)
    await latestMemoSub().next({ docChanges: () => [], metadata: { fromCache: true } })
    latestMemoSub().error(new Error('unavailable'))
    await vi.advanceTimersByTimeAsync(1999)
    expect(memoSubs()).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(1)
    expect(memoSubs()).toHaveLength(3)
  })

  it('stops retrying on logout', async () => {
    latestMemoSub().error(new Error('unavailable'))
    stopSync()
    await vi.advanceTimersByTimeAsync(120_000)
    expect(memoSubs()).toHaveLength(1)

    // An error surfacing from a listener of an ended session is ignored too.
    const before = subs.length
    subs[0].error(new Error('late'))
    await vi.advanceTimersByTimeAsync(120_000)
    expect(subs.length).toBe(before)
  })
})
