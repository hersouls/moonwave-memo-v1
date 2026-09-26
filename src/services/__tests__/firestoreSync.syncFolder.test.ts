import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import 'fake-indexeddb/auto'

// Remote memo changes (initial merge + live snapshot) must reach the disk sync folder too —
// otherwise edits made on another device never land in the folder (or the NAS pipeline behind it).

const { fsStore, listeners, disk } = vi.hoisted(() => ({
  fsStore: new Map<string, Record<string, unknown>>(),
  listeners: new Map<string, (snap: unknown) => Promise<void> | void>(),
  disk: {
    notifyMemoSaved: vi.fn(),
    notifyMemoDeleted: vi.fn(),
    notifyFolderCreated: vi.fn(),
    notifyFolderRenamed: vi.fn(),
    notifyFolderDeleted: vi.fn(),
  },
}))

vi.mock('@/lib/firebase', () => ({ firestore: {} }))
vi.mock('@/services/settingsSync', () => ({
  initSettingsSync: async () => {},
  stopSettingsSync: () => {},
}))
vi.mock('@/services/syncFolder', () => disk)

vi.mock('firebase/firestore', () => {
  type Ref = { __path: string }
  return {
    collection: (_firestore: unknown, path: string): Ref => ({ __path: path }),
    doc: (_firestore: unknown, path: string, id: string): Ref => ({ __path: `${path}/${id}` }),
    getDocs: async (col: Ref) => {
      const prefix = `${col.__path}/`
      const docs: Array<{ id: string; data: () => Record<string, unknown> }> = []
      for (const [key, value] of fsStore.entries()) {
        if (!key.startsWith(prefix)) continue
        const rest = key.slice(prefix.length)
        if (rest.includes('/')) continue
        docs.push({ id: rest, data: () => ({ ...value }) })
      }
      return { docs }
    },
    setDoc: async (ref: Ref, data: Record<string, unknown>, opts?: { merge?: boolean }) => {
      const prev = opts?.merge ? (fsStore.get(ref.__path) ?? {}) : {}
      fsStore.set(ref.__path, { ...prev, ...data })
    },
    deleteDoc: async (ref: Ref) => {
      fsStore.delete(ref.__path)
    },
    onSnapshot: (ref: Ref, next: (snap: unknown) => Promise<void> | void) => {
      listeners.set(ref.__path, next)
      return () => listeners.delete(ref.__path)
    },
  }
})

import * as database from '@/services/database'
import { db } from '@/services/database'
import { initSync, stopSync } from '@/services/firestoreSync'
import * as syncFolder from '@/services/syncFolder'

const UID = 'user-disk'
const OLD = '2026-01-01T00:00:00.000Z'
const NEW = '2026-02-01T00:00:00.000Z'

function cloudMemo(fields: Record<string, unknown> = {}) {
  return {
    title: 'cloud', body: 'body', folderSyncId: null, tags: [], isStarred: false,
    color: 'white', isPinned: false, createdAt: OLD, updatedAt: NEW, deletedAt: null, ...fields,
  }
}

async function addLocalMemo(syncId: string, fields: Record<string, unknown> = {}) {
  return db.memos.add({
    title: 'local', body: 'body', folderId: null, tags: [], isStarred: false, color: 'white',
    isPinned: false, createdAt: OLD, updatedAt: OLD, syncId, ...fields,
  })
}

function change(type: 'added' | 'modified' | 'removed', id: string, data: Record<string, unknown>) {
  return { type, doc: { id, data: () => data, metadata: { hasPendingWrites: false } } }
}

async function emitMemos(...changes: ReturnType<typeof change>[]) {
  const next = listeners.get(`users/${UID}/memos`)
  expect(next).toBeTruthy()
  await next!({ docChanges: () => changes })
}

const saved = vi.mocked(syncFolder.notifyMemoSaved)
const deleted = vi.mocked(syncFolder.notifyMemoDeleted)
const savedIds = () => saved.mock.calls.map(([m]) => m.syncId)
const deletedIds = () => deleted.mock.calls.map(([m]) => m.syncId)

describe('firestoreSync → sync folder reflection of remote memo changes', () => {
  beforeEach(async () => {
    fsStore.clear()
    listeners.clear()
    vi.clearAllMocks()
    await db.folders.clear()
    await db.memos.clear()
  })

  afterEach(() => {
    stopSync()
  })

  it('initial merge writes new and newer cloud memos, and removes tombstoned ones', async () => {
    await addLocalMemo('m-newer', { title: 'stale' })
    await addLocalMemo('m-gone')
    fsStore.set(`users/${UID}/memos/m-new`, cloudMemo({ title: 'from phone' }))
    fsStore.set(`users/${UID}/memos/m-newer`, cloudMemo({ title: 'edited on phone' }))
    fsStore.set(`users/${UID}/memos/m-gone`, { tombstone: true, purgedAt: NEW, updatedAt: NEW })

    await initSync(UID)

    await vi.waitFor(() => {
      expect(savedIds()).toEqual(expect.arrayContaining(['m-new', 'm-newer']))
      expect(deletedIds()).toContain('m-gone')
    })
    const written = saved.mock.calls.map(([m]) => m).find((m) => m.syncId === 'm-newer')
    expect(written?.title).toBe('edited on phone')
    expect(await database.getMemoBySyncId('m-gone')).toBeUndefined()
  })

  it('live snapshot writes added/modified memos and removes trashed, tombstoned and removed ones', async () => {
    await addLocalMemo('m-edit')
    await addLocalMemo('m-trash')
    await addLocalMemo('m-tomb')
    await addLocalMemo('m-removed')
    await initSync(UID)
    saved.mockClear()
    deleted.mockClear()

    await emitMemos(
      change('added', 'm-live', cloudMemo({ title: 'new on phone' })),
      change('modified', 'm-edit', cloudMemo({ title: 'edited on phone' })),
      change('modified', 'm-trash', cloudMemo({ deletedAt: NEW })),
      change('modified', 'm-tomb', { tombstone: true, purgedAt: NEW, updatedAt: NEW }),
      change('removed', 'm-removed', {}),
    )

    await vi.waitFor(() => {
      expect(savedIds().sort()).toEqual(['m-edit', 'm-live'])
      expect(deletedIds().sort()).toEqual(['m-removed', 'm-tomb', 'm-trash'])
    })
  })

  it('does not rewrite the file when the cloud copy is not newer', async () => {
    await addLocalMemo('m-same', { updatedAt: NEW })
    await initSync(UID)
    saved.mockClear()

    await emitMemos(change('modified', 'm-same', cloudMemo({ updatedAt: NEW })))

    await new Promise((r) => setTimeout(r, 20))
    expect(savedIds()).not.toContain('m-same')
  })
})
