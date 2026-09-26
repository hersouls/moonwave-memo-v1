import {
  db,
  type OrphanBackup,
  type OrphanBackupData,
} from './database'
import type { BackupFile, Folder } from '@/lib/types'
import { BACKUP_CONFIG, DEFAULT_FOLDERS, SYSTEM_FOLDERS } from '@/utils/constants'
import { nowISO } from '@/lib/dateUtils'
import { dedupeSyncRows } from './syncIdDedupe'

// ─── Local-data ownership (§sync-safety: account switch) ─────────────────────
//
// The local DB is a replica of ONE account's cloud. We record which account that is so a
// different Google account signing in on this device can never inherit — and upload — the
// previous account's memos. On sign-in:
//   • no owner recorded yet (first sign-in, or an install from before this existed) → adopt
//   • same owner → keep everything (offline edits and the queue replay into that account)
//   • different owner → snapshot the previous account's local data into `orphanBackups`,
//     reset memos/folders/queue/fileSyncMap/embeddings, and restore the new account's own
//     snapshot if it had one from an earlier switch on this device; the merge then pulls
//     that account's cloud. Nothing of the previous account is ever pushed.
// Signing out keeps the owner (and the local data + queue), so the same account signing
// back in resumes exactly where it left off.

const OWNER_KEY = 'owner'
const SYNCED_THROUGH_KEY = 'syncedThrough'

// Seed folders re-created for a new owner carry the epoch as updatedAt so any copy that
// already exists in that account's cloud (possibly renamed/recoloured) wins last-write-wins
// instead of being overwritten by the defaults.
const SEED_STAMP = new Date(0).toISOString()
const SEED_SYNC_IDS = new Set<string>([...DEFAULT_FOLDERS, ...SYSTEM_FOLDERS].map((f) => f.syncId))

export interface LocalOwner {
  uid: string
  email?: string
  since: string
}

interface SyncedThrough {
  uid: string
  at: string
}

export async function getLocalOwner(): Promise<LocalOwner | null> {
  const row = await db.syncMeta.get(OWNER_KEY)
  const owner = row?.value as LocalOwner | undefined
  return owner?.uid ? owner : null
}

/** uid the local data belongs to (null = never signed in / not yet adopted). */
export async function getLocalOwnerUid(): Promise<string | null> {
  return (await getLocalOwner())?.uid ?? null
}

/**
 * Record that every local edit up to `at` is confirmed in `uid`'s cloud. Only used to tell
 * the user how much of a snapshot was unsynced; ignored if `uid` no longer owns the data.
 */
export async function recordSyncedThrough(uid: string, at: string): Promise<void> {
  await db.transaction('rw', db.syncMeta, async () => {
    if ((await getLocalOwnerUid()) !== uid) return
    await db.syncMeta.put({ key: SYNCED_THROUGH_KEY, value: { uid, at } satisfies SyncedThrough })
  })
}

export type ClaimResult =
  | { kind: 'adopted' }
  | { kind: 'same' }
  | {
      kind: 'switched'
      previousUid: string
      /** Snapshot of the previous account's data (null when it had nothing worth keeping). */
      backupId: number | null
      unsyncedMemoCount: number
      /** This account's own snapshot from an earlier switch on this device was restored. */
      restoredOwnBackup: boolean
    }

function findUnsyncedMemoSyncIds(data: OrphanBackupData, syncedThrough: string | null): { count: number; syncIds: string[] } {
  const queued = new Set(
    data.pendingSyncs.filter((p) => p.type === 'memo' && p.action === 'upsert').map((p) => p.syncId),
  )
  const unsynced = data.memos.filter((m) =>
    !m.syncId || queued.has(m.syncId) || !syncedThrough || !m.updatedAt || m.updatedAt > syncedThrough,
  )
  return { count: unsynced.length, syncIds: unsynced.map((m) => m.syncId).filter((s): s is string => !!s) }
}

function hasLocalContent(data: OrphanBackupData): boolean {
  return (
    data.memos.length > 0 ||
    data.pendingSyncs.length > 0 ||
    data.memoImages.length > 0 ||
    data.memoVersions.length > 0 ||
    data.demianChats.length > 0 ||
    data.folders.some((f) => !SEED_SYNC_IDS.has(f.syncId ?? ''))
  )
}

function seedFolders(): Folder[] {
  const now = nowISO()
  return [...DEFAULT_FOLDERS, ...SYSTEM_FOLDERS].map((f, i) => ({
    name: f.name,
    color: f.color,
    sortOrder: i,
    isDefault: f.isDefault,
    isSystem: f.isSystem,
    syncId: f.syncId,
    createdAt: now,
    updatedAt: SEED_STAMP,
  }))
}

async function restoreSnapshotRows(snapshot: OrphanBackup): Promise<void> {
  // The snapshot came from a DB with unique syncIds, but a duplicate here would abort the
  // whole claim (and with it every sign-in), so collapse defensively.
  const clean = dedupeSyncRows(snapshot.data)
  if (clean.folders.length > 0) await db.folders.bulkAdd(clean.folders)
  else await db.folders.bulkAdd(seedFolders())
  if (clean.memos.length > 0) await db.memos.bulkAdd(clean.memos)
  if (clean.memoImages?.length) await db.memoImages.bulkAdd(clean.memoImages)
  if (clean.memoVersions?.length) await db.memoVersions.bulkAdd(clean.memoVersions)
  if (clean.demianChats?.length) await db.demianChats.bulkAdd(clean.demianChats)
  if (clean.pendingSyncs.length) await db.pendingSyncs.bulkAdd(clean.pendingSyncs)
}

/**
 * Establish `uid` as the owner of the local data before any sync runs (see header).
 * Everything happens in ONE readwrite transaction over every affected table, so a
 * concurrent write (another tab, a live listener) can't slip in between the snapshot and
 * the reset, and two tabs signing in at once resolve the switch exactly once.
 */
export async function claimLocalData(uid: string, email?: string): Promise<ClaimResult> {
  return db.transaction(
    'rw',
    [db.syncMeta, db.orphanBackups, db.memos, db.folders, db.memoImages, db.memoVersions,
     db.demianChats, db.pendingSyncs, db.fileSyncMap, db.embeddings],
    async (): Promise<ClaimResult> => {
      const owner = await getLocalOwner()
      const now = nowISO()
      const newOwner: LocalOwner = { uid, ...(email ? { email } : {}), since: now }

      if (!owner) {
        await db.syncMeta.put({ key: OWNER_KEY, value: newOwner })
        return { kind: 'adopted' }
      }
      if (owner.uid === uid) {
        if (email && owner.email !== email) await db.syncMeta.put({ key: OWNER_KEY, value: { ...owner, email } })
        return { kind: 'same' }
      }

      // ── A different account: set the previous account's data aside ──
      const synced = (await db.syncMeta.get(SYNCED_THROUGH_KEY))?.value as SyncedThrough | undefined
      const syncedThrough = synced?.uid === owner.uid ? synced.at : null
      const data: OrphanBackupData = {
        memos: await db.memos.toArray(),
        folders: await db.folders.toArray(),
        memoImages: await db.memoImages.toArray(),
        memoVersions: await db.memoVersions.toArray(),
        demianChats: await db.demianChats.toArray(),
        pendingSyncs: await db.pendingSyncs.toArray(),
      }
      const unsynced = findUnsyncedMemoSyncIds(data, syncedThrough)
      let backupId: number | null = null
      if (hasLocalContent(data)) {
        backupId = await db.orphanBackups.add({
          ownerUid: owner.uid,
          ...(owner.email ? { ownerEmail: owner.email } : {}),
          createdAt: now,
          reason: 'account-switch',
          syncedThrough,
          memoCount: data.memos.length,
          unsyncedMemoCount: unsynced.count,
          unsyncedMemoSyncIds: unsynced.syncIds,
          pendingOpCount: data.pendingSyncs.length,
          data,
        })
      }

      await db.memos.clear()
      await db.folders.clear()
      await db.memoImages.clear()
      await db.memoVersions.clear()
      await db.demianChats.clear()
      await db.pendingSyncs.clear()
      await db.fileSyncMap.clear()
      await db.embeddings.clear()

      // Bring back this account's own data from an earlier switch-away on this device.
      const own = (await db.orphanBackups.where('ownerUid').equals(uid).toArray())
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))[0]
      if (own?.id != null) {
        await restoreSnapshotRows(own)
        await db.orphanBackups.delete(own.id)
      } else {
        await db.folders.bulkAdd(seedFolders())
      }

      await db.syncMeta.put({ key: OWNER_KEY, value: newOwner })
      if (own?.syncedThrough) {
        await db.syncMeta.put({ key: SYNCED_THROUGH_KEY, value: { uid, at: own.syncedThrough } satisfies SyncedThrough })
      } else {
        await db.syncMeta.delete(SYNCED_THROUGH_KEY)
      }

      return {
        kind: 'switched',
        previousUid: owner.uid,
        backupId,
        unsyncedMemoCount: unsynced.count,
        restoredOwnBackup: own?.id != null,
      }
    },
  )
}

// ─── Orphan backups (Settings) ──────────────────────────────────────────────

export type OrphanBackupSummary = Omit<OrphanBackup, 'data' | 'unsyncedMemoSyncIds'> & { id: number }

export async function listOrphanBackups(): Promise<OrphanBackupSummary[]> {
  const rows = await db.orphanBackups.toArray()
  return rows
    .filter((b): b is OrphanBackup & { id: number } => b.id != null)
    .map(({ data: _data, unsyncedMemoSyncIds: _ids, ...summary }) => summary)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
}

/** The snapshot as a regular backup file (restorable via Settings › 데이터 복원). */
export async function getOrphanBackupFile(id: number): Promise<BackupFile | null> {
  const backup = await db.orphanBackups.get(id)
  if (!backup) return null
  return {
    version: BACKUP_CONFIG.CURRENT_VERSION,
    appName: BACKUP_CONFIG.APP_NAME,
    exportDate: backup.createdAt,
    data: {
      memos: backup.data.memos,
      folders: backup.data.folders,
      memoImages: backup.data.memoImages,
      memoVersions: backup.data.memoVersions,
      demianChats: backup.data.demianChats.map((c) => ({ memoId: c.memoId, messages: c.messages, updatedAt: c.updatedAt })),
      settings: {},
    },
  }
}

export async function deleteOrphanBackup(id: number): Promise<void> {
  await db.orphanBackups.delete(id)
}
