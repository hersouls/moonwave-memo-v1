import Dexie, { type Table } from 'dexie'
import type { Memo, Folder, MemoImage, MemoVersion, AmbientImage } from '@/lib/types'
import { generateSyncId } from '@/utils/id'
import { nowISO } from '@/lib/dateUtils'
import { DEFAULT_FOLDERS, SYSTEM_FOLDERS } from '@/utils/constants'

// Maps a memo (by its stable syncId) to the file it was last written to, so the
// sync-folder layer can detect renames (title changed → old path differs) and skip
// no-op rewrites (contentHash unchanged). Device-local; never synced.
export interface FileSyncRecord {
  memoSyncId: string
  filePath: string
  contentHash: string
  /** All files written for this memo (md and/or html). Undefined = legacy single [filePath]. */
  files?: string[]
  lastWrittenAt: string
}

// 지식 그래프 AI 연결용 메모 임베딩 캐시. 디바이스 로컬 — Firestore 동기화 제외.
// updatedAt이 메모와 일치할 때만 유효(내용 변경 시 재계산).
export interface MemoEmbedding {
  memoId: number
  updatedAt: string
  vector: number[]
}

// A mirror (NAS) write/delete that failed and must be retried (§4.6 pendingFileOps).
// Device-local. `payload` holds the text (writeText) or data URL (writeBinary).
export type PendingFileOpType = 'writeText' | 'writeBinary' | 'delete'
export interface PendingFileOp {
  id?: number
  op: PendingFileOpType
  targetKey: string
  filePath: string
  payload?: string
  attempts: number
  nextRetryAt: string
  createdAt: string
}

class MemoDatabase extends Dexie {
  memos!: Table<Memo>
  folders!: Table<Folder>
  memoImages!: Table<MemoImage>
  memoVersions!: Table<MemoVersion>
  ambientImages!: Table<AmbientImage>
  demianChats!: Table<{ id?: number; memoId: number; messages: Array<{ role: string; content: string }>; updatedAt: string }>
  pendingSyncs!: Table<{ id?: number; type: string; action: string; syncId: string; createdAt: string }>
  // Sync-folder (Phase 1): per-memo file mapping + device-local key-value store.
  // Both are device-local and intentionally excluded from Firestore sync (§4.8).
  fileSyncMap!: Table<FileSyncRecord>
  syncFolderKV!: Table<{ key: string; value: unknown }>
  // Sync-folder (Phase 2 M3): durable retry queue for failed NAS-mirror writes.
  pendingFileOps!: Table<PendingFileOp>
  // 지식 그래프 AI 연결: 메모 임베딩 캐시 (device-local).
  embeddings!: Table<MemoEmbedding>

  constructor() {
    super('MemoApp')

    this.version(1).stores({
      memos: '++id, folderId, isStarred, isPinned, createdAt, updatedAt, deletedAt, syncId, *tags',
      folders: '++id, name, isDefault, isSystem, sortOrder, syncId',
    })

    this.version(2).stores({
      memos: '++id, folderId, isStarred, isPinned, createdAt, updatedAt, deletedAt, syncId, *tags',
      folders: '++id, name, isDefault, isSystem, sortOrder, syncId',
      memoImages: '++id, memoId, syncId, createdAt',
    })

    this.version(3).stores({
      memos: '++id, folderId, isStarred, isPinned, createdAt, updatedAt, deletedAt, syncId, *tags',
      folders: '++id, name, isDefault, isSystem, sortOrder, syncId',
      memoImages: '++id, memoId, syncId, createdAt',
      memoVersions: '++id, memoId, createdAt',
    })

    this.version(4).stores({
      memos: '++id, folderId, isStarred, isPinned, createdAt, updatedAt, deletedAt, syncId, *tags',
      folders: '++id, name, isDefault, isSystem, sortOrder, syncId',
      memoImages: '++id, memoId, syncId, createdAt',
      memoVersions: '++id, memoId, createdAt',
      ambientImages: '++id, type, generatedAt, expiresAt',
    })

    this.version(5).stores({
      memos: '++id, folderId, isStarred, isPinned, createdAt, updatedAt, deletedAt, syncId, *tags',
      folders: '++id, name, isDefault, isSystem, sortOrder, syncId',
      memoImages: '++id, memoId, syncId, createdAt',
      memoVersions: '++id, memoId, createdAt',
      ambientImages: '++id, type, generatedAt, expiresAt',
      demianChats: '++id, &memoId, updatedAt',
    })

    this.version(6).stores({
      memos: '++id, folderId, isStarred, isPinned, createdAt, updatedAt, deletedAt, syncId, *tags',
      folders: '++id, name, isDefault, isSystem, sortOrder, syncId',
      memoImages: '++id, memoId, syncId, createdAt',
      memoVersions: '++id, memoId, createdAt',
      ambientImages: '++id, type, generatedAt, expiresAt',
      demianChats: '++id, &memoId, updatedAt',
      pendingSyncs: '++id, type, syncId, createdAt',
    })

    // v7: sync-folder support (§Phase 1). Existing 7 stores carried forward
    // unchanged; two device-local stores added. Dexie has no downgrade path —
    // a rollback below v7 requires a JSON backup (§10 호환성·마이그레이션).
    this.version(7).stores({
      memos: '++id, folderId, isStarred, isPinned, createdAt, updatedAt, deletedAt, syncId, *tags',
      folders: '++id, name, isDefault, isSystem, sortOrder, syncId',
      memoImages: '++id, memoId, syncId, createdAt',
      memoVersions: '++id, memoId, createdAt',
      ambientImages: '++id, type, generatedAt, expiresAt',
      demianChats: '++id, &memoId, updatedAt',
      pendingSyncs: '++id, type, syncId, createdAt',
      fileSyncMap: '&memoSyncId, filePath',
      syncFolderKV: '&key',
    })

    // v8: Phase 2 M3 mirror retry queue. All prior stores carried forward.
    this.version(8).stores({
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
    })

    // v9: 지식 그래프 AI 연결 — 메모 임베딩 캐시 추가. 이전 스토어 전부 유지.
    this.version(9).stores({
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
    })

    this.on('populate', () => {
      const now = nowISO()
      const allFolders = [...DEFAULT_FOLDERS, ...SYSTEM_FOLDERS]
      allFolders.forEach((f, i) => {
        this.folders.add({
          name: f.name,
          color: f.color,
          sortOrder: i,
          isDefault: f.isDefault,
          isSystem: f.isSystem,
          // Stable canonical syncId so seed folders stay unified across devices
          syncId: f.syncId,
          createdAt: now,
          updatedAt: now,
        })
      })
    })
  }
}

export const db = new MemoDatabase()

// ─── Memo CRUD ─────────────────────────────────────

export async function getAllMemos(): Promise<Memo[]> {
  return db.memos.toArray()
}

export async function getActiveMemos(): Promise<Memo[]> {
  return db.memos.filter((m) => !m.deletedAt).toArray()
}

export async function getMemo(id: number): Promise<Memo | undefined> {
  return db.memos.get(id)
}

export async function addMemo(memo: Omit<Memo, 'id'>): Promise<number> {
  const now = nowISO()
  const data: Omit<Memo, 'id'> = {
    ...memo,
    syncId: memo.syncId || generateSyncId(),
    createdAt: memo.createdAt || now,
    updatedAt: memo.updatedAt || now,
  }
  return db.memos.add(data as Memo) as unknown as number
}

export async function updateMemo(id: number, updates: Partial<Memo>): Promise<void> {
  // updatedAt is the last-write-wins sync key. Local edits leave it unset so we
  // stamp `now`, but remote-apply paths pass the writer's updatedAt explicitly so
  // the local replica adopts the sender's clock instead of the receiver's.
  await db.memos.update(id, {
    ...updates,
    updatedAt: updates.updatedAt ?? nowISO(),
  })
}

// Write device-local memo metadata (accessLog, syncId backfill) WITHOUT advancing
// updatedAt. Such fields are never uploaded (pushMemo excludes them), so touching
// the LWW timestamp would falsely mark the memo newer and reject real remote edits.
export async function updateMemoLocalMeta(id: number, changes: Partial<Memo>): Promise<void> {
  await db.memos.update(id, changes)
}

export async function softDeleteMemo(id: number): Promise<void> {
  await db.memos.update(id, {
    deletedAt: nowISO(),
    updatedAt: nowISO(),
  })
}

export async function restoreMemo(id: number): Promise<void> {
  await db.memos.update(id, {
    deletedAt: undefined,
    updatedAt: nowISO(),
  })
}

export async function permanentDeleteMemo(id: number): Promise<void> {
  // Atomic: a crash mid-delete must not strip images/versions off a memo that
  // survives, nor leave orphaned child rows behind. Also drop the cached embedding so
  // it doesn't accumulate for deleted memos.
  await db.transaction('rw', db.memos, db.memoImages, db.memoVersions, db.embeddings, async () => {
    await db.memoImages.where('memoId').equals(id).delete()
    await db.memoVersions.where('memoId').equals(id).delete()
    await db.embeddings.delete(id)
    await db.memos.delete(id)
  })
}

export async function emptyTrash(): Promise<void> {
  await db.transaction('rw', db.memos, db.memoImages, db.memoVersions, db.embeddings, async () => {
    const deleted = await db.memos.filter((m) => !!m.deletedAt).toArray()
    const ids = deleted.map((m) => m.id!).filter(Boolean)
    for (const id of ids) {
      await db.memoImages.where('memoId').equals(id).delete()
      await db.memoVersions.where('memoId').equals(id).delete()
      await db.embeddings.delete(id)
    }
    await db.memos.bulkDelete(ids)
  })
}

export async function getMemosByFolder(folderId: number): Promise<Memo[]> {
  return db.memos.where('folderId').equals(folderId).filter((m) => !m.deletedAt).toArray()
}

export async function getStarredMemos(): Promise<Memo[]> {
  return db.memos.filter((m) => m.isStarred && !m.deletedAt).toArray()
}

export async function getDeletedMemos(): Promise<Memo[]> {
  return db.memos.filter((m) => !!m.deletedAt).toArray()
}

export async function getMemoBySyncId(syncId: string): Promise<Memo | undefined> {
  return db.memos.where('syncId').equals(syncId).first()
}

// Bulk operations
export async function bulkUpdateMemos(ids: number[], updates: Partial<Memo>): Promise<void> {
  const now = nowISO()
  await db.memos.where('id').anyOf(ids).modify({ ...updates, updatedAt: now })
}

export async function bulkSoftDeleteMemos(ids: number[]): Promise<void> {
  const now = nowISO()
  await db.memos.where('id').anyOf(ids).modify({ deletedAt: now, updatedAt: now })
}

export async function bulkMoveMemos(ids: number[], folderId: number): Promise<void> {
  const now = nowISO()
  await db.memos.where('id').anyOf(ids).modify({ folderId, updatedAt: now })
}

// ─── Folder CRUD ───────────────────────────────────

export async function getAllFolders(): Promise<Folder[]> {
  return db.folders.orderBy('sortOrder').toArray()
}

export async function getFolder(id: number): Promise<Folder | undefined> {
  return db.folders.get(id)
}

export async function addFolder(folder: Omit<Folder, 'id'>): Promise<number> {
  const now = nowISO()
  const count = await db.folders.count()
  return db.folders.add({
    ...folder,
    syncId: folder.syncId || generateSyncId(),
    sortOrder: folder.sortOrder ?? count,
    createdAt: folder.createdAt || now,
    updatedAt: folder.updatedAt || now,
  } as Folder) as unknown as number
}

export async function updateFolder(id: number, updates: Partial<Folder>): Promise<void> {
  await db.folders.update(id, {
    ...updates,
    updatedAt: updates.updatedAt ?? nowISO(),
  })
}

export async function deleteFolder(id: number, opts?: { bumpMemos?: boolean }): Promise<void> {
  // Move all memos from this folder to the default folder. When the deletion is
  // user-initiated (bumpMemos) we advance updatedAt so the relocation wins LWW and
  // can be pushed; when it's a remote-applied delete we leave updatedAt untouched to
  // avoid a re-push storm (the originating device already pushed the relocation).
  const relocate = opts?.bumpMemos
    ? { folderId: 0 as number | null, updatedAt: nowISO() }
    : { folderId: 0 as number | null }
  const defaultFolder = await db.folders.filter((f) => f.isDefault).first()
  relocate.folderId = defaultFolder?.id ?? null
  await db.memos.where('folderId').equals(id).modify(relocate)
  await db.folders.delete(id)
}

export async function getFolderBySyncId(syncId: string): Promise<Folder | undefined> {
  return db.folders.where('syncId').equals(syncId).first()
}

export async function getMemoCountByFolder(folderId: number): Promise<number> {
  return db.memos.where('folderId').equals(folderId).filter((m) => !m.deletedAt).count()
}

// All memos in a folder, including soft-deleted ones (used by sync dedupe).
export async function getMemosByFolderId(folderId: number): Promise<Memo[]> {
  return db.memos.where('folderId').equals(folderId).toArray()
}

// Move every memo from one folder to another without altering folder records.
export async function moveMemosToFolder(fromFolderId: number, toFolderId: number): Promise<void> {
  await db.memos.where('folderId').equals(fromFolderId).modify({ folderId: toFolderId, updatedAt: nowISO() })
}

// Delete a folder record only — does NOT relocate its memos (caller handles that).
export async function removeFolderRecord(id: number): Promise<void> {
  await db.folders.delete(id)
}

// ─── MemoImage CRUD ───────────────────────────────

export async function addMemoImage(image: Omit<MemoImage, 'id'>): Promise<number> {
  return db.memoImages.add(image as MemoImage) as unknown as number
}

export async function getMemoImage(id: number): Promise<MemoImage | undefined> {
  return db.memoImages.get(id)
}

export async function getImagesByMemoId(memoId: number): Promise<MemoImage[]> {
  return db.memoImages.where('memoId').equals(memoId).toArray()
}

export async function deleteMemoImage(id: number): Promise<void> {
  await db.memoImages.delete(id)
}

export async function deleteImagesByMemoId(memoId: number): Promise<void> {
  await db.memoImages.where('memoId').equals(memoId).delete()
}

// ─── MemoVersion CRUD ────────────────────────────

export async function addMemoVersion(version: Omit<MemoVersion, 'id'>): Promise<number> {
  return db.memoVersions.add(version as MemoVersion) as unknown as number
}

export async function getVersionsByMemoId(memoId: number): Promise<MemoVersion[]> {
  const versions = await db.memoVersions.where('memoId').equals(memoId).sortBy('createdAt')
  return versions.reverse()
}

export async function getMemoVersion(id: number): Promise<MemoVersion | undefined> {
  return db.memoVersions.get(id)
}

export async function deleteVersionsByMemoId(memoId: number): Promise<void> {
  await db.memoVersions.where('memoId').equals(memoId).delete()
}

// ─── AmbientImage CRUD ──────────────────────────

export async function getAmbientImage(type: 'ambient' | 'world-building'): Promise<AmbientImage | undefined> {
  const now = new Date().toISOString()
  const imgs = await db.ambientImages
    .where('type').equals(type)
    .filter((img) => img.expiresAt > now)
    .sortBy('generatedAt')
  return imgs.at(-1) // most recently generated
}

export async function saveAmbientImage(image: Omit<AmbientImage, 'id'>): Promise<number> {
  // Remove old images of the same type (keep max 3)
  const existing = await db.ambientImages.where('type').equals(image.type).sortBy('generatedAt')
  if (existing.length >= 3) {
    const toDelete = existing.slice(0, existing.length - 2).map((i) => i.id!).filter(Boolean)
    await db.ambientImages.bulkDelete(toDelete)
  }
  return db.ambientImages.add(image as AmbientImage) as unknown as number
}

export async function clearExpiredAmbientImages(): Promise<void> {
  const now = new Date().toISOString()
  await db.ambientImages.filter((img) => img.expiresAt <= now).delete()
}

// ─── Sync-folder mapping (device-local) ───────────────

export async function getFileSyncRecord(memoSyncId: string): Promise<FileSyncRecord | undefined> {
  return db.fileSyncMap.get(memoSyncId)
}

export async function getFileSyncRecordByPath(filePath: string): Promise<FileSyncRecord | undefined> {
  return db.fileSyncMap.where('filePath').equals(filePath).first()
}

export async function putFileSyncRecord(record: FileSyncRecord): Promise<void> {
  await db.fileSyncMap.put(record)
}

export async function deleteFileSyncRecord(memoSyncId: string): Promise<void> {
  await db.fileSyncMap.delete(memoSyncId)
}

export async function countFileSyncRecords(): Promise<number> {
  return db.fileSyncMap.count()
}

export async function clearFileSyncMap(): Promise<void> {
  await db.fileSyncMap.clear()
}

// ─── Sync-folder key-value (device-local; e.g. directory handle) ──

export async function getSyncFolderValue<T>(key: string): Promise<T | undefined> {
  const row = await db.syncFolderKV.get(key)
  return row?.value as T | undefined
}

export async function setSyncFolderValue(key: string, value: unknown): Promise<void> {
  await db.syncFolderKV.put({ key, value })
}

export async function deleteSyncFolderValue(key: string): Promise<void> {
  await db.syncFolderKV.delete(key)
}

// ─── Sync-folder mirror retry queue (device-local, §4.6) ──

// Enqueue a failed mirror op. A newer op for the same (target, path) supersedes the
// older one — we only need the latest intended state for that file on that mirror.
export async function enqueuePendingFileOp(op: Omit<PendingFileOp, 'id'>): Promise<void> {
  await db.transaction('rw', db.pendingFileOps, async () => {
    await db.pendingFileOps.where('[targetKey+filePath]').equals([op.targetKey, op.filePath]).delete()
    await db.pendingFileOps.add(op as PendingFileOp)
  })
}

export async function getDuePendingFileOps(nowIso: string, limit = 100): Promise<PendingFileOp[]> {
  return db.pendingFileOps.where('nextRetryAt').belowOrEqual(nowIso).limit(limit).toArray()
}

export async function updatePendingFileOp(id: number, changes: Partial<PendingFileOp>): Promise<void> {
  await db.pendingFileOps.update(id, changes)
}

export async function deletePendingFileOp(id: number): Promise<void> {
  await db.pendingFileOps.delete(id)
}

export async function deletePendingFileOpsByTarget(targetKey: string): Promise<void> {
  await db.pendingFileOps.where('targetKey').equals(targetKey).delete()
}

export async function countPendingFileOps(): Promise<number> {
  return db.pendingFileOps.count()
}

export async function clearPendingFileOps(): Promise<void> {
  await db.pendingFileOps.clear()
}
