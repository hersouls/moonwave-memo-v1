/**
 * Sync-folder orchestration (§4 공통 설계 명세 실행부).
 *
 * Ties the pure serializer + FileSyncTarget to the app's data + state:
 *   - debounced file writes decoupled from the 500ms Dexie/Firestore autosave (§4.6)
 *   - rename detection + contentHash no-op skip to avoid rewrite loops (§4.5)
 *   - deletion mapping: soft/permanent delete removes the file (§4.3)
 *   - ephemeral memos excluded from folder writes (§4.3)
 *   - folder → subdirectory mapping, system trash folder excluded (§4.3)
 *   - Web Locks single-writer per target to serialize concurrent tabs (§4.7)
 *
 * The directory handle is persisted in IndexedDB (syncFolderKV); config lives in the
 * device-local syncFolderStore. This module never imports memoStore (avoids a cycle) —
 * it reads memos from the database layer directly.
 */
import type { Memo } from '@/lib/types'
import { nowISO } from '@/lib/dateUtils'
import { generateSyncId } from '@/utils/id'
import { extractTags } from '@/lib/tagParser'
import {
  getMemo,
  getActiveMemos,
  getFolder,
  getAllFolders,
  getMemoImage,
  getMemoBySyncId,
  addMemo,
  updateMemo as dbUpdateMemo,
  softDeleteMemo,
  getFileSyncRecord,
  getFileSyncRecordByPath,
  getFileSyncRecordsUnderDir,
  putFileSyncRecord,
  deleteFileSyncRecord,
  countFileSyncRecords,
  clearFileSyncMap,
  getSyncFolderValue,
  setSyncFolderValue,
  deleteSyncFolderValue,
  enqueuePendingFileOp,
  getDuePendingFileOps,
  updatePendingFileOp,
  deletePendingFileOp,
  deletePendingFileOpsByTarget,
  countPendingFileOps,
  clearPendingFileOps,
  type PendingFileOp,
} from '@/services/database'
import { pushMemo } from '@/services/firestoreSync'
import DOMPurify from 'dompurify'
import { useSyncFolderStore, type SyncFolderFormat } from '@/stores/syncFolderStore'
import { htmlToMarkdown } from '@/lib/markdownHtml'
import { serializeMemo, serializeMemoHtml, deserializeMemo, type ImageResolver, type AssetRef, type SerializedMemo } from './serializer'
import { contentHash } from './hash'
import { sanitizeSegment } from './filename'
import { decideImport, type FileEvent } from './importer'
import { pathsOverlap } from './pathOverlap'
import { planWatch } from './watchPlan'
import { planRetry } from './mirrorQueue'
import { dataUrlToBlob, type FileSyncTarget } from './FileSyncTarget'
import {
  isSyncFolderSupported,
  isElectron,
  pickFolder,
  pickMirror,
  buildIpcTarget,
  restoreTarget,
  requestPermissionFor,
  watchRootFromRef,
} from './platform'

// KV key kept as 'dirHandle' for backward-compat with Phase 1's stored handle.
const REF_KEY = 'dirHandle'
const FILE_WRITE_DEBOUNCE_MS = 2000

// Module-level runtime state (single instance per tab).
let target: FileSyncTarget | null = null
const writeTimers = new Map<number, ReturnType<typeof setTimeout>>()

// Paths this tab just deleted itself (during a rename/format change). The watcher emits
// an 'unlink' echo for each; without this guard that echo can be misread as a user
// deleting the file and soft-delete the just-renamed memo (§4.5 rename race).
const recentSelfDeletes = new Map<string, number>()
const SELF_DELETE_TTL_MS = 10_000

function markSelfDelete(path: string): void {
  const now = Date.now()
  recentSelfDeletes.set(path, now)
  for (const [p, t] of recentSelfDeletes) {
    if (now - t > SELF_DELETE_TTL_MS) recentSelfDeletes.delete(p)
  }
}

function isRecentSelfDelete(path: string): boolean {
  const t = recentSelfDeletes.get(path)
  if (t == null) return false
  if (Date.now() - t > SELF_DELETE_TTL_MS) {
    recentSelfDeletes.delete(path)
    return false
  }
  return true
}

// ─── Capability ──────────────────────────────────────

// Re-exported from the platform layer (Electron native fs OR web File System Access).
export { isSyncFolderSupported }

// ─── Web Locks single-writer (§4.7) ──────────────────

async function withLock<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined
  if (!locks?.request) return fn()
  return locks.request(`syncFolder:${name}`, fn) as Promise<T>
}

// ─── Resolvers ───────────────────────────────────────

const resolveImage: ImageResolver = async (numericId) => {
  const img = await getMemoImage(numericId)
  return img ? { syncId: img.syncId, data: img.data } : undefined
}

/** Folder display name for a memo, or undefined for root. System (trash) folders map to root. */
async function resolveFolderName(memo: Memo): Promise<string | undefined> {
  if (memo.folderId == null) return undefined
  const folder = await getFolder(memo.folderId)
  if (!folder || folder.isSystem) return undefined
  return sanitizeSegment(folder.name)
}

// ─── Permission / handle lifecycle ───────────────────

function setActiveTarget(t: FileSyncTarget, displayName: string, watchRoot?: string | null): void {
  target = t
  const store = useSyncFolderStore.getState()
  store.setFolderName(displayName)
  store.setStatus('idle')
  void countFileSyncRecords().then((n) => store.setFileCount(n))
  // Phase 2 M2: watch the folder for external edits (Electron only) → §4.4 양방향.
  resetCircuitBreaker()
  if (watchRoot) startWatching(watchRoot)
  // Phase 2 M3: build NAS mirror targets + start the retry-queue flusher (§4.6).
  rebuildMirrors()
  if (isElectron()) startMirrorFlush()
}

/**
 * Restore the persisted folder ref and (silently) verify access. Called on app start.
 * Electron rebuilds a target from the stored path; web FSA verifies the persisted
 * handle's permission (Chrome 122+ persists it). Otherwise → 'needs-permission'.
 */
export async function initSyncFolder(): Promise<void> {
  const store = useSyncFolderStore.getState()
  if (!store.enabled || !isSyncFolderSupported()) return
  try {
    const ref = await getSyncFolderValue<unknown>(REF_KEY)
    const result = await restoreTarget(ref)
    if (result.status === 'ok') {
      setActiveTarget(result.target, result.displayName, watchRootFromRef(ref))
    } else {
      if (result.status === 'needs-permission') store.setFolderName(result.displayName)
      store.setStatus('needs-permission')
    }
  } catch (err) {
    console.error('Sync folder init failed:', err)
    store.setStatus('error', '동기화 폴더를 복원하지 못했습니다.')
  }
}

/** Outcome of pickSyncFolder — the settings UI maps these to toasts ('error' surfaces via status). */
export type PickFolderResult = 'picked' | 'cancelled' | 'overlaps-mirror' | 'error'

/** Prompt the user to pick a folder (user gesture). Persists the ref and enables. */
export async function pickSyncFolder(): Promise<PickFolderResult> {
  if (!isSyncFolderSupported()) return 'cancelled'
  const store = useSyncFolderStore.getState()
  try {
    const picked = await pickFolder()
    if (!picked) {
      // null = cancelled or permission denied; only flag the latter if already on.
      if (store.enabled) store.setStatus('needs-permission')
      return 'cancelled'
    }
    // 겹침 가드(§4.6): 미러와 같거나 상·하위인 주 폴더는 이중 쓰기·감시 루프를 만들므로 거부.
    // 기존 폴더/상태는 그대로 유지된다.
    const newRoot = watchRootFromRef(picked.ref)
    if (newRoot && store.mirrors.some((m) => pathsOverlap(m.path, newRoot))) {
      return 'overlaps-mirror'
    }
    // The fileSyncMap maps memos to files in the PREVIOUS folder. If we keep it, the
    // no-op content-hash skip in writeMemoNow suppresses every write into the new
    // (empty) folder — a full export would silently write nothing. Clear it so the new
    // folder actually gets populated. Export rewrites are idempotent, so this is safe
    // even when re-picking the same folder.
    await clearFileSyncMap()
    await setSyncFolderValue(REF_KEY, picked.ref)
    store.setEnabled(true)
    setActiveTarget(picked.target, picked.displayName, watchRootFromRef(picked.ref))
    return 'picked'
  } catch (err) {
    // AbortError = user cancelled the picker; not an error worth surfacing.
    if ((err as DOMException)?.name === 'AbortError') return 'cancelled'
    console.error('Sync folder pick failed:', err)
    store.setStatus('error', '폴더를 선택하지 못했습니다.')
    return 'error'
  }
}

/** Re-grant access for the stored folder from a user gesture (reconnect button). */
export async function reconnectSyncFolder(): Promise<boolean> {
  if (!isSyncFolderSupported()) return false
  const store = useSyncFolderStore.getState()
  try {
    const ref = await getSyncFolderValue<unknown>(REF_KEY)
    const result = await requestPermissionFor(ref)
    if (!result.ok || !result.target) {
      store.setStatus('needs-permission')
      return false
    }
    setActiveTarget(result.target, result.displayName ?? store.folderName ?? '')
    return true
  } catch (err) {
    console.error('Sync folder reconnect failed:', err)
    store.setStatus('error', '폴더 권한을 다시 얻지 못했습니다.')
    return false
  }
}

/** Turn the feature off. Files on disk are the user's — they are NOT deleted (§10 rollback). */
export async function disableSyncFolder(): Promise<void> {
  stopWatching()
  stopMirrorFlush()
  for (const timer of writeTimers.values()) clearTimeout(timer)
  writeTimers.clear()
  target = null
  mirrorTargets = []
  await deleteSyncFolderValue(REF_KEY)
  await clearFileSyncMap()
  await clearPendingFileOps()
  useSyncFolderStore.getState().reset()
}

// ─── Ensuring readiness ──────────────────────────────

async function ensureReady(): Promise<boolean> {
  const store = useSyncFolderStore.getState()
  if (!store.enabled) return false
  if (target) return true
  await initSyncFolder()
  return target != null
}

// ─── Write / delete ──────────────────────────────────

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const s = new Set(a)
  return b.every((x) => s.has(x))
}

type WriteOutcome = 'written' | 'skipped' | 'error'

async function writeMemoNow(memo: Memo): Promise<WriteOutcome> {
  if (!target || !memo.syncId) return 'skipped'
  const store = useSyncFolderStore.getState()

  // Deleted → remove the file(s) instead of writing (§4.3).
  if (memo.deletedAt) {
    await deleteMemoFileNow(memo)
    return 'written'
  }
  // Ephemeral (1h brain-dump) memos are excluded from folder writes (§4.3).
  if (memo.ephemeralExpiresAt) return 'skipped'

  try {
    const folderName = await resolveFolderName(memo)
    const format = store.format
    // Build outputs for the chosen format (Phase 4 M2: md / html / both).
    const md = format === 'md' || format === 'both' ? await serializeMemo(memo, folderName, resolveImage) : null
    const html = format === 'html' || format === 'both' ? await serializeMemoHtml(memo, folderName, resolveImage) : null
    const outputs = [md, html].filter((o): o is SerializedMemo => o != null)
    if (!outputs.length) return 'skipped'

    const files = outputs.map((o) => o.filePath)
    const primary = md ?? html! // markdown is canonical when present (import identity)
    const hash = contentHash(primary.content)

    const existing = await getFileSyncRecord(memo.syncId)
    const oldFiles = existing?.files ?? (existing ? [existing.filePath] : [])
    // No-op skip: same content AND same file set → don't rewrite (prevents loops, §4.5).
    if (existing && existing.contentHash === hash && sameSet(oldFiles, files)) return 'skipped'

    store.setStatus('writing')

    // Write the new files FIRST, then repoint the fileSyncMap record, and only THEN
    // remove the stale old files. This ordering guarantees the record never points at a
    // path we've already deleted: if the new write throws, the old file+record are still
    // intact; once the record points at the new path, the old file's unlink echo can no
    // longer be resolved back to this memo (§4.5 rename race).
    for (const out of outputs) {
      await target.writeText(out.filePath, out.content)
      for (const asset of out.assets) {
        // Assets are immutable once written; skip if already present.
        if (!(await target.exists(asset.path))) {
          await target.writeBinary(asset.path, dataUrlToBlob(asset.dataUrl))
        }
      }
      // Mirror the write to NAS/copy folders (§4.6); failures queue for retry.
      await mirrorWrite(out.filePath, out.content, out.assets, null)
    }

    const at = nowISO()
    await putFileSyncRecord({ memoSyncId: memo.syncId, filePath: primary.filePath, contentHash: hash, files, lastWrittenAt: at })

    // Remove stale files: a rename (title/folder changed) or a format change (e.g.
    // both→md drops the .html) leaves files no longer in the current output set.
    for (const f of oldFiles.filter((p) => !files.includes(p))) {
      markSelfDelete(f)
      await target.deleteFile(f)
      await mirrorDelete(f)
    }

    store.setLastWritten(at)
    store.setFileCount(await countFileSyncRecords())
    store.setStatus('idle')
    return 'written'
  } catch (err) {
    console.error('Sync folder write failed:', err)
    store.setStatus('error', '폴더에 저장하지 못했습니다.')
    return 'error'
  }
}

async function deleteMemoFileNow(memo: Memo): Promise<void> {
  if (!target || !memo.syncId) return
  const store = useSyncFolderStore.getState()
  try {
    const rec = await getFileSyncRecord(memo.syncId)
    if (!rec) return
    for (const f of rec.files ?? [rec.filePath]) {
      markSelfDelete(f)
      await target.deleteFile(f)
      await mirrorDelete(f)
    }
    await deleteFileSyncRecord(memo.syncId)
    store.setFileCount(await countFileSyncRecords())
    store.setStatus('idle')
  } catch (err) {
    console.error('Sync folder delete failed:', err)
    store.setStatus('error', '폴더에서 삭제하지 못했습니다.')
  }
}

// ─── Public notification API (called by memoStore) ───

/**
 * A memo was created/updated. Debounced (§4.6) so a burst of 500ms autosaves collapses
 * into one file write, and title typing doesn't churn a sequence of renamed files.
 * No-op when the feature is disabled.
 */
export function notifyMemoSaved(memo: Memo): void {
  if (!useSyncFolderStore.getState().enabled) return
  const id = memo.id
  if (id == null) {
    // No stable id to debounce on — write immediately behind the lock.
    void ensureReady().then((ok) => { if (ok) return withLock(target!.key, () => writeMemoNow(memo)) })
    return
  }
  const prev = writeTimers.get(id)
  if (prev) clearTimeout(prev)
  writeTimers.set(id, setTimeout(() => {
    writeTimers.delete(id)
    void (async () => {
      if (!(await ensureReady())) return
      const fresh = await getMemo(id)
      if (fresh) await withLock(target!.key, () => writeMemoNow(fresh))
    })()
  }, FILE_WRITE_DEBOUNCE_MS))
}

/** A memo was deleted (soft/permanent). Removes its file. */
export function notifyMemoDeleted(memo: Memo): void {
  if (!useSyncFolderStore.getState().enabled || !memo.syncId) return
  const id = memo.id
  if (id != null) {
    const prev = writeTimers.get(id)
    if (prev) { clearTimeout(prev); writeTimers.delete(id) }
  }
  void ensureReady().then((ok) => { if (ok) return withLock(target!.key, () => deleteMemoFileNow(memo)) })
}

// ─── Folder lifecycle → directory mapping (§4.3 folder ⇄ subdirectory) ──────────
//
// The disk layer is memo-file driven: a folder's subdirectory is otherwise only created
// as a side-effect of writing a memo into it (writeMemoNow), so a newly-created *empty*
// folder never appears on disk, and a renamed/deleted folder leaves a stale directory.
// These three notifications keep the on-disk folder structure in step with folderStore.
// All run behind the single-writer lock and reuse writeMemoNow for the file moves, which
// already handles the new-path write + stale old-file delete + watcher self-delete guard.

/** Remove a now-empty folder directory on the primary + every mirror (best-effort). */
async function removeFolderDirEverywhere(seg: string): Promise<void> {
  if (!target || !seg) return
  try {
    await target.removeDir(seg)
  } catch (err) {
    console.error('Sync folder remove-dir failed:', err)
  }
  for (const m of mirrorTargets) {
    try { await m.removeDir(seg) } catch { /* mirror best-effort */ }
  }
}

/**
 * A folder was created — materialize its (empty) directory on disk + mirrors so it shows
 * up in the sync folder immediately, before any memo is placed in it. No-op when disabled.
 */
export async function notifyFolderCreated(name: string): Promise<void> {
  if (!useSyncFolderStore.getState().enabled) return
  if (!(await ensureReady()) || !target) return
  const seg = sanitizeSegment(name)
  await withLock(target.key, async () => {
    try {
      await target!.ensureDir(seg)
      for (const m of mirrorTargets) {
        try { await m.ensureDir(seg) } catch { /* mirror best-effort; real writes create it */ }
      }
    } catch (err) {
      console.error('Sync folder create-dir failed:', err)
      useSyncFolderStore.getState().setStatus('error', '폴더를 만들지 못했습니다.')
    }
  })
}

/**
 * A folder was renamed — move every memo file from the old directory into the new one and
 * drop the emptied old directory. The DB folder name is already updated before this runs,
 * so writeMemoNow resolves each memo to its new path and deletes the stale old file.
 */
export async function notifyFolderRenamed(folderId: number, oldName: string, newName: string): Promise<void> {
  if (!useSyncFolderStore.getState().enabled) return
  if (!(await ensureReady()) || !target) return
  const oldSeg = sanitizeSegment(oldName)
  const newSeg = sanitizeSegment(newName)
  await withLock(target.key, async () => {
    try {
      await target!.ensureDir(newSeg)
      const memos = (await getActiveMemos()).filter(
        (m) => m.folderId === folderId && !m.ephemeralExpiresAt && m.syncId,
      )
      for (const memo of memos) await writeMemoNow(memo)
      // Only drop the old dir when the sanitized name actually changed — a rename that
      // sanitizes to the same segment (e.g. trailing space) writes into the same folder.
      if (oldSeg !== newSeg) await removeFolderDirEverywhere(oldSeg)
      useSyncFolderStore.getState().setStatus('idle')
    } catch (err) {
      console.error('Sync folder rename failed:', err)
      useSyncFolderStore.getState().setStatus('error', '폴더 이름 변경을 반영하지 못했습니다.')
    }
  })
}

/**
 * A folder was deleted — its memos were already relocated (to the default folder / root)
 * in the DB, so rewrite each relocated memo to its new path (which deletes the old file)
 * then remove the emptied deleted-folder directory. `memoIds` are the affected memos
 * captured before deletion.
 */
export async function notifyFolderDeleted(oldName: string, memoIds: number[]): Promise<void> {
  if (!useSyncFolderStore.getState().enabled) return
  if (!(await ensureReady()) || !target) return
  const oldSeg = sanitizeSegment(oldName)
  await withLock(target.key, async () => {
    try {
      const done = new Set<number>()
      // Primary source of truth is the fileSyncMap, not a DB folderId snapshot: rewrite every
      // memo whose file still lives in the deleted folder's directory. This is race-proof —
      // if a remote memo relocation changed the memo's folderId before this ran (so the
      // caller's `memoIds` came back empty), the file record still points here and gets moved.
      const records = await getFileSyncRecordsUnderDir(`${oldSeg}/`)
      for (const rec of records) {
        const memo = await getMemoBySyncId(rec.memoSyncId)
        if (memo?.id != null && !done.has(memo.id)) {
          done.add(memo.id)
          await writeMemoNow(memo)
        }
      }
      // Belt-and-braces: also the ids captured at delete time (covers memos not yet on disk).
      for (const id of memoIds) {
        if (done.has(id)) continue
        const fresh = await getMemo(id)
        if (fresh) {
          done.add(id)
          await writeMemoNow(fresh)
        }
      }
      await removeFolderDirEverywhere(oldSeg)
      useSyncFolderStore.getState().setStatus('idle')
    } catch (err) {
      console.error('Sync folder delete cleanup failed:', err)
      useSyncFolderStore.getState().setStatus('error', '폴더 삭제를 반영하지 못했습니다.')
    }
  })
}

// ─── Full export (§6 전체 내보내기) ──────────────────

export interface ExportProgress {
  total: number
  done: number
}

/**
 * Write every active (non-deleted, non-ephemeral) memo to the folder once.
 * Used by the "지금 전체 내보내기" button and new-device onboarding (§6).
 */
export async function exportAllMemosToFolder(
  onProgress?: (p: ExportProgress) => void,
): Promise<{ written: number; skipped: number; failed: number }> {
  if (!(await ensureReady()) || !target) return { written: 0, skipped: 0, failed: 0 }
  const store = useSyncFolderStore.getState()
  const memos = (await getActiveMemos()).filter((m) => !m.ephemeralExpiresAt && m.syncId)
  let written = 0
  let skipped = 0
  let failed = 0

  await withLock(target.key, async () => {
    store.setStatus('writing')
    for (let i = 0; i < memos.length; i++) {
      // writeMemoNow swallows its own errors and reports the real outcome, so we count
      // actual writes instead of blindly reporting every memo as "written".
      const outcome = await writeMemoNow(memos[i])
      if (outcome === 'written') written++
      else if (outcome === 'skipped') skipped++
      else failed++
      onProgress?.({ total: memos.length, done: i + 1 })
    }
    // Leave the error status visible if any write failed (e.g. folder unplugged).
    store.setStatus(failed > 0 ? 'error' : 'idle', failed > 0 ? `${failed}건 저장 실패` : undefined)
    store.setFileCount(await countFileSyncRecords())
  })

  return { written, skipped, failed }
}

// ─── Reverse sync: file watching → import (Phase 2 M2, §4.4) ──────

let unsubFileEvent: (() => void) | null = null
let watching = false
let watchedRoot: string | null = null

function startWatching(root: string): void {
  const bridge = typeof window !== 'undefined' ? window.electronBridge : undefined
  if (!bridge?.startWatching) return
  const action = planWatch(watching, watchedRoot, root)
  if (action === 'noop') return
  // 'restart' = folder changed ('폴더 변경'): tear down the stale watch so both the
  // renderer listener and the main-process chokidar watcher follow the new primary.
  // Otherwise the old folder stays watched while writes/REF_KEY move on, which makes
  // the mirror overlap guard (§4.6) reason about the wrong root and can trip the §4.5
  // circuit breaker when a former primary is later added as a mirror.
  if (action === 'restart') stopWatching()
  bridge.startWatching(root)
  unsubFileEvent = bridge.onFileEvent((payload) => { void handleFileEvent(payload) })
  watching = true
  watchedRoot = root
}

function stopWatching(): void {
  const bridge = typeof window !== 'undefined' ? window.electronBridge : undefined
  if (unsubFileEvent) { unsubFileEvent(); unsubFileEvent = null }
  bridge?.stopWatching?.()
  watching = false
  watchedRoot = null
}

// ─── Circuit breaker (§4.5): pause auto-import on a flood of events ──
// (e.g. a NAS restore/re-mount that rewrites every file at once).
const CB_WINDOW_MS = 3000
const CB_THRESHOLD = 50
let cbEvents: number[] = []
let cbTripped = false

function resetCircuitBreaker(): void {
  cbEvents = []
  cbTripped = false
}

function circuitBreakerTripped(): boolean {
  if (cbTripped) return true
  const now = Date.now()
  cbEvents.push(now)
  cbEvents = cbEvents.filter((t) => now - t < CB_WINDOW_MS)
  if (cbEvents.length > CB_THRESHOLD) {
    cbTripped = true
    useSyncFolderStore.getState().setStatus(
      'error',
      '외부 변경이 한꺼번에 많이 감지되어 자동 가져오기를 멈췄습니다. 폴더를 다시 연결하면 재개됩니다.',
    )
    stopWatching()
    return true
  }
  return false
}

async function refreshMemoStore(): Promise<void> {
  try {
    // Dynamic import breaks the memoStore → syncFolder → memoStore cycle.
    const { useMemoStore } = await import('@/stores/memoStore')
    await useMemoStore.getState().refreshFromDb()
  } catch {
    /* store not ready */
  }
}

/**
 * Map a file's directory segment back to a folderId (best-effort by name). When two
 * folders sanitize to the same directory name (e.g. '일정: 회사' and '일정 회사'),
 * prefer the memo's current folder so an external body edit doesn't silently move it
 * into the wrong same-named folder (§4.4 folder collision).
 */
async function resolveFolderIdFromPath(relPath: string, preferId?: number | null): Promise<number | null> {
  const segs = relPath.split('/')
  if (segs.length < 2) return null // root
  const dir = segs[0]
  const folders = await getAllFolders()
  const matches = folders.filter((f) => !f.isSystem && sanitizeSegment(f.name) === dir)
  if (matches.length === 0) return null
  if (matches.length > 1 && preferId != null) {
    const preferred = matches.find((f) => f.id === preferId)
    if (preferred) return preferred.id ?? null
  }
  return matches[0].id ?? null
}

async function handleFileEvent(event: FileEvent): Promise<void> {
  if (!target) return
  // Drop the watcher's echo of a file this tab just deleted itself (rename/format
  // change) — otherwise it would be misread as a user deletion and trash the memo.
  if (event.type === 'unlink' && isRecentSelfDelete(event.relPath)) return
  if (circuitBreakerTripped()) return
  try {
    // Gather context + decide + apply all under the same lock, so a rename's write and
    // the racing unlink event can't interleave and act on a stale fileSyncMap snapshot.
    await withLock(target.key, async () => {
      const ctx = await gatherContext(event)
      const decision = decideImport(event, ctx)
      if (decision.action === 'skip') return
      await applyDecision(decision, event)
    })
  } catch (err) {
    console.error('Sync folder import failed:', err)
  }
}

async function gatherContext(event: FileEvent) {
  const record = await getFileSyncRecordByPath(event.relPath)
  const recordRef = record ? { memoSyncId: record.memoSyncId, contentHash: record.contentHash } : null
  if (event.type === 'unlink') return { record: recordRef }

  const content = event.content ?? ''
  const baseName = event.relPath.split('/').pop()!.replace(/\.md$/i, '')
  const parsed = deserializeMemo(content, baseName)
  const recordMemo = record ? await getMemoBySyncId(record.memoSyncId) : null
  const frontmatterMemo = parsed.syncId ? await getMemoBySyncId(parsed.syncId) : null
  return {
    fileHash: contentHash(content),
    record: recordRef,
    recordMemo: recordMemo ? { updatedAt: recordMemo.updatedAt } : null,
    frontmatterMemoExists: !!frontmatterMemo,
    frontmatterMemo: frontmatterMemo ? { updatedAt: frontmatterMemo.updatedAt } : null,
    parsed,
  }
}

async function applyDecision(
  decision: ReturnType<typeof decideImport>,
  event: FileEvent,
): Promise<void> {
  const store = useSyncFolderStore.getState()

  if (decision.action === 'delete') {
    const memo = await getMemoBySyncId(decision.memoSyncId)
    if (memo?.id != null && !memo.deletedAt) {
      await softDeleteMemo(memo.id)
      const updated = await getMemo(memo.id)
      if (updated) pushMemo(updated).catch(console.error)
    }
    await deleteFileSyncRecord(decision.memoSyncId)
    store.setFileCount(await countFileSyncRecords())
    await refreshMemoStore()
    return
  }

  if (decision.action === 'skip') return

  const parsed = decision.parsed

  if (decision.action === 'update') {
    const memo = await getMemoBySyncId(decision.memoSyncId)
    const folderId = await resolveFolderIdFromPath(event.relPath, memo?.folderId ?? null)
    if (memo?.id == null) {
      await createFromParsed(parsed, folderId, event, !parsed.hasFrontmatter)
      return
    }
    // Keep the app title unless the file was genuinely RENAMED. The title isn't stored
    // in the file, so parsed.title is the lossy filename (colons/slashes/? stripped,
    // truncated). For a body-only external edit the filename still equals the app title's
    // sanitized form — adopting parsed.title there would corrupt the real title.
    const canonicalBase = sanitizeSegment(memo.title, '제목-없음')
    const renamed = !!parsed.title && parsed.title !== canonicalBase
    const nextTitle = renamed ? parsed.title! : memo.title

    await dbUpdateMemo(memo.id, {
      title: nextTitle,
      body: parsed.body,
      tags: parsed.tags.length ? parsed.tags : extractTags(parsed.body),
      color: parsed.color ?? memo.color,
      isPinned: parsed.isPinned,
      isStarred: parsed.isStarred,
      folderId,
      deletedAt: undefined, // an external re-add revives a trashed memo
    })
    const updated = await getMemo(memo.id)
    if (updated) pushMemo(updated).catch(console.error)
    // Record the imported bytes so the echoing write-event is suppressed (§4.6).
    // Preserve any sibling files (e.g. the .html twin) so a later delete removes both
    // instead of orphaning the twin on disk.
    const existingRec = await getFileSyncRecord(decision.memoSyncId)
    const files = existingRec?.files
      ? existingRec.files.map((p) => (p === existingRec.filePath ? event.relPath : p))
      : undefined
    await putFileSyncRecord({
      memoSyncId: decision.memoSyncId,
      filePath: event.relPath,
      contentHash: contentHash(event.content ?? ''),
      files,
      lastWrittenAt: nowISO(),
    })
    await refreshMemoStore()
    return
  }

  const folderId = await resolveFolderIdFromPath(event.relPath)
  await createFromParsed(parsed, folderId, event, decision.writeBack)
}

async function createFromParsed(
  parsed: ReturnType<typeof deserializeMemo>,
  folderId: number | null,
  event: FileEvent,
  writeBack: boolean,
): Promise<void> {
  const syncId = parsed.syncId || generateSyncId()
  const now = nowISO()
  const id = await addMemo({
    title: parsed.title ?? '',
    body: parsed.body,
    folderId,
    tags: parsed.tags.length ? parsed.tags : extractTags(parsed.body),
    isStarred: parsed.isStarred,
    color: parsed.color ?? 'white',
    isPinned: parsed.isPinned,
    syncId,
    createdAt: parsed.createdAt || now,
    updatedAt: parsed.updatedAt || now,
  })
  const created = await getMemo(id)
  if (created) pushMemo(created).catch(console.error)

  let fileHash = contentHash(event.content ?? '')
  if (writeBack && created && target) {
    // Write our front-matter back INTO the user's file (same filename) so it's tracked.
    const folderName = await resolveFolderName(created)
    const { content } = await serializeMemo(created, folderName, resolveImage)
    await target.writeText(event.relPath, content)
    fileHash = contentHash(content)
  }
  await putFileSyncRecord({ memoSyncId: syncId, filePath: event.relPath, contentHash: fileHash, lastWrittenAt: nowISO() })
  useSyncFolderStore.getState().setFileCount(await countFileSyncRecords())
  await refreshMemoStore()
}

// ─── HTML format + import (Phase 4 M2) ───────────────

/** Change the save format (md/html/both) and re-export all memos so files migrate. */
export async function setSyncFolderFormat(format: SyncFolderFormat): Promise<void> {
  const store = useSyncFolderStore.getState()
  if (store.format === format) return
  store.setFormat(format)
  if (store.enabled) await exportAllMemosToFolder()
}

function deriveTitleFromHtml(html: string): string | undefined {
  const raw = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1]
  return raw ? raw.replace(/<[^>]+>/g, '').trim() || undefined : undefined
}

/**
 * Import external `.html` files as new memos (§Phase 4 M2 · HTML 가져오기).
 * Untrusted HTML is sanitized with DOMPurify then converted to markdown through the
 * shared sanitized pipeline (double defense, §8). Title from <title>/<h1> or filename.
 */
export async function importHtmlFiles(files: File[]): Promise<{ imported: number; failed: number }> {
  let imported = 0
  let failed = 0
  for (const file of files) {
    try {
      const raw = await file.text()
      const markdown = htmlToMarkdown(DOMPurify.sanitize(raw))
      const now = nowISO()
      const title = deriveTitleFromHtml(raw) || file.name.replace(/\.html?$/i, '')
      const id = await addMemo({
        title,
        body: markdown,
        folderId: null,
        tags: extractTags(markdown),
        isStarred: false,
        color: 'white',
        isPinned: false,
        syncId: generateSyncId(),
        createdAt: now,
        updatedAt: now,
      })
      const created = await getMemo(id)
      if (created) {
        pushMemo(created).catch(console.error)
        notifyMemoSaved(created) // write to the sync folder too, if enabled
      }
      imported++
    } catch (err) {
      console.error('HTML import failed:', err)
      failed++
    }
  }
  if (imported) await refreshMemoStore()
  return { imported, failed }
}

// ─── NAS mirroring + retry queue (Phase 2 M3, §4.6) ──────

// Mirrors are copy-only targets (local primary is the source of truth and the only
// watched folder). A write is fanned out to every mirror; failures (NAS offline) are
// queued in pendingFileOps and retried with exponential backoff.
let mirrorTargets: FileSyncTarget[] = []
let flushTimer: ReturnType<typeof setInterval> | null = null
let onlineHandler: (() => void) | null = null

function rebuildMirrors(): void {
  const mirrors = useSyncFolderStore.getState().mirrors
  mirrorTargets = mirrors
    .map((m) => buildIpcTarget(m.path))
    .filter((t): t is FileSyncTarget => t != null)
}

async function refreshPendingCount(): Promise<void> {
  useSyncFolderStore.getState().setPendingOps(await countPendingFileOps())
}

async function enqueueMirror(
  targetKey: string,
  op: PendingFileOp['op'],
  filePath: string,
  payload?: string,
): Promise<void> {
  const at = nowISO()
  await enqueuePendingFileOp({ op, targetKey, filePath, payload, attempts: 0, nextRetryAt: at, createdAt: at })
}

/** Copy a memo write to every mirror; queue any that fail. `oldPath` (rename) is removed first. */
async function mirrorWrite(
  filePath: string,
  content: string,
  assets: AssetRef[],
  oldPath: string | null,
): Promise<void> {
  if (!mirrorTargets.length) return
  for (const m of mirrorTargets) {
    try {
      if (oldPath) await m.deleteFile(oldPath)
      await m.writeText(filePath, content)
      for (const a of assets) {
        if (!(await m.exists(a.path))) await m.writeBinary(a.path, dataUrlToBlob(a.dataUrl))
      }
    } catch {
      if (oldPath) await enqueueMirror(m.key, 'delete', oldPath)
      await enqueueMirror(m.key, 'writeText', filePath, content)
      for (const a of assets) await enqueueMirror(m.key, 'writeBinary', a.path, a.dataUrl)
    }
  }
  await refreshPendingCount()
}

async function mirrorDelete(filePath: string): Promise<void> {
  if (!mirrorTargets.length) return
  for (const m of mirrorTargets) {
    try {
      await m.deleteFile(filePath)
    } catch {
      await enqueueMirror(m.key, 'delete', filePath)
    }
  }
  await refreshPendingCount()
}

/** Retry due queued mirror ops with exponential backoff; drop after max attempts (§4.6). */
export async function flushPendingFileOps(): Promise<void> {
  const due = await getDuePendingFileOps(nowISO())
  if (!due.length) return
  for (const op of due) {
    const mirror = mirrorTargets.find((t) => t.key === op.targetKey)
    if (!mirror) {
      // Mirror no longer configured → drop the op.
      if (op.id != null) await deletePendingFileOp(op.id)
      continue
    }
    try {
      if (op.op === 'writeText') await mirror.writeText(op.filePath, op.payload ?? '')
      else if (op.op === 'writeBinary') await mirror.writeBinary(op.filePath, dataUrlToBlob(op.payload ?? ''))
      else await mirror.deleteFile(op.filePath)
      if (op.id != null) await deletePendingFileOp(op.id)
    } catch {
      const plan = planRetry(op.attempts, Date.now())
      if (op.id != null) {
        if (plan.giveUp) await deletePendingFileOp(op.id)
        else await updatePendingFileOp(op.id, { attempts: plan.attempts, nextRetryAt: plan.nextRetryAt })
      }
    }
  }
  await refreshPendingCount()
}

function startMirrorFlush(): void {
  if (flushTimer) return
  flushTimer = setInterval(() => { void flushPendingFileOps() }, 30_000)
  onlineHandler = () => { void flushPendingFileOps() }
  if (typeof window !== 'undefined') window.addEventListener('online', onlineHandler)
  void flushPendingFileOps()
}

function stopMirrorFlush(): void {
  if (flushTimer) { clearInterval(flushTimer); flushTimer = null }
  if (onlineHandler && typeof window !== 'undefined') {
    window.removeEventListener('online', onlineHandler)
    onlineHandler = null
  }
}

/** Copy every current memo file into a freshly-added mirror (initial fill). */
async function fillMirror(mirror: FileSyncTarget): Promise<void> {
  const memos = (await getActiveMemos()).filter((m) => !m.ephemeralExpiresAt && m.syncId)
  for (const memo of memos) {
    const folderName = await resolveFolderName(memo)
    const { filePath, content, assets } = await serializeMemo(memo, folderName, resolveImage)
    try {
      await mirror.writeText(filePath, content)
      for (const a of assets) {
        if (!(await mirror.exists(a.path))) await mirror.writeBinary(a.path, dataUrlToBlob(a.dataUrl))
      }
    } catch {
      await enqueueMirror(mirror.key, 'writeText', filePath, content)
      for (const a of assets) await enqueueMirror(mirror.key, 'writeBinary', a.path, a.dataUrl)
    }
  }
  await refreshPendingCount()
}

/** Outcome of addMirrorFolder — the settings UI maps these to toasts. */
export type AddMirrorResult = 'added' | 'cancelled' | 'duplicate' | 'overlaps-primary'

/** Add a mirror folder (Electron only, user gesture) and fill it with current memos. */
export async function addMirrorFolder(): Promise<AddMirrorResult> {
  const picked = await pickMirror()
  if (!picked) return 'cancelled'
  const store = useSyncFolderStore.getState()
  if (store.mirrors.some((m) => pathsOverlap(m.path, picked.path))) return 'duplicate'
  // 겹침 가드(§4.6): 주 폴더와 같으면 이중 쓰기 + 감시 이벤트 2배(§4.5 서킷 브레이커 오발동),
  // 주 폴더 안쪽이면 미러 사본이 감시 범위에 들어와 새 메모로 재가져오기됨 → 거부.
  const primaryRoot = watchRootFromRef(await getSyncFolderValue<unknown>(REF_KEY))
  if (primaryRoot && pathsOverlap(primaryRoot, picked.path)) return 'overlaps-primary'
  store.setMirrors([...store.mirrors, picked])
  rebuildMirrors()
  const t = buildIpcTarget(picked.path)
  if (t) await withLock(t.key, () => fillMirror(t))
  return 'added'
}

/** Remove a mirror folder and drop its queued ops. Existing files on the mirror are kept. */
export async function removeMirrorFolder(path: string): Promise<void> {
  const store = useSyncFolderStore.getState()
  store.setMirrors(store.mirrors.filter((m) => m.path !== path))
  rebuildMirrors()
  await deletePendingFileOpsByTarget(`ipc:${path}`)
  await refreshPendingCount()
}
