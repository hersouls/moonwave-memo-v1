import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import 'fake-indexeddb/auto'

// In-memory Firestore backing store, shared between the mock and the test body.
const { fsStore } = vi.hoisted(() => ({
  fsStore: new Map<string, Record<string, unknown>>(),
}))

// Avoid initialising the real Firebase app (needs runtime config).
vi.mock('@/lib/firebase', () => ({ firestore: {} }))

// Settings sync touches Firestore too; stub it out for this unit.
vi.mock('@/services/settingsSync', () => ({
  initSettingsSync: async () => {},
  stopSettingsSync: () => {},
}))

// Minimal in-memory Firestore implementing only the surface firestoreSync uses.
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
        if (rest.includes('/')) continue // only direct children of the collection
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
    onSnapshot: () => () => {},
  }
})

import * as database from '@/services/database'
import { db } from '@/services/database'
import { initSync, stopSync } from '@/services/firestoreSync'
import { DEFAULT_FOLDERS, SYSTEM_FOLDERS } from '@/utils/constants'

const PAST = '2025-01-01T00:00:00.000Z'

// Seed the local DB exactly like a fresh post-fix install (canonical syncIds).
async function seedFreshDevice() {
  const all = [...DEFAULT_FOLDERS, ...SYSTEM_FOLDERS]
  for (let i = 0; i < all.length; i++) {
    const f = all[i]
    await db.folders.add({
      name: f.name,
      color: f.color,
      sortOrder: i,
      isDefault: f.isDefault,
      isSystem: f.isSystem,
      syncId: f.syncId,
      createdAt: PAST,
      updatedAt: PAST,
    })
  }
}

function putCloudFolder(
  uid: string,
  syncId: string,
  data: { name: string; color: string; isDefault?: boolean; isSystem?: boolean; sortOrder?: number }
) {
  fsStore.set(`users/${uid}/folders/${syncId}`, {
    name: data.name,
    color: data.color,
    sortOrder: data.sortOrder ?? 0,
    isDefault: data.isDefault ?? false,
    isSystem: data.isSystem ?? false,
    createdAt: PAST,
    updatedAt: PAST,
  })
}

function putCloudMemo(uid: string, syncId: string, data: { title?: string; folderSyncId: string | null }) {
  fsStore.set(`users/${uid}/memos/${syncId}`, {
    title: data.title ?? '',
    body: '',
    folderSyncId: data.folderSyncId,
    tags: [],
    isStarred: false,
    color: 'white',
    isPinned: false,
    createdAt: PAST,
    updatedAt: PAST,
  })
}

function countByName(folders: { name: string }[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const f of folders) out[f.name] = (out[f.name] ?? 0) + 1
  return out
}

describe('firestoreSync seed-folder duplication', () => {
  beforeEach(async () => {
    fsStore.clear()
    await db.folders.clear()
    await db.memos.clear()
  })

  afterEach(() => {
    stopSync()
  })

  it('does not duplicate seed folders when a new device logs into an account whose cloud folders use legacy random syncIds', async () => {
    const uid = 'user-legacy'
    await seedFreshDevice()

    // Original device pushed its seed folders with random, device-specific syncIds.
    putCloudFolder(uid, 'rand-mymemos', { name: '내 메모', color: '#F59E0B', isDefault: true })
    putCloudFolder(uid, 'rand-scrap', { name: '스크랩', color: '#84CC16' })
    putCloudFolder(uid, 'rand-idea', { name: '아이디어', color: '#22C55E' })
    putCloudFolder(uid, 'rand-shopping', { name: '쇼핑', color: '#06B6D4' })
    putCloudFolder(uid, 'rand-trash', { name: '삭제된 메모', color: '#A1A1AA', isSystem: true })

    await initSync(uid)

    const folders = await database.getAllFolders()
    expect(folders).toHaveLength(5)

    const byName = countByName(folders)
    expect(byName['내 메모']).toBe(1)
    expect(byName['스크랩']).toBe(1)
    expect(byName['아이디어']).toBe(1)
    expect(byName['쇼핑']).toBe(1)
    expect(byName['삭제된 메모']).toBe(1)

    expect(folders.filter((f) => f.isDefault)).toHaveLength(1)
    expect(folders.filter((f) => f.isSystem)).toHaveLength(1)

    // The pristine local seeds adopted the cloud's syncIds (unified identity).
    expect(folders.find((f) => f.name === '내 메모')?.syncId).toBe('rand-mymemos')
    expect(folders.find((f) => f.name === '스크랩')?.syncId).toBe('rand-scrap')
  })

  it('matches directly by canonical syncId when both devices run the fixed version', async () => {
    const uid = 'user-canonical'
    await seedFreshDevice()

    for (const f of [...DEFAULT_FOLDERS, ...SYSTEM_FOLDERS]) {
      putCloudFolder(uid, f.syncId, {
        name: f.name,
        color: f.color,
        isDefault: f.isDefault,
        isSystem: f.isSystem,
      })
    }

    await initSync(uid)

    const folders = await database.getAllFolders()
    expect(folders).toHaveLength(5)
    expect(folders.filter((f) => f.isDefault)).toHaveLength(1)
    expect(folders.filter((f) => f.isSystem)).toHaveLength(1)
  })

  it('collapses pre-existing duplicate default folders and preserves their memos', async () => {
    const uid = 'user-dup'
    await seedFreshDevice()

    // Account already corrupted: two default "내 메모" folders in the cloud.
    putCloudFolder(uid, 'd-aaa', { name: '내 메모', color: '#F59E0B', isDefault: true })
    putCloudFolder(uid, 'd-bbb', { name: '내 메모', color: '#F59E0B', isDefault: true })
    putCloudFolder(uid, 's-111', { name: '스크랩', color: '#84CC16' })
    putCloudFolder(uid, 'i-222', { name: '아이디어', color: '#22C55E' })
    putCloudFolder(uid, 'p-333', { name: '쇼핑', color: '#06B6D4' })
    putCloudFolder(uid, 't-999', { name: '삭제된 메모', color: '#A1A1AA', isSystem: true })
    // A memo lives in the duplicate default that will be removed.
    putCloudMemo(uid, 'memo-1', { title: 'hi', folderSyncId: 'd-bbb' })

    await initSync(uid)

    const folders = await database.getAllFolders()

    // Exactly one default survives, and no duplicate "내 메모" remains.
    const defaults = folders.filter((f) => f.isDefault)
    expect(defaults).toHaveLength(1)
    expect(countByName(folders)['내 메모']).toBe(1)

    // Deterministic survivor = smallest syncId among {d-aaa, d-bbb}.
    const survivor = defaults[0]
    expect(survivor.syncId).toBe('d-aaa')

    // The orphaned memo was re-homed onto the survivor, not lost.
    const memo = await database.getMemoBySyncId('memo-1')
    expect(memo).toBeTruthy()
    expect(memo?.folderId).toBe(survivor.id)

    // Cloud was cleaned: duplicate folder gone, memo repointed to the survivor.
    expect(fsStore.has(`users/${uid}/folders/d-bbb`)).toBe(false)
    expect((fsStore.get(`users/${uid}/memos/memo-1`) as Record<string, unknown>).folderSyncId).toBe('d-aaa')
  })

  it('preserves a user folder that shares a seed name+colour instead of merging it into the seed', async () => {
    const uid = 'user-seed-collide'
    await seedFreshDevice()

    // The user created their own "쇼핑" folder in the seed's exact colour (the seed palette
    // is user-selectable), and it already carries a memo. It must never be swept into the
    // canonical seed and hard-deleted across devices.
    const userFolderId = (await db.folders.add({
      name: '쇼핑', color: '#06B6D4', sortOrder: 10,
      isDefault: false, isSystem: false, syncId: 'user-shopping',
      createdAt: PAST, updatedAt: PAST,
    })) as unknown as number
    await db.memos.add({
      title: '장보기', body: '', folderId: userFolderId, tags: [],
      isStarred: false, color: 'white', isPinned: false, syncId: 'memo-u',
      createdAt: PAST, updatedAt: PAST,
    })

    // Cloud holds the canonical seeds AND the user's folder as distinct identities.
    for (const f of [...DEFAULT_FOLDERS, ...SYSTEM_FOLDERS]) {
      putCloudFolder(uid, f.syncId, { name: f.name, color: f.color, isDefault: f.isDefault, isSystem: f.isSystem })
    }
    putCloudFolder(uid, 'user-shopping', { name: '쇼핑', color: '#06B6D4' })
    putCloudMemo(uid, 'memo-u', { folderSyncId: 'user-shopping' })

    await initSync(uid)

    const folders = await database.getAllFolders()
    // Both the canonical seed 쇼핑 and the user's 쇼핑 survive — no silent merge/delete.
    expect(countByName(folders)['쇼핑']).toBe(2)
    expect(folders.find((f) => f.syncId === 'user-shopping')).toBeTruthy()
    expect(folders.find((f) => f.syncId === 'seed-default-shopping')).toBeTruthy()

    // The user's memo stays in the user's folder (not re-homed onto the seed).
    const userFolder = folders.find((f) => f.syncId === 'user-shopping')!
    const memo = await database.getMemoBySyncId('memo-u')
    expect(memo?.folderId).toBe(userFolder.id)

    // And the user's folder was not hard-deleted from the cloud.
    expect(fsStore.has(`users/${uid}/folders/user-shopping`)).toBe(true)
  })
})
