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
import { extractTags } from '@/lib/tagParser'
import { nowISO } from '@/lib/dateUtils'
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

// Monotonic generation: bumped on every initSync/stopSync. A long-running initial
// merge captures its generation and bails the moment a logout/account-switch bumps
// it, so a stale merge can never push account A's data into account B (§sync-safety).
let syncEpoch = 0
let mergePromise: Promise<void> | null = null

// Tombstones older than this are garbage-collected during initial merge. Devices
// offline longer than the window may still resurrect a deleted item — an accepted
// trade-off for bounded tombstone growth.
const TOMBSTONE_TTL_MS = 90 * 24 * 60 * 60 * 1000

/** True once a user is authenticated and sync is active — gates offline-queue replay. */
export function isSyncReady(): boolean {
  return currentUserId != null
}

async function enqueueSafe(type: 'memo' | 'folder', action: 'upsert' | 'delete', syncId: string) {
  try {
    const { enqueueSync } = await import('./offlineQueue')
    await enqueueSync(type, action, syncId)
  } catch (err) {
    console.error('enqueueSync failed:', err)
  }
}

async function dequeueSafe(syncId: string) {
  try {
    const { dequeueSync } = await import('./offlineQueue')
    await dequeueSync(syncId)
  } catch { /* best-effort */ }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Sync push timed out')), ms)
    ),
  ])
}

/**
 * 원격 문서의 tags가 비어 있으면 본문 해시태그에서 재추출한다.
 * 레거시 문서(태그 필드 없이 본문에 #해시태그만 있는 메모)가 수신 기기에서
 * tags 빈 배열로 저장되는 불일치를 막는다.
 */
export function resolveRemoteTags(remote: { tags?: string[]; body?: string }): string[] {
  return remote.tags?.length ? remote.tags : extractTags(remote.body || '')
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

export async function pushMemo(memo: Memo): Promise<boolean> {
  if (!memo.syncId) return false
  // Signed out (or sync not yet initialised): record the intent so it replays on
  // login. Without this, edits made while logged out are stranded on the device.
  if (!currentUserId) {
    await enqueueSafe('memo', 'upsert', memo.syncId)
    return false
  }
  try {
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
    await dequeueSafe(memo.syncId)
    return true
  } catch (err) {
    console.error('Push memo failed:', err)
    await enqueueSafe('memo', 'upsert', memo.syncId)
    return false
  }
}

export async function pushFolder(folder: Folder): Promise<boolean> {
  if (!folder.syncId) return false
  if (!currentUserId) {
    await enqueueSafe('folder', 'upsert', folder.syncId)
    return false
  }
  try {
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
    await dequeueSafe(folder.syncId)
    return true
  } catch (err) {
    console.error('Push folder failed:', err)
    await enqueueSafe('folder', 'upsert', folder.syncId)
    return false
  }
}

// ─── Delete from Firestore ────────────────────────
//
// User-initiated permanent delete writes a TOMBSTONE doc (not a hard delete) so a
// device that was offline at delete time removes its local copy on next merge instead
// of resurrecting the item back into the cloud (§sync-safety no-tombstone bug).

export async function deleteMemoFromCloud(syncId: string): Promise<boolean> {
  if (!syncId) return false
  if (!currentUserId) {
    await enqueueSafe('memo', 'delete', syncId)
    return false
  }
  try {
    const ref = doc(firestore, `users/${currentUserId}/memos`, syncId)
    await setDoc(ref, { tombstone: true, purgedAt: nowISO(), updatedAt: nowISO() })
    await dequeueSafe(syncId)
    return true
  } catch (err) {
    console.error('Delete memo from cloud failed:', err)
    await enqueueSafe('memo', 'delete', syncId)
    return false
  }
}

export async function deleteFolderFromCloud(syncId: string): Promise<boolean> {
  if (!syncId) return false
  if (!currentUserId) {
    await enqueueSafe('folder', 'delete', syncId)
    return false
  }
  try {
    const ref = doc(firestore, `users/${currentUserId}/folders`, syncId)
    await setDoc(ref, { tombstone: true, purgedAt: nowISO(), updatedAt: nowISO() })
    await dequeueSafe(syncId)
    return true
  } catch (err) {
    console.error('Delete folder from cloud failed:', err)
    await enqueueSafe('folder', 'delete', syncId)
    return false
  }
}

// Hard delete (removes the doc entirely) — used ONLY for internal dedupe of duplicate
// seed folders, where the loser identity never legitimately existed and must not leave
// a tombstone. Not for user deletes.
async function hardDeleteFolderFromCloud(syncId: string): Promise<void> {
  if (!currentUserId || !syncId) return
  try {
    await deleteDoc(doc(firestore, `users/${currentUserId}/folders`, syncId))
  } catch (err) {
    console.error('Hard delete folder from cloud failed:', err)
  }
}

// ─── Disk sync-folder reflection (device-local) ─────
//
// Remote folder create/rename/delete arrive here (initial merge + live snapshot) and
// mutate the local DB, but the device-local disk sync folder is memo-file driven and
// would not otherwise follow folder-level changes made on another device. These mirror
// the folderStore notifications so a folder renamed/deleted elsewhere is reflected on
// THIS device's sync folder too. A dynamic import breaks the firestoreSync ⇄ syncFolder
// module cycle; every call is a no-op when the sync-folder feature is disabled here.
function reflectFolderCreatedOnDisk(name: string): void {
  void import('@/services/syncFolder').then((m) => m.notifyFolderCreated(name)).catch(() => {})
}
function reflectFolderRenamedOnDisk(folderId: number, oldName: string, newName: string): void {
  if (oldName === newName) return
  void import('@/services/syncFolder').then((m) => m.notifyFolderRenamed(folderId, oldName, newName)).catch(() => {})
}
function reflectFolderDeletedOnDisk(oldName: string, memoIds: number[]): void {
  void import('@/services/syncFolder').then((m) => m.notifyFolderDeleted(oldName, memoIds)).catch(() => {})
}

// ─── Initial Merge ─────────────────────────────────

async function initialMerge(userId: string, epoch: number) {
  if (mergePromise) return mergePromise
  const own = doInitialMerge(userId, epoch)
  mergePromise = own
  // Only clear the barrier if this run still owns it — a superseding merge must not
  // have its gate wiped by a stale predecessor's finally.
  own.finally(() => { if (mergePromise === own) mergePromise = null })
  return mergePromise
}

async function doInitialMerge(userId: string, epoch: number) {
  const superseded = () => epoch !== syncEpoch
  const now = Date.now()

  // Patch local folders missing updatedAt (legacy fix)
  const allLocalFolders = await database.getAllFolders()
  for (const f of allLocalFolders) {
    if (!f.updatedAt) {
      await database.updateFolder(f.id!, {})
    }
  }

  // Merge folders first (memos reference folders)
  const folderSnap = await getDocs(collection(firestore, `users/${userId}/folders`))
  if (superseded()) return

  const localBeforeMerge = await database.getAllFolders()
  const claimedSeedIds = new Set<number>()

  for (const docSnap of folderSnap.docs) {
    const remote = docSnap.data()
    const syncId = docSnap.id
    const local = await database.getFolderBySyncId(syncId)

    // Tombstoned folder: remove the local copy (unless it's the singleton
    // default/trash), never re-create or re-push it.
    if (remote.tombstone) {
      if (local?.id != null && !local.isDefault && !local.isSystem) {
        const affected = await database.getMemosByFolderId(local.id)
        const oldName = local.name
        await database.deleteFolder(local.id)
        // Relocate this folder's files out of its directory on this device's sync folder.
        reflectFolderDeletedOnDisk(oldName, affected.map((m) => m.id).filter((x): x is number => x != null))
      }
      continue
    }

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
      // A folder created on another device (offline catch-up) — materialize its directory
      // on this device's sync folder too, matching the live-snapshot 'added' path.
      if (!remote.isSystem) reflectFolderCreatedOnDisk(remote.name)
    } else if (remote.updatedAt && (!local.updatedAt || remote.updatedAt > local.updatedAt)) {
      const oldName = local.name
      await database.updateFolder(local.id!, {
        name: remote.name,
        color: remote.color,
        sortOrder: remote.sortOrder,
        // Adopt the writer's timestamp so LWW compares sender-vs-sender, not
        // sender-vs-receiver-clock.
        updatedAt: remote.updatedAt,
      })
      // A remote rename must move this folder's memo files into the new-named directory.
      reflectFolderRenamedOnDisk(local.id!, oldName, remote.name)
    }
  }

  // Reconcile local folders upward: push those with no cloud copy, or whose local
  // copy is genuinely newer than the cloud (offline/signed-out edits).
  if (superseded()) return
  const localFolders = await database.getAllFolders()
  for (const folder of localFolders) {
    if (!folder.syncId) {
      folder.syncId = generateSyncId()
      await database.updateFolder(folder.id!, { syncId: folder.syncId, updatedAt: folder.updatedAt })
    }
    const cloudDoc = folderSnap.docs.find((d) => d.id === folder.syncId)
    const remote = cloudDoc?.data()
    if (remote?.tombstone) continue // cloud deleted it; don't resurrect
    if (!cloudDoc) {
      await withTimeout(pushFolder(folder), 10_000).catch(console.error)
    } else if (!remote!.updatedAt || (folder.updatedAt && folder.updatedAt > remote!.updatedAt)) {
      await withTimeout(pushFolder(folder), 10_000).catch(console.error)
    }
  }

  // Merge memos
  if (superseded()) return
  const memoSnap = await getDocs(collection(firestore, `users/${userId}/memos`))
  if (superseded()) return
  for (const docSnap of memoSnap.docs) {
    const remote = docSnap.data()
    const syncId = docSnap.id
    const local = await database.getMemoBySyncId(syncId)

    // Tombstoned memo: purge the local copy and never re-create/re-push it.
    if (remote.tombstone) {
      if (local?.id != null) await database.permanentDeleteMemo(local.id)
      continue
    }

    // Resolve folderSyncId → local folderId (with legacy fallback)
    const folderId = remote.folderSyncId
      ? await resolveFolderSyncId(remote.folderSyncId)
      : (remote.folderId ?? null)

    if (!local) {
      await database.addMemo({
        title: remote.title || '',
        body: remote.body || '',
        folderId,
        tags: resolveRemoteTags(remote),
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
        tags: resolveRemoteTags(remote),
        isStarred: remote.isStarred,
        color: remote.color,
        isPinned: remote.isPinned,
        deletedAt: remote.deletedAt || undefined,
        updatedAt: remote.updatedAt,
      })
    }
  }

  // Reconcile local memos upward: push those with no cloud copy OR whose local copy is
  // newer than the cloud (offline/signed-out edits, restored backups) — this is the
  // symmetric half that makes offline edits actually reach the cloud.
  if (superseded()) return
  const localMemos = await database.getAllMemos()
  for (const memo of localMemos) {
    if (!memo.syncId) {
      memo.syncId = generateSyncId()
      // Backfill without bumping updatedAt (metadata-only write).
      await database.updateMemoLocalMeta(memo.id!, { syncId: memo.syncId })
    }
    const cloudDoc = memoSnap.docs.find((d) => d.id === memo.syncId)
    const remote = cloudDoc?.data()
    if (remote?.tombstone) continue // cloud deleted it; don't resurrect
    if (!cloudDoc) {
      await withTimeout(pushMemo(memo), 10_000).catch(console.error)
    } else if (
      (memo.updatedAt && (!remote!.updatedAt || memo.updatedAt > remote!.updatedAt)) ||
      (memo.folderId != null && !remote!.folderSyncId)
    ) {
      await withTimeout(pushMemo(memo), 10_000).catch(console.error)
    }
  }

  // Collapse any duplicate seed folders left behind by earlier buggy syncs
  if (superseded()) return
  await dedupeSeedFolders()

  // Garbage-collect expired tombstones (bounded growth). Only the cloud doc is
  // removed; local copies were already purged above.
  for (const docSnap of [...folderSnap.docs, ...memoSnap.docs]) {
    const remote = docSnap.data()
    if (remote.tombstone && remote.purgedAt && now - new Date(remote.purgedAt).getTime() > TOMBSTONE_TTL_MS) {
      await deleteDoc(docSnap.ref).catch(() => {})
    }
  }

  if (superseded()) return
  if (refreshFolders) await refreshFolders()
  if (refreshMemos) await refreshMemos()
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

  // Named seed folders (스크랩/아이디어/쇼핑): collapse only genuine LEGACY clones — the
  // old bug seeded these with random per-device syncIds, so an account could accrue two
  // random-syncId "쇼핑" folders that should merge.
  //
  // A folder matching a seed's name+colour is NOT sufficient evidence of a clone: the seed
  // palette (FOLDER_COLORS) is user-selectable, so a user can legitimately create a folder
  // named "쇼핑" in the seed's colour. When the canonical seed itself is present in the
  // group, the OTHER same-name+colour folders may be exactly those user folders — merging
  // them would hard-delete a real user folder across every device (§data-safety). So we
  // only dedupe groups that do NOT contain the canonical seed (pure legacy-clone clusters);
  // a stray clone sitting next to the canonical seed is left for manual cleanup instead.
  for (const seed of DEFAULT_FOLDERS) {
    if (seed.isDefault || seed.isSystem) continue
    const members = folders.filter(
      (f) => !f.isDefault && !f.isSystem && f.name === seed.name && f.color === seed.color
    )
    const hasCanonical = members.some((f) => f.syncId === seed.syncId)
    if (members.length > 1 && !hasCanonical) {
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
      if (loser.syncId) await hardDeleteFolderFromCloud(loser.syncId)
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
          // Skip this client's own optimistic write echoes (latency compensation).
          // The server-confirmed version arrives later with hasPendingWrites=false and
          // is neutralised by the updatedAt guard, so no real remote edit is dropped.
          if (change.doc.metadata.hasPendingWrites) continue

          const remote = change.doc.data()

          // Tombstone: purge the local copy, never re-add it.
          if (remote.tombstone) {
            const local = await database.getMemoBySyncId(syncId)
            if (local?.id != null) await database.permanentDeleteMemo(local.id)
            continue
          }

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
                tags: resolveRemoteTags(remote),
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
                tags: resolveRemoteTags(remote),
                isStarred: remote.isStarred,
                color: remote.color,
                isPinned: remote.isPinned,
                deletedAt: remote.deletedAt || undefined,
                updatedAt: remote.updatedAt,
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
        let foldersRemoved = false
        for (const change of snapshot.docChanges()) {
          const syncId = change.doc.id
          if (change.doc.metadata.hasPendingWrites) continue

          const remote = change.doc.data()

          // Tombstone: remove the local folder (relocating its memos) and refresh
          // the memo store since deleteFolder re-homes memos.
          if (remote.tombstone) {
            const local = await database.getFolderBySyncId(syncId)
            if (local?.id != null && !local.isDefault && !local.isSystem) {
              const affected = await database.getMemosByFolderId(local.id)
              const oldName = local.name
              await database.deleteFolder(local.id)
              foldersRemoved = true
              reflectFolderDeletedOnDisk(oldName, affected.map((m) => m.id).filter((x): x is number => x != null))
            }
            continue
          }

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
              // A folder created on another device — materialize it on this device's disk.
              if (!remote.isSystem) reflectFolderCreatedOnDisk(remote.name)
            } else if (remote.updatedAt && (!local.updatedAt || remote.updatedAt > local.updatedAt)) {
              const oldName = local.name
              await database.updateFolder(local.id!, {
                name: remote.name,
                color: remote.color,
                sortOrder: remote.sortOrder,
                updatedAt: remote.updatedAt,
              })
              // A remote rename must move this folder's memo files on this device's disk.
              reflectFolderRenamedOnDisk(local.id!, oldName, remote.name)
            }
          }

          if (change.type === 'removed') {
            const local = await database.getFolderBySyncId(syncId)
            if (local?.id != null && !local.isDefault && !local.isSystem) {
              const affected = await database.getMemosByFolderId(local.id)
              const oldName = local.name
              await database.deleteFolder(local.id)
              foldersRemoved = true
              reflectFolderDeletedOnDisk(oldName, affected.map((m) => m.id).filter((x): x is number => x != null))
            }
          }
        }

        if (refreshFolders) await refreshFolders()
        // deleteFolder relocated memos in the DB — the memo store must re-read them,
        // otherwise the relocated memos keep a dead folderId in the UI.
        if (foldersRemoved && refreshMemos) await refreshMemos()
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
  const epoch = ++syncEpoch
  currentUserId = userId
  await initialMerge(userId, epoch)
  // A logout/account-switch during the merge bumps syncEpoch; abort the rest so we
  // never attach listeners (or drain the queue) for a stale/wrong account.
  if (epoch !== syncEpoch) return
  startListeners(userId)

  // Replay any writes queued while offline or signed out (now that auth is live).
  const { processPendingSyncs } = await import('./offlineQueue')
  await processPendingSyncs()

  // Settings cloud sync
  const { initSettingsSync } = await import('./settingsSync')
  await initSettingsSync(userId)
}

export function stopSync() {
  syncEpoch++
  if (unsubMemos) { unsubMemos(); unsubMemos = null }
  if (unsubFolders) { unsubFolders(); unsubFolders = null }
  currentUserId = null
  mergePromise = null

  // Stop settings sync
  import('./settingsSync').then(({ stopSettingsSync }) => stopSettingsSync())
}
