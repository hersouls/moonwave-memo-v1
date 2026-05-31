import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore'
import { firestore } from '@/lib/firebase'
import type { Memo, Folder } from '@/lib/types'
import * as database from './database'
import { generateSyncId } from '@/utils/id'
import { DEFAULT_FOLDERS, SYSTEM_FOLDERS } from '@/utils/constants'
import { useToastStore } from '@/stores/toastStore'

// Canonical seed folders shipped with the app. They share a stable syncId across
// every device, so sync can recognise them as the same folder instead of cloning.
const ALL_SEED_FOLDERS = [...DEFAULT_FOLDERS, ...SYSTEM_FOLDERS]
const SEED_SYNC_IDS = new Set<string>(ALL_SEED_FOLDERS.map((s) => s.syncId))
const CANONICAL_DEFAULT_SYNC_ID = DEFAULT_FOLDERS.find((s) => s.isDefault)!.syncId
const CANONICAL_SYSTEM_SYNC_ID = SYSTEM_FOLDERS[0].syncId

let unsubMemos: Unsubscribe | null = null
let unsubFolders: Unsubscribe | null = null
let currentUserId: string | null = null
let refreshMemos: (() => Promise<void>) | null = null
let refreshFolders: (() => Promise<void>) | null = null

const recentlyPushed = new Set<string>()
const recentlyPushedTimers = new Map<string, ReturnType<typeof setTimeout>>()
let mergePromise: Promise<void> | null = null

function scheduleRecentlyPushedCleanup(key: string) {
  if (recentlyPushedTimers.has(key)) clearTimeout(recentlyPushedTimers.get(key)!)
  recentlyPushedTimers.set(key, setTimeout(() => {
    recentlyPushed.delete(key)
    recentlyPushedTimers.delete(key)
  }, 5000))
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Sync push timed out')), ms)
    ),
  ])
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = value
    }
  }
  return result as Partial<T>
}

export function registerRefreshCallbacks(
  memoRefresh: () => Promise<void>,
  folderRefresh: () => Promise<void>
) {
  refreshMemos = memoRefresh
  refreshFolders = folderRefresh
}

// ─── Folder syncId ↔ local ID resolution ──────────

async function resolveFolderSyncId(folderSyncId: string | null | undefined): Promise<number | null> {
  if (!folderSyncId) return null
  const folder = await database.getFolderBySyncId(folderSyncId)
  return folder?.id ?? null
}

async function getFolderSyncId(folderId: number | null): Promise<string | null> {
  if (folderId == null) return null
  const folder = await database.getFolder(folderId)
  return folder?.syncId ?? null
}

// ─── Push to Firestore ────────────────────────────

export async function pushMemo(memo: Memo) {
  if (!currentUserId || !memo.syncId) return
  try {
    recentlyPushed.add(`memo-${memo.syncId}`)
    const folderSyncId = await getFolderSyncId(memo.folderId)
    const ref = doc(firestore, `users/${currentUserId}/memos`, memo.syncId)
    await setDoc(ref, stripUndefined({
      title: memo.title,
      body: memo.body,
      folderSyncId,
      tags: memo.tags,
      isStarred: memo.isStarred,
      color: memo.color,
      isPinned: memo.isPinned,
      createdAt: memo.createdAt,
      updatedAt: memo.updatedAt,
      deletedAt: memo.deletedAt || null,
    }), { merge: true })
    scheduleRecentlyPushedCleanup(`memo-${memo.syncId}`)
  } catch (err) {
    recentlyPushed.delete(`memo-${memo.syncId}`)
    if (!navigator.onLine && memo.syncId) {
      import('./offlineQueue').then(({ enqueueSync }) => enqueueSync('memo', 'upsert', memo.syncId!))
    } else {
      console.error('Push memo failed:', err)
      useToastStore.getState().showToast('메모 동기화에 실패했습니다', 'warning')
    }
  }
}

export async function pushFolder(folder: Folder) {
  if (!currentUserId || !folder.syncId) return
  try {
    recentlyPushed.add(`folder-${folder.syncId}`)
    const ref = doc(firestore, `users/${currentUserId}/folders`, folder.syncId)
    await setDoc(ref, stripUndefined({
      name: folder.name,
      color: folder.color,
      sortOrder: folder.sortOrder,
      isDefault: folder.isDefault,
      isSystem: folder.isSystem,
      createdAt: folder.createdAt,
      updatedAt: folder.updatedAt,
    }), { merge: true })
    scheduleRecentlyPushedCleanup(`folder-${folder.syncId}`)
  } catch (err) {
    console.error('Push folder failed:', err)
    recentlyPushed.delete(`folder-${folder.syncId}`)
  }
}

// ─── Delete from Firestore ────────────────────────

export async function deleteMemoFromCloud(syncId: string) {
  if (!currentUserId || !syncId) return
  try {
    recentlyPushed.add(`memo-${syncId}`)
    await deleteDoc(doc(firestore, `users/${currentUserId}/memos`, syncId))
    scheduleRecentlyPushedCleanup(`memo-${syncId}`)
  } catch (err) {
    console.error('Delete memo from cloud failed:', err)
    recentlyPushed.delete(`memo-${syncId}`)
  }
}

export async function deleteFolderFromCloud(syncId: string) {
  if (!currentUserId || !syncId) return
  try {
    recentlyPushed.add(`folder-${syncId}`)
    await deleteDoc(doc(firestore, `users/${currentUserId}/folders`, syncId))
    scheduleRecentlyPushedCleanup(`folder-${syncId}`)
  } catch (err) {
    console.error('Delete folder from cloud failed:', err)
    recentlyPushed.delete(`folder-${syncId}`)
  }
}

// ─── Initial Merge ─────────────────────────────────

async function initialMerge(userId: string) {
  if (mergePromise) return mergePromise
  mergePromise = doInitialMerge(userId)
  return mergePromise
}

async function doInitialMerge(userId: string) {

  try {
    // Patch local folders missing updatedAt (legacy fix)
    const allLocalFolders = await database.getAllFolders()
    for (const f of allLocalFolders) {
      if (!f.updatedAt) {
        await database.updateFolder(f.id!, {})
      }
    }

    // Merge folders first (memos reference folders)
    const folderSnap = await getDocs(collection(firestore, `users/${userId}/folders`))

    // A freshly-installed device holds pristine seed folders that still carry their
    // canonical syncIds. Match incoming cloud folders to those seeds by identity
    // (flag for the singleton default/trash folders, name for the rest) and adopt the
    // cloud's syncId, so the two devices unify on one folder instead of duplicating.
    const localBeforeMerge = await database.getAllFolders()
    const claimedSeedIds = new Set<number>()

    for (const docSnap of folderSnap.docs) {
      const remote = docSnap.data()
      const syncId = docSnap.id
      const local = await database.getFolderBySyncId(syncId)

      if (!local) {
        const seedMatch = localBeforeMerge.find((f) =>
          f.id != null &&
          !claimedSeedIds.has(f.id) &&
          SEED_SYNC_IDS.has(f.syncId ?? '') &&
          (remote.isSystem
            ? f.isSystem
            : remote.isDefault
              ? f.isDefault
              : !f.isDefault && !f.isSystem && f.name === remote.name)
        )

        if (seedMatch?.id != null) {
          claimedSeedIds.add(seedMatch.id)
          await database.updateFolder(seedMatch.id, {
            syncId,
            name: remote.name,
            color: remote.color,
            sortOrder: remote.sortOrder ?? seedMatch.sortOrder,
          })
          continue
        }

        await database.addFolder({
          name: remote.name,
          color: remote.color,
          sortOrder: remote.sortOrder ?? 0,
          isDefault: remote.isDefault ?? false,
          isSystem: remote.isSystem ?? false,
          syncId,
          createdAt: remote.createdAt || new Date().toISOString(),
          updatedAt: remote.updatedAt || new Date().toISOString(),
        })
      } else if (remote.updatedAt && (!local.updatedAt || remote.updatedAt > local.updatedAt)) {
        await database.updateFolder(local.id!, {
          name: remote.name,
          color: remote.color,
          sortOrder: remote.sortOrder,
        })
      }
    }

    // Push local folders without cloud copy + re-push legacy data
    const localFolders = await database.getAllFolders()
    for (const folder of localFolders) {
      if (!folder.syncId) {
        folder.syncId = generateSyncId()
        await database.updateFolder(folder.id!, { syncId: folder.syncId })
      }
      const cloudDoc = folderSnap.docs.find((d) => d.id === folder.syncId)
      if (!cloudDoc) {
        await withTimeout(pushFolder(folder), 10_000).catch(console.error)
      } else {
        const remote = cloudDoc.data()
        if (!remote.updatedAt) {
          await withTimeout(pushFolder(folder), 10_000).catch(console.error)
        }
      }
    }

    // Merge memos
    const memoSnap = await getDocs(collection(firestore, `users/${userId}/memos`))
    for (const docSnap of memoSnap.docs) {
      const remote = docSnap.data()
      const syncId = docSnap.id
      const local = await database.getMemoBySyncId(syncId)

      // Resolve folderSyncId → local folderId (with legacy fallback)
      const folderId = remote.folderSyncId
        ? await resolveFolderSyncId(remote.folderSyncId)
        : (remote.folderId ?? null)

      if (!local) {
        await database.addMemo({
          title: remote.title || '',
          body: remote.body || '',
          folderId,
          tags: remote.tags || [],
          isStarred: remote.isStarred ?? false,
          color: remote.color || 'white',
          isPinned: remote.isPinned ?? false,
          syncId,
          createdAt: remote.createdAt || new Date().toISOString(),
          updatedAt: remote.updatedAt || new Date().toISOString(),
          deletedAt: remote.deletedAt || undefined,
        })
      } else if (remote.updatedAt && remote.updatedAt > local.updatedAt) {
        await database.updateMemo(local.id!, {
          title: remote.title,
          body: remote.body,
          folderId,
          tags: remote.tags || [],
          isStarred: remote.isStarred,
          color: remote.color,
          isPinned: remote.isPinned,
          deletedAt: remote.deletedAt || undefined,
        })
      }
    }

    // Push local memos without cloud copy + migrate legacy folderId
    const localMemos = await database.getAllMemos()
    for (const memo of localMemos) {
      if (!memo.syncId) {
        memo.syncId = generateSyncId()
        await database.updateMemo(memo.id!, { syncId: memo.syncId })
      }
      const cloudDoc = memoSnap.docs.find((d) => d.id === memo.syncId)
      if (!cloudDoc) {
        await withTimeout(pushMemo(memo), 10_000).catch(console.error)
      } else {
        const remote = cloudDoc.data()
        if (memo.folderId != null && !remote.folderSyncId) {
          await withTimeout(pushMemo(memo), 10_000).catch(console.error)
        }
      }
    }

    // Collapse any duplicate seed folders left behind by earlier buggy syncs
    await dedupeSeedFolders()

    if (refreshFolders) await refreshFolders()
    if (refreshMemos) await refreshMemos()
  } finally {
    mergePromise = null
  }
}

// ─── Seed folder de-duplication ────────────────────
//
// Earlier builds seeded the default/system folders with a random per-device syncId,
// so logging in on a new device cloned them. This collapses any such duplicates that
// already reached an account: it keeps one folder per seed identity, moves the
// duplicates' memos onto the survivor, then removes the empty duplicates locally and
// from the cloud. It runs on every initial merge, so all devices converge on the same
// survivor deterministically. When nothing is duplicated it is a cheap no-op.
async function dedupeSeedFolders() {
  const folders = await database.getAllFolders()

  const groups: { members: Folder[]; canonicalSyncId: string }[] = []

  // Singleton folders: exactly one default and one trash folder must exist. A renamed
  // default is still caught here because it is matched by flag, not by name.
  const defaults = folders.filter((f) => f.isDefault)
  if (defaults.length > 1) {
    groups.push({ members: defaults, canonicalSyncId: CANONICAL_DEFAULT_SYNC_ID })
  }
  const systems = folders.filter((f) => f.isSystem)
  if (systems.length > 1) {
    groups.push({ members: systems, canonicalSyncId: CANONICAL_SYSTEM_SYNC_ID })
  }

  // Named seed folders (스크랩/아이디어/쇼핑): only collapse folders that still match the
  // seed template exactly (name + colour, ordinary flags), so a user's own folder that
  // merely shares a name is never merged away.
  for (const seed of DEFAULT_FOLDERS) {
    if (seed.isDefault || seed.isSystem) continue
    const members = folders.filter(
      (f) => !f.isDefault && !f.isSystem && f.name === seed.name && f.color === seed.color
    )
    if (members.length > 1) {
      groups.push({ members, canonicalSyncId: seed.syncId })
    }
  }

  for (const { members, canonicalSyncId } of groups) {
    // Deterministic survivor so every device keeps the same one: prefer the canonical
    // syncId, otherwise the lexicographically smallest (syncId is globally consistent).
    const sorted = [...members].sort((a, b) => {
      const sa = a.syncId ?? ''
      const sb = b.syncId ?? ''
      return sa < sb ? -1 : sa > sb ? 1 : 0
    })
    const survivor = sorted.find((f) => f.syncId === canonicalSyncId) ?? sorted[0]
    if (survivor?.id == null) continue

    for (const loser of members) {
      if (loser.id == null || loser.id === survivor.id) continue

      // Re-home the duplicate's memos onto the survivor, then push the moved memos so the
      // cloud copies reference the survivor's folder instead of the one we delete.
      const moved = await database.getMemosByFolderId(loser.id)
      await database.moveMemosToFolder(loser.id, survivor.id)
      for (const m of moved) {
        const fresh = m.id != null ? await database.getMemo(m.id) : undefined
        if (fresh) await pushMemo(fresh)
      }

      await database.removeFolderRecord(loser.id)
      if (loser.syncId) await deleteFolderFromCloud(loser.syncId)
    }
  }
}

// ─── Real-time Listeners ───────────────────────────

function startListeners(userId: string) {
  // Clean up existing listeners before re-subscribing
  if (unsubMemos) { unsubMemos(); unsubMemos = null }
  if (unsubFolders) { unsubFolders(); unsubFolders = null }

  unsubMemos = onSnapshot(
    collection(firestore, `users/${userId}/memos`),
    async (snapshot) => {
      if (mergePromise) await mergePromise

      try {
        for (const change of snapshot.docChanges()) {
          const syncId = change.doc.id
          if (recentlyPushed.has(`memo-${syncId}`)) continue

          const remote = change.doc.data()

          if (change.type === 'added' || change.type === 'modified') {
            const local = await database.getMemoBySyncId(syncId)
            // Resolve folderSyncId → local folderId (with legacy fallback)
            const folderId = remote.folderSyncId
              ? await resolveFolderSyncId(remote.folderSyncId)
              : (remote.folderId ?? null)

            if (!local) {
              await database.addMemo({
                title: remote.title || '',
                body: remote.body || '',
                folderId,
                tags: remote.tags || [],
                isStarred: remote.isStarred ?? false,
                color: remote.color || 'white',
                isPinned: remote.isPinned ?? false,
                syncId,
                createdAt: remote.createdAt || new Date().toISOString(),
                updatedAt: remote.updatedAt || new Date().toISOString(),
                deletedAt: remote.deletedAt || undefined,
              })
            } else if (remote.updatedAt && remote.updatedAt > local.updatedAt) {
              await database.updateMemo(local.id!, {
                title: remote.title,
                body: remote.body,
                folderId,
                tags: remote.tags || [],
                isStarred: remote.isStarred,
                color: remote.color,
                isPinned: remote.isPinned,
                deletedAt: remote.deletedAt || undefined,
              })
            }
          }

          if (change.type === 'removed') {
            const local = await database.getMemoBySyncId(syncId)
            if (local) {
              await database.permanentDeleteMemo(local.id!)
            }
          }
        }

        if (refreshMemos) await refreshMemos()
      } catch (err) {
        console.error('Memo sync listener error:', err)
      }
    },
    (err) => {
      console.error('Memo snapshot listener failed:', err)
      useToastStore.getState().showToast('메모 동기화 연결이 끊어졌습니다', 'warning')
    }
  )

  unsubFolders = onSnapshot(
    collection(firestore, `users/${userId}/folders`),
    async (snapshot) => {
      if (mergePromise) await mergePromise

      try {
        for (const change of snapshot.docChanges()) {
          const syncId = change.doc.id
          if (recentlyPushed.has(`folder-${syncId}`)) continue

          const remote = change.doc.data()

          if (change.type === 'added' || change.type === 'modified') {
            const local = await database.getFolderBySyncId(syncId)

            // Never clone the singleton default/trash folder: if one already exists
            // under a different syncId, skip this change and let the next initial merge
            // reconcile the identities deterministically.
            if (!local && (remote.isDefault || remote.isSystem)) {
              const existingSingleton = (await database.getAllFolders()).find((f) =>
                remote.isSystem ? f.isSystem : f.isDefault
              )
              if (existingSingleton) continue
            }

            if (!local) {
              await database.addFolder({
                name: remote.name,
                color: remote.color,
                sortOrder: remote.sortOrder ?? 0,
                isDefault: remote.isDefault ?? false,
                isSystem: remote.isSystem ?? false,
                syncId,
                createdAt: remote.createdAt || new Date().toISOString(),
                updatedAt: remote.updatedAt || new Date().toISOString(),
              })
            } else if (remote.updatedAt && (!local.updatedAt || remote.updatedAt > local.updatedAt)) {
              await database.updateFolder(local.id!, {
                name: remote.name,
                color: remote.color,
                sortOrder: remote.sortOrder,
              })
            }
          }

          if (change.type === 'removed') {
            const local = await database.getFolderBySyncId(syncId)
            if (local && !local.isDefault && !local.isSystem) {
              await database.deleteFolder(local.id!)
            }
          }
        }

        if (refreshFolders) await refreshFolders()
      } catch (err) {
        console.error('Folder sync listener error:', err)
      }
    },
    (err) => {
      console.error('Folder snapshot listener failed:', err)
      useToastStore.getState().showToast('폴더 동기화 연결이 끊어졌습니다', 'warning')
    }
  )
}

// ─── Init / Stop ───────────────────────────────────

export async function initSync(userId: string) {
  currentUserId = userId
  await initialMerge(userId)
  startListeners(userId)

  // Settings cloud sync
  const { initSettingsSync } = await import('./settingsSync')
  await initSettingsSync(userId)
}

export function stopSync() {
  if (unsubMemos) { unsubMemos(); unsubMemos = null }
  if (unsubFolders) { unsubFolders(); unsubFolders = null }
  currentUserId = null
  recentlyPushed.clear()
  for (const timer of recentlyPushedTimers.values()) clearTimeout(timer)
  recentlyPushedTimers.clear()
  mergePromise = null

  // Stop settings sync
  import('./settingsSync').then(({ stopSettingsSync }) => stopSettingsSync())
}
