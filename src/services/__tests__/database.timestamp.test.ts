import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'

import * as database from '@/services/database'
import { db } from '@/services/database'

// Locks in the last-write-wins timestamp contract that the sync layer depends on
// (findings: recordAccess poisoning updatedAt, remote-apply restamping updatedAt).
describe('database updatedAt contract', () => {
  beforeEach(async () => {
    await db.memos.clear()
    await db.folders.clear()
  })

  it('updateMemo stamps a fresh updatedAt for local edits (no explicit timestamp)', async () => {
    const id = await database.addMemo({
      title: 't', body: 'b', folderId: null, tags: [], isStarred: false,
      color: 'white', isPinned: false, createdAt: '2020-01-01T00:00:00.000Z', updatedAt: '2020-01-01T00:00:00.000Z',
    })
    await database.updateMemo(id, { body: 'edited' })
    const memo = await database.getMemo(id)
    expect(memo?.body).toBe('edited')
    expect(memo?.updatedAt).not.toBe('2020-01-01T00:00:00.000Z')
  })

  it('updateMemo preserves an explicitly-passed updatedAt (remote-apply path)', async () => {
    const id = await database.addMemo({
      title: 't', body: 'b', folderId: null, tags: [], isStarred: false,
      color: 'white', isPinned: false, createdAt: '2020-01-01T00:00:00.000Z', updatedAt: '2020-01-01T00:00:00.000Z',
    })
    const remoteStamp = '2026-05-05T05:05:05.000Z'
    await database.updateMemo(id, { body: 'from-cloud', updatedAt: remoteStamp })
    const memo = await database.getMemo(id)
    // The local replica must adopt the writer's timestamp, not the receiver's clock —
    // otherwise LWW compares sender-vs-receiver and silently drops later remote edits.
    expect(memo?.updatedAt).toBe(remoteStamp)
  })

  it('updateMemoLocalMeta never advances updatedAt (accessLog telemetry)', async () => {
    const stamp = '2021-03-03T03:03:03.000Z'
    const id = await database.addMemo({
      title: 't', body: 'b', folderId: null, tags: [], isStarred: false,
      color: 'white', isPinned: false, createdAt: stamp, updatedAt: stamp,
    })
    await database.updateMemoLocalMeta(id, { accessLog: [{ timestamp: '2026-01-01T00:00:00.000Z' }] })
    const memo = await database.getMemo(id)
    expect(memo?.accessLog?.length).toBe(1)
    // Merely recording a view must NOT bump updatedAt (would reject newer remote edits).
    expect(memo?.updatedAt).toBe(stamp)
  })

  it('updateFolder preserves an explicitly-passed updatedAt', async () => {
    const id = await database.addFolder({
      name: 'f', color: 'red', sortOrder: 0, isDefault: false, isSystem: false,
      syncId: 's', createdAt: '2020-01-01T00:00:00.000Z', updatedAt: '2020-01-01T00:00:00.000Z',
    })
    const remoteStamp = '2026-06-06T06:06:06.000Z'
    await database.updateFolder(id, { name: 'renamed', updatedAt: remoteStamp })
    const folder = await database.getFolder(id)
    expect(folder?.name).toBe('renamed')
    expect(folder?.updatedAt).toBe(remoteStamp)
  })
})
