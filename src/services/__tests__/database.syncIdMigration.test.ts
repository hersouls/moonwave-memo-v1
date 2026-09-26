import { describe, it, expect, beforeAll } from 'vitest'
import 'fake-indexeddb/auto'
import Dexie from 'dexie'

// Dexie v10/v11: duplicates by syncId (two tabs applying one incoming change, earlier
// bugs) are collapsed without losing anything attached to them, and syncId becomes a
// unique index that still admits rows without a syncId.
//
// The app DB is seeded at v9 BEFORE the database module is imported, so the real
// MemoDatabase opens it and runs the upgrade path users will run.

const V9_STORES = {
  memos: '++id, folderId, isStarred, isPinned, createdAt, updatedAt, deletedAt, syncId, *tags',
  folders: '++id, name, isDefault, isSystem, sortOrder, syncId',
  memoImages: '++id, memoId, syncId, createdAt',
  memoVersions: '++id, memoId, createdAt',
  ambientImages: '++id, type, generatedAt, expiresAt',
  demianChats: '++id, &memoId, updatedAt',
  pendingSyncs: '++id, type, syncId, createdAt',
  fileSyncMap: '&memoSyncId, filePath',
  syncFolderKV: '&key',
  pendingFileOps: '++id, targetKey, nextRetryAt, [targetKey+filePath]',
  embeddings: '&memoId',
}

const T1 = '2026-01-01T00:00:00.000Z'
const T2 = '2026-02-01T00:00:00.000Z'

function memo(fields: Record<string, unknown>) {
  return {
    title: 't', body: 'b', folderId: null, tags: [], isStarred: false, color: 'white',
    isPinned: false, createdAt: T1, updatedAt: T1, ...fields,
  }
}

const ids = {} as Record<string, number>

beforeAll(async () => {
  const legacy = new Dexie('MemoApp')
  legacy.version(9).stores(V9_STORES)
  await legacy.open()
  const folders = legacy.table('folders')
  const memos = legacy.table('memos')
  ids.fOld = await folders.add({ name: 'Work', color: '#3B82F6', sortOrder: 1, isDefault: false, isSystem: false, syncId: 'f-dup', createdAt: T1, updatedAt: T1 }) as number
  ids.fNew = await folders.add({ name: 'Work (renamed)', color: '#3B82F6', sortOrder: 1, isDefault: false, isSystem: false, syncId: 'f-dup', createdAt: T1, updatedAt: T2 }) as number
  ids.fBlank = await folders.add({ name: 'blank id', color: '#3B82F6', sortOrder: 2, isDefault: false, isSystem: false, syncId: '', createdAt: T1, updatedAt: T1 }) as number

  // Two copies of one cloud memo: the stale one has other text and owns child rows.
  ids.mStale = await memos.add(memo({ syncId: 'm-dup', body: 'stale words', folderId: ids.fOld, updatedAt: T1 })) as number
  ids.mFresh = await memos.add(memo({ syncId: 'm-dup', body: 'fresh words', folderId: ids.fOld, updatedAt: T2 })) as number
  ids.mSame1 = await memos.add(memo({ syncId: 'm-same', body: 'same' })) as number
  ids.mSame2 = await memos.add(memo({ syncId: 'm-same', body: 'same' })) as number
  ids.mOk = await memos.add(memo({ syncId: 'm-ok' })) as number
  ids.mNoId1 = await memos.add(memo({})) as number
  ids.mNoId2 = await memos.add(memo({})) as number
  ids.mBlank1 = await memos.add(memo({ syncId: '' })) as number
  ids.mBlank2 = await memos.add(memo({ syncId: '' })) as number

  await legacy.table('memoImages').add({ memoId: ids.mStale, syncId: 'img-1', data: 'data:,', filename: 'a.png', width: 1, height: 1, size: 1, createdAt: T1 })
  await legacy.table('memoVersions').add({ memoId: ids.mStale, title: 't', body: 'older history', createdAt: T1 })
  await legacy.table('demianChats').add({ memoId: ids.mStale, messages: [{ role: 'user', content: 'from stale' }], updatedAt: T1 })
  await legacy.table('demianChats').add({ memoId: ids.mFresh, messages: [{ role: 'user', content: 'from fresh' }], updatedAt: T2 })
  await legacy.table('embeddings').add({ memoId: ids.mStale, updatedAt: T1, vector: [1] })
  legacy.close()
})

describe('v10/v11 migration: unique syncId', () => {
  it('opens a v9 database that contains duplicates', async () => {
    const { db } = await import('@/services/database')
    await db.open()
    expect(db.verno).toBe(11)
    expect(db.memos.schema.idxByName.syncId.unique).toBe(true)
    expect(db.folders.schema.idxByName.syncId.unique).toBe(true)
  })

  it('keeps the newest copy of a duplicated folder and re-points its memos', async () => {
    const { db } = await import('@/services/database')
    const dup = await db.folders.where('syncId').equals('f-dup').toArray()
    expect(dup.map((f) => f.id)).toEqual([ids.fNew])
    const moved = await db.memos.where('folderId').equals(ids.fOld).count()
    expect(moved).toBe(0)
    expect((await db.memos.where('syncId').equals('m-dup').first())?.folderId).toBe(ids.fNew)
    // An unusable '' syncId is cleared (the next merge backfills a real one).
    expect((await db.folders.get(ids.fBlank))?.syncId).toBeUndefined()
  })

  it('keeps the newest copy of a duplicated memo without losing the stale copy\'s text or attachments', async () => {
    const { db } = await import('@/services/database')
    const dup = await db.memos.where('syncId').equals('m-dup').toArray()
    expect(dup.map((m) => m.id)).toEqual([ids.mFresh])
    expect(dup[0].body).toBe('fresh words')
    expect(await db.memos.get(ids.mStale)).toBeUndefined()

    const versions = await db.memoVersions.where('memoId').equals(ids.mFresh).toArray()
    expect(versions.map((v) => v.body).sort()).toEqual(['older history', 'stale words'])
    expect((await db.memoImages.where('memoId').equals(ids.mFresh).toArray()).map((i) => i.syncId)).toEqual(['img-1'])
    const chats = await db.demianChats.where('memoId').equals(ids.mFresh).toArray()
    expect(chats).toHaveLength(1)
    expect(chats[0].messages.map((m) => m.content)).toEqual(['from fresh', 'from stale'])
    expect(await db.embeddings.get(ids.mStale)).toBeUndefined()

    // Identical duplicates collapse to the oldest row, with no spurious version.
    const same = await db.memos.where('syncId').equals('m-same').toArray()
    expect(same.map((m) => m.id)).toEqual([ids.mSame1])
    expect(await db.memoVersions.where('memoId').equals(ids.mSame1).count()).toBe(0)
  })

  it('still admits memos without a syncId, and rejects a second row with the same syncId', async () => {
    const { db } = await import('@/services/database')
    expect(await db.memos.get(ids.mNoId1)).toBeTruthy()
    expect(await db.memos.get(ids.mNoId2)).toBeTruthy()
    expect((await db.memos.get(ids.mBlank1))?.syncId).toBeUndefined()
    expect((await db.memos.get(ids.mBlank2))?.syncId).toBeUndefined()

    await db.memos.add(memo({}) as never)
    await db.memos.add(memo({}) as never)
    await expect(db.memos.add(memo({ syncId: 'm-ok' }) as never)).rejects.toMatchObject({ name: 'ConstraintError' })
    await expect(db.folders.add({ name: 'x', color: '#000', sortOrder: 0, isDefault: false, isSystem: false, syncId: 'f-dup', createdAt: T1, updatedAt: T1 }))
      .rejects.toMatchObject({ name: 'ConstraintError' })
  })
})

describe('why the dedupe runs one version before the unique index', () => {
  it('declaring &syncId in the same version as the dedupe upgrade fails to open', async () => {
    const seed = new Dexie('OrderingProbe')
    seed.version(1).stores({ items: '++id, syncId' })
    await seed.open()
    await seed.table('items').bulkAdd([{ syncId: 'x' }, { syncId: 'x' }])
    seed.close()

    // Dexie creates a version's indexes before running its upgrade(), so the unique index
    // meets the duplicates first and the whole upgrade aborts.
    const sameVersion = new Dexie('OrderingProbe')
    sameVersion.version(1).stores({ items: '++id, syncId' })
    sameVersion.version(2).stores({ items: '++id, &syncId' }).upgrade(async (tx) => {
      const rows = await tx.table('items').toArray()
      await tx.table('items').bulkDelete(rows.slice(1).map((r) => r.id))
    })
    await expect(sameVersion.open()).rejects.toBeTruthy()
    sameVersion.close()

    const split = new Dexie('OrderingProbe')
    split.version(1).stores({ items: '++id, syncId' })
    split.version(2).stores({ items: '++id, syncId' }).upgrade(async (tx) => {
      const rows = await tx.table('items').toArray()
      await tx.table('items').bulkDelete(rows.slice(1).map((r) => r.id))
    })
    split.version(3).stores({ items: '++id, &syncId' })
    await split.open()
    expect(await split.table('items').count()).toBe(1)
    split.close()
  })
})
