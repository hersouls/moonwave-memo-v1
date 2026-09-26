import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  waitForPendingWrites,
  type DocumentData,
  type QuerySnapshot,
  type Unsubscribe,
} from 'firebase/firestore'
import { firestore } from '@/lib/firebase'
import type { Memo, Folder } from '@/lib/types'
import { extractTags } from '@/lib/tagParser'
import { nowISO } from '@/lib/dateUtils'
import * as database from './database'
import { db } from './database'
import { generateSyncId } from '@/utils/id'
import { DEFAULT_FOLDERS, SYSTEM_FOLDERS } from '@/utils/constants'
import { useToastStore } from '@/stores/toastStore'
import { claimLocalData, getLocalOwnerUid, recordSyncedThrough, type ClaimResult } from './localOwner'
import * as syncStatus from './syncStatus'
import { connectivity } from './connectivity'

// Canonical seed folders shipped with the app. They share a stable syncId across
// every device, so sync can recognise them as the same folder instead of cloning.
const ALL_SEED_FOLDERS = [...DEFAULT_FOLDERS, ...SYSTEM_FOLDERS]
const SEED_SYNC_IDS = new Set<string>(ALL_SEED_FOLDERS.map((s) => s.syncId))
const CANONICAL_DEFAULT_SYNC_ID = DEFAULT_FOLDERS.find((s) => s.isDefault)!.syncId
const CANONICAL_SYSTEM_SYNC_ID = SYSTEM_FOLDERS[0].syncId

let currentUserId: string | null = null
let refreshMemos: (() => Promise<void>) | null = null
let refreshFolders: (() => Promise<void>) | null = null

// Monotonic generation: bumped on every initSync/stopSync. Every cloud operation captures
// a SyncWriteContext {uid, epoch} when it starts and writes ONLY to that uid's path, and
// only while that epoch is still current — so a logout/account switch in the middle of a
// merge can never redirect account A's data into account B (§sync-safety).
let syncEpoch = 0
let merge: { epoch: number; promise: Promise<void> } | null = null

// Tombstones older than this are garbage-collected during initial merge. Devices
// offline longer than the window may still resurrect a deleted item — an accepted
// trade-off for bounded tombstone growth.
const TOMBSTONE_TTL_MS = 90 * 24 * 60 * 60 * 1000
const PUSH_TIMEOUT_MS = 10_000

// Live listener re-subscription after an error: capped exponential backoff.
const LISTENER_RETRY_BASE_MS = 1000
const LISTENER_RETRY_MAX_MS = 60_000

// The "confirmed synced" watermark is pulled back by this margin so an edit whose local
// write landed just before a confirmation (push not started yet) still counts as unsynced
// when an account switch snapshots the data.
const SYNCED_WATERMARK_MARGIN_MS = 5 * 60 * 1000

/** Identity + generation a cloud write belongs to (see syncEpoch). */
export interface SyncWriteContext {
  readonly uid: string
  readonly epoch: number
}

/** The live session's write context, or null while signed out / not yet initialised. */
export function currentWriteContext(): SyncWriteContext | null {
  return currentUserId ? { uid: currentUserId, epoch: syncEpoch } : null
}

export function isWriteContextLive(ctx: SyncWriteContext): boolean {
  return ctx.epoch === syncEpoch && ctx.uid === currentUserId
}

/** True once a user is authenticated and sync is active — gates offline-queue replay. */
export function isSyncReady(): boolean {
  return currentUserId != null
}

syncStatus.onSyncConfirmed((uid, confirmedFrom) => {
  const at = new Date(Date.parse(confirmedFrom) - SYNCED_WATERMARK_MARGIN_MS).toISOString()
  recordSyncedThrough(uid, at).catch(() => {})
})

// ownerUid: the account the intent belongs to. Omitted only when no session exists (signed
// out) — then the intent belongs to whoever owns the local data.
async function enqueueSafe(type: 'memo' | 'folder', action: 'upsert' | 'delete', syncId: string, ownerUid?: string) {
  try {
    const { enqueueSync } = await import('./offlineQueue')
    await enqueueSync(type, action, syncId, ownerUid)
  } catch (err) {
    console.error('enqueueSync failed:', err)
  }
}

async function dequeueSafe(syncId: string, notAfter: string) {
  try {
    const { dequeueSync } = await import('./offlineQueue')
    await dequeueSync(syncId, notAfter)
  } catch { /* best-effort */ }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Sync push timed out')), ms)
    }),
  ]).finally(() => clearTimeout(timer))
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

// ─── Cloud write gate ─────────────────────────────

type WriteGate = 'write' | 'defer' | 'drop'

async function gateCloudWrite(ctx: SyncWriteContext): Promise<WriteGate> {
  let owner: string | null
  try {
    owner = await getLocalOwnerUid()
  } catch {
    return 'defer'
  }
  // The local data now belongs to another account (switched — possibly in another tab):
  // this write describes the previous account's data and must go nowhere. Its content is
  // in that account's local snapshot.
  if (owner !== ctx.uid) return 'drop'
  // Same owner, but the session that issued the write has ended (logout / re-init): keep
  // the intent queued so that account's next session delivers it.
  if (!isWriteContextLive(ctx)) return 'defer'
  return 'write'
}

// ─── Push to Firestore ────────────────────────────

export async function pushMemo(memo: Memo, ctx: SyncWriteContext | null = currentWriteContext()): Promise<boolean> {
  if (!memo.syncId) return false
  // Signed out (or sync not yet initialised): record the intent so it replays on
  // login. Without this, edits made while logged out are stranded on the device.
  if (!ctx) {
    await enqueueSafe('memo', 'upsert', memo.syncId)
    return false
  }
  const startedAt = nowISO()
  const token = syncStatus.noteWriteStarted()
  try {
    const folderSyncId = await getFolderSyncId(memo.folderId)
    const gate = await gateCloudWrite(ctx)
    if (gate === 'drop') return false
    if (gate === 'defer') {
      await enqueueSafe('memo', 'upsert', memo.syncId, ctx.uid)
      return false
    }
    const ref = doc(firestore, `users/${ctx.uid}/memos`, memo.syncId)
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
    await dequeueSafe(memo.syncId, startedAt)
    return true
  } catch (err) {
    console.error('Push memo failed:', err)
    await enqueueSafe('memo', 'upsert', memo.syncId, ctx.uid)
    return false
  } finally {
    syncStatus.noteWriteFinished(token)
  }
}

export async function pushFolder(folder: Folder, ctx: SyncWriteContext | null = currentWriteContext()): Promise<boolean> {
  if (!folder.syncId) return false
  if (!ctx) {
    await enqueueSafe('folder', 'upsert', folder.syncId)
    return false
  }
  const startedAt = nowISO()
  const token = syncStatus.noteWriteStarted()
  try {
    const gate = await gateCloudWrite(ctx)
    if (gate === 'drop') return false
    if (gate === 'defer') {
      await enqueueSafe('folder', 'upsert', folder.syncId, ctx.uid)
      return false
    }
    const ref = doc(firestore, `users/${ctx.uid}/folders`, folder.syncId)
    await setDoc(ref, stripUndefined({
      name: folder.name,
      color: folder.color,
      sortOrder: folder.sortOrder,
      isDefault: folder.isDefault,
      isSystem: folder.isSystem,
      createdAt: folder.createdAt,
      updatedAt: folder.updatedAt,
    }), { merge: true })
    await dequeueSafe(folder.syncId, startedAt)
    return true
  } catch (err) {
    console.error('Push folder failed:', err)
    await enqueueSafe('folder', 'upsert', folder.syncId, ctx.uid)
    return false
  } finally {
    syncStatus.noteWriteFinished(token)
  }
}

// ─── Delete from Firestore ────────────────────────
//
// User-initiated permanent delete writes a TOMBSTONE doc (not a hard delete) so a
// device that was offline at delete time removes its local copy on next merge instead
// of resurrecting the item back into the cloud (§sync-safety no-tombstone bug).

async function writeTombstone(
  kind: 'memo' | 'folder',
  syncId: string,
  ctx: SyncWriteContext | null,
): Promise<boolean> {
  if (!syncId) return false
  if (!ctx) {
    await enqueueSafe(kind, 'delete', syncId)
    return false
  }
  const startedAt = nowISO()
  const token = syncStatus.noteWriteStarted()
  try {
    const gate = await gateCloudWrite(ctx)
    if (gate === 'drop') return false
    if (gate === 'defer') {
      await enqueueSafe(kind, 'delete', syncId, ctx.uid)
      return false
    }
    const ref = doc(firestore, `users/${ctx.uid}/${kind === 'memo' ? 'memos' : 'folders'}`, syncId)
    await setDoc(ref, { tombstone: true, purgedAt: nowISO(), updatedAt: nowISO() })
    await dequeueSafe(syncId, startedAt)
    return true
  } catch (err) {
    console.error(`Delete ${kind} from cloud failed:`, err)
    await enqueueSafe(kind, 'delete', syncId, ctx.uid)
    return false
  } finally {
    syncStatus.noteWriteFinished(token)
  }
}

export function deleteMemoFromCloud(syncId: string, ctx: SyncWriteContext | null = currentWriteContext()): Promise<boolean> {
  return writeTombstone('memo', syncId, ctx)
}

export function deleteFolderFromCloud(syncId: string, ctx: SyncWriteContext | null = currentWriteContext()): Promise<boolean> {
  return writeTombstone('folder', syncId, ctx)
}

// Hard delete (removes the doc entirely) — used ONLY for internal dedupe of duplicate
// seed folders, where the loser identity never legitimately existed and must not leave
// a tombstone. Not for user deletes.
async function hardDeleteFolderFromCloud(ctx: SyncWriteContext, syncId: string): Promise<void> {
  if (!syncId) return
  try {
    if ((await gateCloudWrite(ctx)) !== 'write') return
    await deleteDoc(doc(firestore, `users/${ctx.uid}/folders`, syncId))
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

// Remote memo changes likewise bypass memoStore (the only caller of notifyMemoSaved/Deleted),
// so without these an edit made on another device never reached this device's sync folder —
// nor the NAS pipeline that reads it — until the memo was edited here or fully re-exported.
// Same trash semantics as memoStore: a trashed memo has no file.
async function reflectMemoOnDisk(localId: number): Promise<void> {
  const memo = await database.getMemo(localId)
  if (!memo) return
  void import('@/services/syncFolder')
    .then((m) => (memo.deletedAt ? m.notifyMemoDeleted(memo) : m.notifyMemoSaved(memo)))
    .catch(() => {})
}
function reflectMemoPurgedOnDisk(memo: Memo): void {
  void import('@/services/syncFolder').then((m) => m.notifyMemoDeleted(memo)).catch(() => {})
}

// ─── Remote apply (idempotent, one transaction per incoming doc) ────────────
//
// Every tab runs its own merge + live listeners against the same IndexedDB. Looking up the
// local row by syncId and inserting/updating it happen inside ONE readwrite transaction —
// IndexedDB serialises overlapping readwrite transactions even across tabs — so two
// appliers of the same incoming doc can never both insert it (the unique &syncId index is
// the backstop). The same transaction re-checks that the local data still belongs to the
// account the doc came from, so a stale listener can't seed another account's data.

type MemoApplyOutcome =
  | { kind: 'none' }
  | { kind: 'saved'; id: number }
  | { kind: 'purged'; memo: Memo }

/** Apply one remote memo doc (or its removal) to the local DB. Exported for tests. */
export async function applyRemoteMemo(
  ownerUid: string,
  syncId: string,
  remote: DocumentData,
  removed = false,
): Promise<MemoApplyOutcome> {
  return db.transaction(
    'rw',
    [db.syncMeta, db.memos, db.folders, db.memoImages, db.memoVersions, db.embeddings],
    async (): Promise<MemoApplyOutcome> => {
      if ((await getLocalOwnerUid()) !== ownerUid) return { kind: 'none' }
      const local = await database.getMemoBySyncId(syncId)

      // Tombstoned / removed memo: purge the local copy and never re-create/re-push it.
      if (removed || remote.tombstone) {
        if (local?.id == null) return { kind: 'none' }
        await database.permanentDeleteMemo(local.id)
        return { kind: 'purged', memo: local }
      }

      // Resolve folderSyncId → local folderId (with legacy fallback)
      const folderId = remote.folderSyncId
        ? await resolveFolderSyncId(remote.folderSyncId)
        : (remote.folderId ?? null)

      if (!local) {
        const id = await database.addMemo({
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
        return { kind: 'saved', id }
      }
      if (remote.updatedAt && remote.updatedAt > local.updatedAt) {
        await database.updateMemo(local.id!, {
          title: remote.title,
          body: remote.body,
          folderId,
          tags: resolveRemoteTags(remote),
          isStarred: remote.isStarred,
          color: remote.color,
          isPinned: remote.isPinned,
          deletedAt: remote.deletedAt || undefined,
          // Adopt the writer's timestamp so LWW compares sender-vs-sender.
          updatedAt: remote.updatedAt,
        })
        return { kind: 'saved', id: local.id! }
      }
      return { kind: 'none' }
    },
  )
}

async function reflectMemoOutcome(outcome: MemoApplyOutcome): Promise<void> {
  if (outcome.kind === 'saved') await reflectMemoOnDisk(outcome.id)
  else if (outcome.kind === 'purged') reflectMemoPurgedOnDisk(outcome.memo)
}

type FolderApplyOutcome =
  | { kind: 'none' }
  | { kind: 'created'; name: string; isSystem: boolean }
  | { kind: 'renamed'; id: number; oldName: string; newName: string }
  | { kind: 'deleted'; oldName: string; memoIds: number[] }

interface FolderApplyOptions {
  removed?: boolean
  /** Initial merge only: let a pristine local seed folder adopt a cloud folder's syncId. */
  seedAdoption?: { candidateIds: Set<number>; claimed: Set<number> }
}

async function applyRemoteFolder(
  ownerUid: string,
  syncId: string,
  remote: DocumentData,
  opts: FolderApplyOptions = {},
): Promise<FolderApplyOutcome> {
  return db.transaction('rw', [db.syncMeta, db.folders, db.memos], async (): Promise<FolderApplyOutcome> => {
    if ((await getLocalOwnerUid()) !== ownerUid) return { kind: 'none' }
    const local = await database.getFolderBySyncId(syncId)

    // Tombstoned / removed folder: remove the local copy (unless it's the singleton
    // default/trash), relocating its memos; never re-create or re-push it.
    if (opts.removed || remote.tombstone) {
      if (local?.id == null || local.isDefault || local.isSystem) return { kind: 'none' }
      const affected = await database.getMemosByFolderId(local.id)
      await database.deleteFolder(local.id)
      return {
        kind: 'deleted',
        oldName: local.name,
        memoIds: affected.map((m) => m.id).filter((x): x is number => x != null),
      }
    }

    if (!local) {
      const folders = await database.getAllFolders()
      if (opts.seedAdoption) {
        const { candidateIds, claimed } = opts.seedAdoption
        const seedMatch = folders.find((f) =>
          f.id != null &&
          candidateIds.has(f.id) &&
          !claimed.has(f.id) &&
          SEED_SYNC_IDS.has(f.syncId ?? '') &&
          (remote.isSystem
            ? f.isSystem
            : remote.isDefault
              ? f.isDefault
              : !f.isDefault && !f.isSystem && f.name === remote.name)
        )
        if (seedMatch?.id != null) {
          claimed.add(seedMatch.id)
          await database.updateFolder(seedMatch.id, {
            syncId,
            name: remote.name,
            color: remote.color,
            sortOrder: remote.sortOrder ?? seedMatch.sortOrder,
          })
          return { kind: 'none' }
        }
      } else if (remote.isDefault || remote.isSystem) {
        // Live snapshot: never clone the singleton default/trash folder. If one already
        // exists under a different syncId, let the next initial merge reconcile identities.
        if (folders.some((f) => (remote.isSystem ? f.isSystem : f.isDefault))) return { kind: 'none' }
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
      return { kind: 'created', name: remote.name, isSystem: !!remote.isSystem }
    }

    if (remote.updatedAt && (!local.updatedAt || remote.updatedAt > local.updatedAt)) {
      await database.updateFolder(local.id!, {
        name: remote.name,
        color: remote.color,
        sortOrder: remote.sortOrder,
        // Adopt the writer's timestamp so LWW compares sender-vs-sender, not
        // sender-vs-receiver-clock.
        updatedAt: remote.updatedAt,
      })
      return { kind: 'renamed', id: local.id!, oldName: local.name, newName: remote.name }
    }
    return { kind: 'none' }
  })
}

function reflectFolderOutcome(outcome: FolderApplyOutcome): void {
  // Created on another device → materialize its directory on this device's sync folder;
  // renamed → move its memo files; deleted → relocate its files out of the directory.
  if (outcome.kind === 'created') { if (!outcome.isSystem) reflectFolderCreatedOnDisk(outcome.name) }
  else if (outcome.kind === 'renamed') reflectFolderRenamedOnDisk(outcome.id, outcome.oldName, outcome.newName)
  else if (outcome.kind === 'deleted') reflectFolderDeletedOnDisk(outcome.oldName, outcome.memoIds)
}

// ─── Initial Merge ─────────────────────────────────

function initialMerge(ctx: SyncWriteContext): Promise<void> {
  if (merge?.epoch === ctx.epoch) return merge.promise
  const promise = doInitialMerge(ctx)
  const entry = { epoch: ctx.epoch, promise }
  merge = entry
  // Only clear the barrier if this run still owns it — a superseding merge must not
  // have its gate wiped by a stale predecessor's finally.
  promise.finally(() => { if (merge === entry) merge = null }).catch(() => {})
  return promise
}

async function doInitialMerge(ctx: SyncWriteContext) {
  const userId = ctx.uid
  const superseded = () => !isWriteContextLive(ctx)
  const now = Date.now()

  // Patch local folders missing updatedAt (legacy fix)
  for (const f of await database.getAllFolders()) {
    if (!f.updatedAt) await database.updateFolder(f.id!, {})
  }

  // Merge folders first (memos reference folders)
  const folderSnap = await getDocs(collection(firestore, `users/${userId}/folders`))
  if (superseded()) return

  const candidateIds = new Set(
    (await database.getAllFolders()).map((f) => f.id).filter((x): x is number => x != null)
  )
  const claimed = new Set<number>()
  for (const docSnap of folderSnap.docs) {
    if (superseded()) return
    reflectFolderOutcome(await applyRemoteFolder(userId, docSnap.id, docSnap.data(), { seedAdoption: { candidateIds, claimed } }))
  }

  // Reconcile local folders upward: push those with no cloud copy, or whose local
  // copy is genuinely newer than the cloud (offline/signed-out edits).
  if (superseded()) return
  const cloudFolders = new Map(folderSnap.docs.map((d) => [d.id, d.data()]))
  for (const folder of await database.getAllFolders()) {
    if (superseded()) return
    if (!folder.syncId) {
      folder.syncId = generateSyncId()
      await database.updateFolder(folder.id!, { syncId: folder.syncId, updatedAt: folder.updatedAt })
    }
    const remote = cloudFolders.get(folder.syncId)
    if (remote?.tombstone) continue // cloud deleted it; don't resurrect
    if (!remote || !remote.updatedAt || (folder.updatedAt && folder.updatedAt > remote.updatedAt)) {
      await withTimeout(pushFolder(folder, ctx), PUSH_TIMEOUT_MS).catch(console.error)
    }
  }

  // Merge memos
  if (superseded()) return
  const memoSnap = await getDocs(collection(firestore, `users/${userId}/memos`))
  if (superseded()) return
  for (const docSnap of memoSnap.docs) {
    if (superseded()) return
    await reflectMemoOutcome(await applyRemoteMemo(userId, docSnap.id, docSnap.data()))
  }

  // Reconcile local memos upward: push those with no cloud copy OR whose local copy is
  // newer than the cloud (offline/signed-out edits, restored backups) — this is the
  // symmetric half that makes offline edits actually reach the cloud. The local data is
  // this account's (claimLocalData ran first); every push re-checks that before writing.
  if (superseded()) return
  const cloudMemos = new Map(memoSnap.docs.map((d) => [d.id, d.data()]))
  for (const memo of await database.getAllMemos()) {
    if (superseded()) return
    if (!memo.syncId) {
      memo.syncId = generateSyncId()
      // Backfill without bumping updatedAt (metadata-only write).
      await database.updateMemoLocalMeta(memo.id!, { syncId: memo.syncId })
    }
    const remote = cloudMemos.get(memo.syncId)
    if (remote?.tombstone) continue // cloud deleted it; don't resurrect
    if (
      !remote ||
      (memo.updatedAt && (!remote.updatedAt || memo.updatedAt > remote.updatedAt)) ||
      (memo.folderId != null && !remote.folderSyncId)
    ) {
      await withTimeout(pushMemo(memo, ctx), PUSH_TIMEOUT_MS).catch(console.error)
    }
  }

  // Collapse any duplicate seed folders left behind by earlier buggy syncs
  if (superseded()) return
  await dedupeSeedFolders(ctx)

  // Garbage-collect expired tombstones (bounded growth). Only the cloud doc is
  // removed; local copies were already purged above.
  for (const docSnap of [...folderSnap.docs, ...memoSnap.docs]) {
    const remote = docSnap.data()
    if (remote.tombstone && remote.purgedAt && now - new Date(remote.purgedAt).getTime() > TOMBSTONE_TTL_MS) {
      if ((await gateCloudWrite(ctx)) !== 'write') break
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
async function dedupeSeedFolders(ctx: SyncWriteContext) {
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
        if (fresh) await pushMemo(fresh, ctx)
      }

      await database.removeFolderRecord(loser.id)
      if (loser.syncId) await hardDeleteFolderFromCloud(ctx, loser.syncId)
    }
  }
}

// ─── Real-time Listeners ───────────────────────────
//
// A listener that errors (network policy, token expiry, backend hiccup) is detached by
// Firestore for good; it is re-attached with capped exponential backoff for as long as
// its session lives. A re-attached listener's first snapshot re-delivers every doc, and
// remote-apply is idempotent, so anything missed while it was down is reconciled.

type ListenerName = 'memos' | 'folders'

interface ListenerSlot {
  unsub: Unsubscribe | null
  retryTimer: ReturnType<typeof setTimeout> | null
  failures: number
  chain: Promise<void>
}

function newSlot(): ListenerSlot {
  return { unsub: null, retryTimer: null, failures: 0, chain: Promise.resolve() }
}

const listenerSlots: Record<ListenerName, ListenerSlot> = { memos: newSlot(), folders: newSlot() }

export function listenerRetryDelay(failures: number): number {
  return Math.min(LISTENER_RETRY_BASE_MS * 2 ** Math.max(0, failures - 1), LISTENER_RETRY_MAX_MS)
}

function detachListener(name: ListenerName, resetFailures: boolean) {
  const slot = listenerSlots[name]
  if (slot.retryTimer) { clearTimeout(slot.retryTimer); slot.retryTimer = null }
  if (slot.unsub) { slot.unsub(); slot.unsub = null }
  if (resetFailures) slot.failures = 0
}

function teardownListeners() {
  for (const name of ['memos', 'folders'] as const) {
    detachListener(name, true)
    syncStatus.noteListenerRemoved(name)
  }
}

async function awaitMergeBarrier(): Promise<void> {
  const pending = merge?.promise
  if (pending) await pending.catch(() => {})
}

function subscribeListener(name: ListenerName, ctx: SyncWriteContext) {
  detachListener(name, false)
  if (!isWriteContextLive(ctx)) return
  const slot = listenerSlots[name]
  const handle = name === 'memos' ? handleMemoSnapshot : handleFolderSnapshot
  syncStatus.noteListenerWaiting(name)

  slot.unsub = onSnapshot(
    collection(firestore, `users/${ctx.uid}/${name}`),
    // Metadata-only snapshots report when the cache catches up with the server (fromCache)
    // — needed for an honest sync status. docChanges() still excludes metadata-only changes.
    { includeMetadataChanges: true },
    (snapshot) => {
      if (!isWriteContextLive(ctx)) return
      const fromCache = snapshot.metadata?.fromCache === true
      // Only a server-confirmed snapshot proves the connection is healthy again.
      if (!fromCache) slot.failures = 0
      syncStatus.noteListenerSnapshot(name, fromCache)
      slot.chain = slot.chain
        .then(() => handle(ctx, snapshot))
        .catch((err) => console.error(`${name} sync listener error:`, err))
    },
    (err) => {
      if (!isWriteContextLive(ctx)) return
      console.error(`${name} snapshot listener failed:`, err)
      slot.unsub = null // Firestore has already detached an errored listener
      slot.failures++
      syncStatus.noteListenerFailed(name)
      if (slot.failures === 1) {
        useToastStore.getState().showToast(
          name === 'memos' ? '메모 동기화 연결이 끊어졌습니다' : '폴더 동기화 연결이 끊어졌습니다',
          'warning',
        )
      }
      slot.retryTimer = setTimeout(() => {
        slot.retryTimer = null
        subscribeListener(name, ctx)
      }, listenerRetryDelay(slot.failures))
    },
  )
}

async function handleMemoSnapshot(ctx: SyncWriteContext, snapshot: QuerySnapshot<DocumentData>) {
  await awaitMergeBarrier()
  if (!isWriteContextLive(ctx)) return

  let changed = false
  for (const change of snapshot.docChanges()) {
    if (!isWriteContextLive(ctx)) return
    // Skip this client's own optimistic write echoes (latency compensation).
    // The server-confirmed version arrives later with hasPendingWrites=false and
    // is neutralised by the updatedAt guard, so no real remote edit is dropped.
    if (change.doc.metadata.hasPendingWrites) continue
    try {
      const outcome = await applyRemoteMemo(ctx.uid, change.doc.id, change.doc.data(), change.type === 'removed')
      if (outcome.kind === 'none') continue
      changed = true
      await reflectMemoOutcome(outcome)
    } catch (err) {
      console.error('Memo sync listener error:', err)
    }
  }

  if (changed && refreshMemos) await refreshMemos()
}

async function handleFolderSnapshot(ctx: SyncWriteContext, snapshot: QuerySnapshot<DocumentData>) {
  await awaitMergeBarrier()
  if (!isWriteContextLive(ctx)) return

  let changed = false
  let foldersRemoved = false
  for (const change of snapshot.docChanges()) {
    if (!isWriteContextLive(ctx)) return
    if (change.doc.metadata.hasPendingWrites) continue
    try {
      const outcome = await applyRemoteFolder(ctx.uid, change.doc.id, change.doc.data(), { removed: change.type === 'removed' })
      if (outcome.kind === 'none') continue
      changed = true
      if (outcome.kind === 'deleted') foldersRemoved = true
      reflectFolderOutcome(outcome)
    } catch (err) {
      console.error('Folder sync listener error:', err)
    }
  }

  if (changed && refreshFolders) await refreshFolders()
  // deleteFolder relocated memos in the DB — the memo store must re-read them,
  // otherwise the relocated memos keep a dead folderId in the UI.
  if (foldersRemoved && refreshMemos) await refreshMemos()
}

// ─── Init / Stop ───────────────────────────────────

async function announceAccountSwitch(claim: Extract<ClaimResult, { kind: 'switched' }>) {
  // The UI still shows the previous account's memos; drop them right away.
  await refreshFolders?.().catch(() => {})
  await refreshMemos?.().catch(() => {})
  const { showToast } = useToastStore.getState()
  if (claim.restoredOwnBackup) {
    showToast('이 기기에 보관해 둔 이 계정의 로컬 데이터를 복원했습니다.', 'info', { duration: 6000 })
  }
  if (claim.backupId != null) {
    const unsynced = claim.unsyncedMemoCount > 0 ? ` (동기화되지 않은 메모 ${claim.unsyncedMemoCount}개 포함)` : ''
    showToast(
      `이전 계정의 로컬 데이터는 이 계정에 올리지 않고 이 기기에 따로 보관했습니다${unsynced}. 설정 › 클라우드 동기화에서 내려받을 수 있습니다.`,
      'info',
      { duration: 10_000 },
    )
  }
}

export interface InitSyncOptions {
  /** Shown next to account-switch backups in Settings. */
  email?: string
}

export async function initSync(userId: string, opts: InitSyncOptions = {}) {
  const epoch = ++syncEpoch
  teardownListeners()
  // Until ownership of the local data is settled, cloud writes wait in the queue.
  currentUserId = null
  merge = null
  syncStatus.syncSessionStarting(userId)

  // Make sure the local data belongs to this account BEFORE anything is merged or pushed:
  // a different account's data is set aside, never uploaded here.
  const claim = await claimLocalData(userId, opts.email)
  // A logout/account-switch meanwhile bumps syncEpoch; abort the rest so we never merge,
  // attach listeners or drain the queue for a stale/wrong account.
  if (epoch !== syncEpoch) return
  currentUserId = userId
  const ctx: SyncWriteContext = { uid: userId, epoch }
  if (claim.kind === 'switched') await announceAccountSwitch(claim)

  await initialMerge(ctx)
  if (!isWriteContextLive(ctx)) return
  subscribeListener('memos', ctx)
  subscribeListener('folders', ctx)

  // Replay any writes queued while offline or signed out (now that auth is live).
  const { processPendingSyncs } = await import('./offlineQueue')
  await processPendingSyncs()
  if (!isWriteContextLive(ctx)) return

  // Settings cloud sync
  const { initSettingsSync } = await import('./settingsSync')
  await initSettingsSync(userId)
  if (!isWriteContextLive(ctx)) return

  syncStatus.syncSessionRunning()
}

/**
 * Stop syncing (logout, restore, failed init). `failed` keeps the status at 'error' so the
 * user sees that sync is not running, instead of a silent 'idle'.
 */
export function stopSync(opts: { failed?: boolean } = {}) {
  syncEpoch++
  teardownListeners()
  currentUserId = null
  merge = null
  if (opts.failed) syncStatus.syncSessionFailed()
  else syncStatus.syncSessionEnded()

  import('./offlineQueue').then(({ cancelQueueReplay }) => cancelQueueReplay()).catch(() => {})
  // Stop settings sync
  import('./settingsSync').then(({ stopSettingsSync }) => stopSettingsSync()).catch(() => {})
}

/**
 * Before signing out: try to deliver the offline queue and get the server's confirmation
 * while still authenticated (bounded wait). Whatever is left stays queued for this account
 * — it replays when the same account signs back in, and is part of the local snapshot if a
 * different account signs in here next.
 */
export async function flushPendingBeforeSignOut(timeoutMs = 5000): Promise<{ queued: number; unconfirmed: boolean }> {
  let confirmed = false
  if (isSyncReady() && connectivity.isOnline()) {
    try {
      const { processPendingSyncs } = await import('./offlineQueue')
      await withTimeout(processPendingSyncs().then(() => waitForPendingWrites(firestore)), timeoutMs)
      confirmed = true
    } catch { /* timed out / failed — reported below */ }
  } else {
    // Nothing can be delivered right now; only find out whether anything is outstanding.
    confirmed = await withTimeout(waitForPendingWrites(firestore), 300).then(() => true, () => false)
  }
  const queued = await db.pendingSyncs.count().catch(() => 0)
  return { queued, unconfirmed: !confirmed }
}
