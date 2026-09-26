import type { Memo, Folder, MemoImage, MemoVersion, BackupDemianChat } from '@/lib/types'

// syncId is the cross-device identity of a memo/folder and the Firestore doc id, so it
// must be unique per table (Dexie v11 enforces it with `&syncId`). Earlier builds could
// store the same syncId twice (two tabs applying one incoming change, restored backups),
// so everything that writes rows in bulk — the v10 migration, backup restore, the
// account-switch stash restore — collapses duplicates with this one rule first.

interface SyncIdRow {
  id?: number
  syncId?: unknown
  updatedAt?: string
}

/** A usable sync identity: a non-empty string (always a valid IndexedDB key). */
export function isValidSyncId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

export interface SyncIdDedupePlan<T> {
  /** Duplicate rows to remove, each paired with the row that survives for its syncId. */
  losers: Array<{ loser: T; survivor: T }>
  /** Rows carrying an unusable syncId ('' / null / non-string). Clearing it keeps them
   *  out of the unique index; the next sync merge backfills a fresh one. */
  invalid: T[]
}

// Newest updatedAt wins — it is the version last-write-wins would keep anyway. Ties go
// to the oldest row id so every run (and every device) picks the same survivor.
function pickSurvivor<T extends SyncIdRow>(group: T[]): T {
  return group.reduce((best, row) => {
    const a = row.updatedAt ?? ''
    const b = best.updatedAt ?? ''
    if (a > b) return row
    if (a === b && (row.id ?? Number.MAX_SAFE_INTEGER) < (best.id ?? Number.MAX_SAFE_INTEGER)) return row
    return best
  })
}

export function planSyncIdDedupe<T extends SyncIdRow>(rows: T[]): SyncIdDedupePlan<T> {
  const groups = new Map<string, T[]>()
  const invalid: T[] = []
  for (const row of rows) {
    if (row.syncId === undefined) continue
    if (!isValidSyncId(row.syncId)) {
      invalid.push(row)
      continue
    }
    const group = groups.get(row.syncId)
    if (group) group.push(row)
    else groups.set(row.syncId, [row])
  }
  const losers: Array<{ loser: T; survivor: T }> = []
  for (const group of groups.values()) {
    if (group.length < 2) continue
    const survivor = pickSurvivor(group)
    for (const row of group) if (row !== survivor) losers.push({ loser: row, survivor })
  }
  return { losers, invalid }
}

/** True when a removed duplicate's text differs from the survivor's, i.e. dropping it
 *  would lose words — callers keep such text as a version of the survivor. */
export function duplicateHasDistinctText(loser: Pick<Memo, 'title' | 'body'>, survivor: Pick<Memo, 'title' | 'body'>): boolean {
  return (loser.title ?? '') !== (survivor.title ?? '') || (loser.body ?? '') !== (survivor.body ?? '')
}

function withoutSyncId<T extends { syncId?: string }>(row: T): T {
  const copy = { ...row }
  delete copy.syncId
  return copy
}

export interface SyncRowsBundle {
  memos: Memo[]
  folders: Folder[]
  memoImages?: MemoImage[]
  memoVersions?: MemoVersion[]
  demianChats?: BackupDemianChat[]
}

/**
 * In-memory counterpart of the v10 migration for bulk inserts: collapses duplicate
 * syncIds (newest updatedAt wins), re-points memos of dropped duplicate folders and the
 * child rows (images/versions/chats) of dropped duplicate memos onto the survivors,
 * keeps a dropped duplicate's differing text as a version of its survivor, and clears
 * unusable syncIds. Rows are never mutated in place.
 */
export function dedupeSyncRows<D extends SyncRowsBundle>(data: D): D {
  const folderPlan = planSyncIdDedupe(data.folders)
  const droppedFolders = new Set(folderPlan.losers.map(({ loser }) => loser))
  const invalidFolders = new Set(folderPlan.invalid)
  const folderRemap = new Map<number, number>()
  for (const { loser, survivor } of folderPlan.losers) {
    if (loser.id != null && survivor.id != null) folderRemap.set(loser.id, survivor.id)
  }
  const folders = data.folders
    .filter((f) => !droppedFolders.has(f))
    .map((f) => (invalidFolders.has(f) ? withoutSyncId(f) : f))

  const memoPlan = planSyncIdDedupe(data.memos)
  const droppedMemos = new Set(memoPlan.losers.map(({ loser }) => loser))
  const invalidMemos = new Set(memoPlan.invalid)
  const memoRemap = new Map<number, number>()
  const rescuedVersions: MemoVersion[] = []
  for (const { loser, survivor } of memoPlan.losers) {
    if (loser.id == null || survivor.id == null) continue
    memoRemap.set(loser.id, survivor.id)
    if (duplicateHasDistinctText(loser, survivor)) {
      rescuedVersions.push({
        memoId: survivor.id,
        title: loser.title ?? '',
        body: loser.body ?? '',
        createdAt: loser.updatedAt || loser.createdAt || new Date().toISOString(),
      })
    }
  }
  const memos = data.memos
    .filter((m) => !droppedMemos.has(m))
    .map((m) => (invalidMemos.has(m) ? withoutSyncId(m) : m))
    .map((m) => (m.folderId != null && folderRemap.has(m.folderId) ? { ...m, folderId: folderRemap.get(m.folderId)! } : m))

  const remapMemoId = <R extends { memoId: number }>(row: R): R =>
    memoRemap.has(row.memoId) ? { ...row, memoId: memoRemap.get(row.memoId)! } : row

  // demianChats is unique per memo: when a dropped duplicate and its survivor both had
  // a chat, keep a single thread holding both conversations.
  let demianChats = data.demianChats
  if (demianChats) {
    const byMemo = new Map<number, BackupDemianChat>()
    for (const chat of demianChats.map(remapMemoId)) {
      const existing = byMemo.get(chat.memoId)
      if (!existing) byMemo.set(chat.memoId, chat)
      else byMemo.set(chat.memoId, { ...existing, messages: [...existing.messages, ...chat.messages] })
    }
    demianChats = [...byMemo.values()]
  }

  return {
    ...data,
    folders,
    memos,
    memoImages: data.memoImages?.map(remapMemoId),
    memoVersions: data.memoVersions === undefined && rescuedVersions.length === 0
      ? undefined
      : [...(data.memoVersions ?? []).map(remapMemoId), ...rescuedVersions],
    demianChats,
  }
}
