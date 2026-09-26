import { describe, it, expect, beforeEach, vi } from 'vitest'
import 'fake-indexeddb/auto'

// Several tabs run their own merge + live listener against the same IndexedDB. Applying
// the same incoming doc from two appliers at once must yield exactly one local row.

vi.mock('@/lib/firebase', () => ({ firestore: {} }))
vi.mock('@/services/settingsSync', () => ({ initSettingsSync: async () => {}, stopSettingsSync: () => {} }))
vi.mock('@/services/syncFolder', () => ({
  notifyMemoSaved: vi.fn(), notifyMemoDeleted: vi.fn(), notifyFolderCreated: vi.fn(),
  notifyFolderRenamed: vi.fn(), notifyFolderDeleted: vi.fn(),
}))
vi.mock('firebase/firestore', () => ({
  collection: () => ({}), doc: () => ({}), getDocs: async () => ({ docs: [] }),
  setDoc: async () => {}, deleteDoc: async () => {}, onSnapshot: () => () => {},
  waitForPendingWrites: async () => {},
}))

import { db } from '@/services/database'
import { applyRemoteMemo } from '@/services/firestoreSync'
import { claimLocalData } from '@/services/localOwner'
import { restoreFromBackup } from '@/services/backup'
import type { BackupFile } from '@/lib/types'

const T1 = '2026-01-01T00:00:00.000Z'
const T2 = '2026-02-01T00:00:00.000Z'

function remoteMemo(fields: Record<string, unknown> = {}) {
  return {
    title: 'incoming', body: 'body', folderSyncId: null, tags: [], isStarred: false,
    color: 'white', isPinned: false, createdAt: T1, updatedAt: T1, deletedAt: null, ...fields,
  }
}

describe('idempotent remote apply', () => {
  beforeEach(async () => {
    await Promise.all([db.memos.clear(), db.folders.clear(), db.syncMeta.clear(), db.orphanBackups.clear()])
    await claimLocalData('u1')
  })

  it('two appliers of the same new doc (merge + listener, or two tabs) insert it once', async () => {
    const results = await Promise.all([
      applyRemoteMemo('u1', 'same-doc', remoteMemo()),
      applyRemoteMemo('u1', 'same-doc', remoteMemo()),
      applyRemoteMemo('u1', 'same-doc', remoteMemo()),
    ])
    expect(await db.memos.where('syncId').equals('same-doc').count()).toBe(1)
    expect(results.filter((r) => r.kind === 'saved')).toHaveLength(1)
  })

  it('concurrent older and newer versions converge on the newer one', async () => {
    await Promise.all([
      applyRemoteMemo('u1', 'doc', remoteMemo({ body: 'v2', updatedAt: T2 })),
      applyRemoteMemo('u1', 'doc', remoteMemo({ body: 'v1', updatedAt: T1 })),
    ])
    const rows = await db.memos.where('syncId').equals('doc').toArray()
    expect(rows).toHaveLength(1)
    expect(rows[0].body).toBe('v2')
  })

  it('an apply racing a removal never resurrects a duplicate', async () => {
    await applyRemoteMemo('u1', 'gone', remoteMemo())
    await Promise.all([
      applyRemoteMemo('u1', 'gone', remoteMemo({ updatedAt: T2 })),
      applyRemoteMemo('u1', 'gone', { tombstone: true, purgedAt: T2, updatedAt: T2 }),
    ])
    expect(await db.memos.where('syncId').equals('gone').count()).toBeLessThanOrEqual(1)
  })
})

describe('backup restore under the unique syncId index', () => {
  beforeEach(async () => {
    await Promise.all([db.memos.clear(), db.folders.clear(), db.memoVersions.clear(), db.pendingSyncs.clear()])
  })

  it('restores a legacy backup that contains duplicate syncIds instead of failing', async () => {
    const backup: BackupFile = {
      version: '1.0.0', appName: 'Memo', exportDate: T2,
      data: {
        folders: [
          { id: 1, name: 'A', color: '#000', sortOrder: 0, isDefault: true, isSystem: false, syncId: 'f', createdAt: T1, updatedAt: T1 },
          { id: 2, name: 'A2', color: '#000', sortOrder: 0, isDefault: true, isSystem: false, syncId: 'f', createdAt: T1, updatedAt: T2 },
        ],
        memos: [
          { id: 10, title: 'x', body: 'old text', folderId: 1, tags: [], isStarred: false, color: 'white', isPinned: false, syncId: 'm', createdAt: T1, updatedAt: T1 },
          { id: 11, title: 'x', body: 'new text', folderId: 1, tags: [], isStarred: false, color: 'white', isPinned: false, syncId: 'm', createdAt: T1, updatedAt: T2 },
        ],
        settings: {},
      },
    }
    const result = await restoreFromBackup(backup)
    expect(result).toEqual({ success: true })
    const memos = await db.memos.where('syncId').equals('m').toArray()
    expect(memos).toHaveLength(1)
    expect(memos[0]).toMatchObject({ id: 11, body: 'new text', folderId: 2 })
    expect(await db.folders.where('syncId').equals('f').count()).toBe(1)
    // The dropped copy's differing text is kept in the survivor's history.
    expect((await db.memoVersions.where('memoId').equals(11).toArray()).map((v) => v.body)).toEqual(['old text'])
  })
})
