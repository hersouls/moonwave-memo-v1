import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import 'fake-indexeddb/auto'

// Account switch on one device: the previous account's local data must never be uploaded
// into the new account, anything it had not synced must survive in a local backup, and the
// same account signing back in must get its data back.

const { fsStore, listeners, hold } = vi.hoisted(() => ({
  fsStore: new Map<string, Record<string, unknown>>(),
  listeners: new Map<string, (snap: unknown) => Promise<void> | void>(),
  // When set, setDoc calls whose path starts with `prefix` wait for `gate` (a slow network).
  hold: { prefix: null as string | null, gate: Promise.resolve(), started: 0 },
}))

vi.mock('@/lib/firebase', () => ({ firestore: {} }))
vi.mock('@/services/settingsSync', () => ({
  initSettingsSync: async () => {},
  stopSettingsSync: () => {},
}))
vi.mock('@/services/syncFolder', () => ({
  notifyMemoSaved: vi.fn(),
  notifyMemoDeleted: vi.fn(),
  notifyFolderCreated: vi.fn(),
  notifyFolderRenamed: vi.fn(),
  notifyFolderDeleted: vi.fn(),
}))

vi.mock('firebase/firestore', () => {
  type Ref = { __path: string }
  return {
    collection: (_firestore: unknown, path: string): Ref => ({ __path: path }),
    doc: (_firestore: unknown, path: string, id: string): Ref => ({ __path: `${path}/${id}` }),
    getDocs: async (col: Ref) => {
      const prefix = `${col.__path}/`
      const docs: Array<{ id: string; ref: Ref; data: () => Record<string, unknown> }> = []
      for (const [key, value] of fsStore.entries()) {
        if (!key.startsWith(prefix)) continue
        const rest = key.slice(prefix.length)
        if (rest.includes('/')) continue
        docs.push({ id: rest, ref: { __path: key }, data: () => ({ ...value }) })
      }
      return { docs }
    },
    setDoc: async (ref: Ref, data: Record<string, unknown>, opts?: { merge?: boolean }) => {
      if (hold.prefix && ref.__path.startsWith(hold.prefix)) {
        hold.started++
        await hold.gate
      }
      const prev = opts?.merge ? (fsStore.get(ref.__path) ?? {}) : {}
      fsStore.set(ref.__path, { ...prev, ...data })
    },
    deleteDoc: async (ref: Ref) => { fsStore.delete(ref.__path) },
    onSnapshot: (ref: Ref, ...args: unknown[]) => {
      const next = args.find((a) => typeof a === 'function') as (snap: unknown) => Promise<void> | void
      listeners.set(ref.__path, next)
      return () => listeners.delete(ref.__path)
    },
    waitForPendingWrites: async () => {},
  }
})

import * as database from '@/services/database'
import { db } from '@/services/database'
import { initSync, stopSync, pushMemo, applyRemoteMemo, currentWriteContext } from '@/services/firestoreSync'
import { getLocalOwnerUid, listOrphanBackups, getOrphanBackupFile } from '@/services/localOwner'
import { validateBackup } from '@/services/backup'

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
    title: `local ${syncId}`, body: 'body', folderId: null, tags: [], isStarred: false, color: 'white',
    isPinned: false, createdAt: OLD, updatedAt: OLD, syncId, ...fields,
  })
}

/** A memo created while signed out, through the normal store path (queued for later). */
async function createWhileSignedOut(syncId: string) {
  const id = await database.addMemo({
    title: `offline ${syncId}`, body: 'written while signed out', folderId: null, tags: [],
    isStarred: false, color: 'white', isPinned: false, syncId,
    createdAt: '', updatedAt: '', // stamped "now" by addMemo, like a real local edit
  })
  await pushMemo((await database.getMemo(id))!)
}

const cloudIds = (uid: string, kind: 'memos' | 'folders' = 'memos') =>
  [...fsStore.keys()]
    .filter((k) => k.startsWith(`users/${uid}/${kind}/`))
    .map((k) => k.slice(`users/${uid}/${kind}/`.length))

const localSyncIds = async () => (await db.memos.toArray()).map((m) => m.syncId).sort()

describe('account ownership of local data', () => {
  beforeEach(async () => {
    stopSync()
    fsStore.clear()
    listeners.clear()
    hold.prefix = null
    hold.started = 0
    await Promise.all([
      db.memos.clear(), db.folders.clear(), db.pendingSyncs.clear(), db.syncMeta.clear(),
      db.orphanBackups.clear(), db.fileSyncMap.clear(), db.memoVersions.clear(),
    ])
  })

  afterEach(() => {
    stopSync()
  })

  it('never uploads the previous account\'s memos into a new account and backs up what was unsynced', async () => {
    // Alice uses the device: one memo reaches her cloud, a folder of hers too.
    await addLocalMemo('a-synced')
    await db.folders.add({
      name: 'alice work', color: '#3B82F6', sortOrder: 9, isDefault: false, isSystem: false,
      syncId: 'a-folder', createdAt: OLD, updatedAt: OLD,
    })
    await initSync('alice', { email: 'alice@example.com' })
    expect(cloudIds('alice')).toContain('a-synced')
    expect(await getLocalOwnerUid()).toBe('alice')

    // She signs out and keeps writing — that memo is queued for her account.
    stopSync()
    await createWhileSignedOut('a-offline')
    expect(await db.pendingSyncs.where('syncId').equals('a-offline').count()).toBe(1)

    // Bob signs in on the same device.
    fsStore.set('users/bob/memos/b-1', cloudMemo({ title: 'bob memo' }))
    await initSync('bob')

    // Nothing of Alice's reached Bob's cloud — not the synced memo, not the queued one,
    // not her folder.
    expect(cloudIds('bob')).toEqual(['b-1'])
    expect(cloudIds('bob', 'folders')).not.toContain('a-folder')
    // Alice's cloud is untouched by the switch (her offline memo waits for her, not Bob).
    expect(cloudIds('alice')).not.toContain('a-offline')

    // Bob's device view is only Bob's data; Alice's queue is gone from the live tables.
    expect(await localSyncIds()).toEqual(['b-1'])
    expect(await db.folders.where('syncId').equals('a-folder').count()).toBe(0)
    expect(await db.pendingSyncs.count()).toBe(0)
    expect(await getLocalOwnerUid()).toBe('bob')

    // Alice's local data is kept as a backup, flagging the memo she never synced.
    const backups = await listOrphanBackups()
    expect(backups).toHaveLength(1)
    expect(backups[0]).toMatchObject({ ownerUid: 'alice', ownerEmail: 'alice@example.com', memoCount: 2, pendingOpCount: 1 })
    expect(backups[0].unsyncedMemoCount).toBeGreaterThanOrEqual(1)
    const stored = await db.orphanBackups.get(backups[0].id)
    expect(stored!.unsyncedMemoSyncIds).toContain('a-offline')
    expect(stored!.data.memos.map((m) => m.syncId).sort()).toEqual(['a-offline', 'a-synced'])

    // …downloadable as a regular, restorable backup file.
    const file = await getOrphanBackupFile(backups[0].id)
    expect(validateBackup(file).valid).toBe(true)
    expect(file!.data.memos.find((m) => m.syncId === 'a-offline')?.body).toBe('written while signed out')
  })

  it('keeps local data for the same account and delivers what was written while signed out', async () => {
    await addLocalMemo('a-1')
    await initSync('alice')
    stopSync()
    await createWhileSignedOut('a-offline')

    await initSync('alice')

    expect(await localSyncIds()).toEqual(['a-1', 'a-offline'])
    expect(cloudIds('alice').sort()).toEqual(['a-1', 'a-offline'])
    expect(await db.pendingSyncs.count()).toBe(0)
    expect(await listOrphanBackups()).toHaveLength(0)
  })

  it('restores an account\'s own snapshot when it signs back in after another account', async () => {
    await initSync('alice')
    stopSync()
    await createWhileSignedOut('a-offline') // never reached Alice's cloud

    await initSync('bob')
    expect(await localSyncIds()).toEqual([])
    stopSync()

    await initSync('alice')

    // Alice's unsynced memo is back on the device and now delivered to HER cloud.
    expect(await localSyncIds()).toEqual(['a-offline'])
    expect(cloudIds('alice')).toContain('a-offline')
    expect(cloudIds('bob')).not.toContain('a-offline')
    // Her snapshot was consumed; Bob had nothing of his own to set aside.
    expect((await listOrphanBackups()).map((b) => b.ownerUid)).not.toContain('alice')
  })

  it('a merge interrupted by an account switch never writes into the new account', async () => {
    // Alice's device has memos her (empty) cloud lacks, so her merge pushes them upward
    // — over a slow network.
    for (const id of ['a-1', 'a-2', 'a-3']) await addLocalMemo(id)
    let release!: () => void
    hold.gate = new Promise<void>((r) => { release = r })
    hold.prefix = 'users/alice/'

    const aliceSync = initSync('alice').catch(() => {})
    await vi.waitFor(() => expect(hold.started).toBeGreaterThan(0))

    // Mid-merge: Alice signs out, Bob signs in.
    stopSync()
    const bobSync = initSync('bob')
    await bobSync
    release()
    await aliceSync

    // With the old module-global uid, the rest of Alice's upward pushes landed in Bob's
    // account. Now every write is bound to the uid it started for.
    for (const id of ['a-1', 'a-2', 'a-3']) {
      expect(fsStore.has(`users/bob/memos/${id}`)).toBe(false)
    }
    expect(await localSyncIds()).toEqual([])
    const backups = await listOrphanBackups()
    expect(backups.map((b) => b.ownerUid)).toEqual(['alice'])
    expect(backups[0].memoCount).toBe(3)
  })

  it('a cloud write captured for one account is never redirected to the next one', async () => {
    await addLocalMemo('a-1')
    await initSync('alice')
    const aliceCtx = currentWriteContext()!
    const memo = (await database.getMemoBySyncId('a-1'))!
    stopSync()
    await initSync('bob')

    // A push that started in Alice's session and only gets to write now.
    expect(await pushMemo({ ...memo, title: 'late write' }, aliceCtx)).toBe(false)
    expect(fsStore.has('users/bob/memos/a-1')).toBe(false)
    expect(fsStore.get('users/alice/memos/a-1')?.title).not.toBe('late write')
  })

  it('a listener still attached for the previous account cannot seed its memos into the new owner\'s data', async () => {
    await initSync('alice')
    const aliceMemoListener = listeners.get('users/alice/memos')!
    expect(aliceMemoListener).toBeTruthy()
    stopSync()
    await initSync('bob')

    const change = { type: 'added', doc: { id: 'a-late', data: () => cloudMemo(), metadata: { hasPendingWrites: false } } }
    await aliceMemoListener({ docChanges: () => [change], metadata: { fromCache: false } })
    // Even a direct apply for Alice (e.g. from another tab) is refused: Bob owns the data.
    expect((await applyRemoteMemo('alice', 'a-late', cloudMemo())).kind).toBe('none')

    expect(await database.getMemoBySyncId('a-late')).toBeUndefined()
  })
})
