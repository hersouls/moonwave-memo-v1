import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import 'fake-indexeddb/auto'

// Every open tab receives 'online' and the service worker's SYNC_PENDING_MEMOS at once;
// the queue replay must run in one place at a time so each intent is pushed once.

const { writes } = vi.hoisted(() => ({ writes: [] as string[] }))

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
  setDoc: async (ref: { __path: string }) => {
    // A little latency so concurrent replays really overlap.
    await new Promise((r) => setTimeout(r, 5))
    writes.push(ref.__path)
  },
  deleteDoc: async () => {},
  onSnapshot: () => () => {},
  waitForPendingWrites: async () => {},
}))

import { db } from '@/services/database'
import { initSync, stopSync } from '@/services/firestoreSync'
import { processPendingSyncs } from '@/services/offlineQueue'

const T1 = '2026-01-01T00:00:00.000Z'

/** Minimal Web Locks: exclusive, with ifAvailable, shared by every "tab" of the origin. */
function createLockManager() {
  const held = new Set<string>()
  return {
    held,
    async request(name: string, opts: { ifAvailable?: boolean }, cb: (lock: unknown) => Promise<unknown>) {
      if (held.has(name)) {
        if (opts.ifAvailable) return cb(null)
        throw new Error('blocking wait not needed in this test')
      }
      held.add(name)
      try {
        return await cb({ name })
      } finally {
        held.delete(name)
      }
    },
  }
}

async function queueMemos(syncIds: string[]) {
  for (const syncId of syncIds) {
    await db.memos.add({
      title: syncId, body: '', folderId: null, tags: [], isStarred: false, color: 'white',
      isPinned: false, createdAt: T1, updatedAt: T1, syncId,
    })
    await db.pendingSyncs.add({ type: 'memo', action: 'upsert', syncId, createdAt: T1 })
  }
}

const memoWrites = () => writes.filter((p) => p.includes('/memos/')).sort()

describe('offline queue replay lock', () => {
  beforeEach(async () => {
    stopSync()
    await Promise.all([db.memos.clear(), db.folders.clear(), db.pendingSyncs.clear(), db.syncMeta.clear()])
    await initSync('u1')
    writes.length = 0
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    stopSync()
  })

  it('without Web Locks, overlapping replays in one tab push each item once', async () => {
    await queueMemos(['q1', 'q2'])
    await Promise.all([processPendingSyncs(), processPendingSyncs(), processPendingSyncs()])
    expect(memoWrites()).toEqual(['users/u1/memos/q1', 'users/u1/memos/q2'])
    expect(await db.pendingSyncs.count()).toBe(0)
  })

  it('with Web Locks, replays triggered in several tabs at once push each item once', async () => {
    const locks = createLockManager()
    vi.stubGlobal('navigator', { ...globalThis.navigator, locks })
    await queueMemos(['q1', 'q2', 'q3'])
    await Promise.all([processPendingSyncs(), processPendingSyncs(), processPendingSyncs()])
    expect(memoWrites()).toEqual(['users/u1/memos/q1', 'users/u1/memos/q2', 'users/u1/memos/q3'])
    expect(await db.pendingSyncs.count()).toBe(0)
  })

  it('skips while another tab holds the queue lock, and drains once it is free', async () => {
    const locks = createLockManager()
    vi.stubGlobal('navigator', { ...globalThis.navigator, locks })
    await queueMemos(['q1'])

    locks.held.add('memo-sync-queue') // another tab is draining
    await processPendingSyncs()
    expect(memoWrites()).toEqual([])
    expect(await db.pendingSyncs.count()).toBe(1)

    locks.held.delete('memo-sync-queue')
    await processPendingSyncs()
    expect(memoWrites()).toEqual(['users/u1/memos/q1'])
    expect(await db.pendingSyncs.count()).toBe(0)
  })
})
