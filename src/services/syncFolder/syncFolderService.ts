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
import { useSyncFolderStore } from '@/stores/syncFolderStore'
import { serializeMemo, deserializeMemo, type ImageResolver, type AssetRef } from './serializer'
import { contentHash } from './hash'
import { sanitizeSegment } from './filename'
import { decideImport, type FileEvent } from './importer'
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

/** Prompt the user to pick a folder (user gesture). Persists the ref and enables. */
export async function pickSyncFolder(): Promise<boolean> {
  if (!isSyncFolderSupported()) return false
  const store = useSyncFolderStore.getState()
  try {
    const picked = await pickFolder()
    if (!picked) {
      // null = cancelled or permission denied; only flag the latter if already on.
      if (store.enabled) store.setStatus('needs-permission')
      return false
    }
    await setSyncFolderValue(REF_KEY, picked.ref)
    store.setEnabled(true)
    setActiveTarget(picked.target, picked.displayName, watchRootFromRef(picked.ref))
    return true
  } catch (err) {
    // AbortError = user cancelled the picker; not an error worth surfacing.
    if ((err as DOMException)?.name === 'AbortError') return false
    console.error('Sync folder pick failed:', err)
    store.setStatus('error', '폴더를 선택하지 못했습니다.')
    return false
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

async function writeMemoNow(memo: Memo): Promise<void> {
  if (!target || !memo.syncId) return
  const store = useSyncFolderStore.getState()

  // Deleted → remove the file instead of writing (§4.3).
  if (memo.deletedAt) {
    await deleteMemoFileNow(memo)
    return
  }
  // Ephemeral (1h brain-dump) memos are excluded from folder writes (§4.3).
  if (memo.ephemeralExpiresAt) return

  try {
    const folderName = await resolveFolderName(memo)
    const { filePath, content, assets } = await serializeMemo(memo, folderName, resolveImage)
    const hash = contentHash(content)

    const existing = await getFileSyncRecord(memo.syncId)
    // No-op skip: identical content at the same path → don't rewrite (prevents loops, §4.5).
    if (existing && existing.contentHash === hash && existing.filePath === filePath) return

    store.setStatus('writing')
    // Rename: title/folder changed → path changed → delete the stale file first (§4.1).
    if (existing && existing.filePath !== filePath) {
      await target.deleteFile(existing.filePath)
    }

    await target.writeText(filePath, content)
    for (const asset of assets) {
      // Skip assets already on disk (images are immutable once written).
      if (!(await target.exists(asset.path))) {
        await target.writeBinary(asset.path, dataUrlToBlob(asset.dataUrl))
      }
    }

    // Mirror the write to any NAS/copy folders (§4.6); failures queue for retry.
    await mirrorWrite(filePath, content, assets, existing && existing.filePath !== filePath ? existing.filePath : null)

    const at = nowISO()
    await putFileSyncRecord({ memoSyncId: memo.syncId, filePath, contentHash: hash, lastWrittenAt: at })
    store.setLastWritten(at)
    store.setFileCount(await countFileSyncRecords())
    store.setStatus('idle')
  } catch (err) {
    console.error('Sync folder write failed:', err)
    // Phase 1 has no durable retry queue (that is Phase 2 pendingFileOps, §4.6).
    store.setStatus('error', '폴더에 저장하지 못했습니다.')
  }
}

async function deleteMemoFileNow(memo: Memo): Promise<void> {
  if (!target || !memo.syncId) return
  const store = useSyncFolderStore.getState()
  try {
    const rec = await getFileSyncRecord(memo.syncId)
    if (!rec) return
    await target.deleteFile(rec.filePath)
    await mirrorDelete(rec.filePath)
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
): Promise<{ written: number; skipped: number }> {
  if (!(await ensureReady()) || !target) return { written: 0, skipped: 0 }
  const store = useSyncFolderStore.getState()
  const memos = (await getActiveMemos()).filter((m) => !m.ephemeralExpiresAt && m.syncId)
  let written = 0
  let skipped = 0

  await withLock(target.key, async () => {
    store.setStatus('writing')
    for (let i = 0; i < memos.length; i++) {
      try {
        await writeMemoNow(memos[i])
        written++
      } catch {
        skipped++
      }
      onProgress?.({ total: memos.length, done: i + 1 })
    }
    store.setStatus('idle')
    store.setFileCount(await countFileSyncRecords())
  })

  return { written, skipped }
}

// ─── Reverse sync: file watching → import (Phase 2 M2, §4.4) ──────

let unsubFileEvent: (() => void) | null = null
let watching = false

function startWatching(root: string): void {
  const bridge = typeof window !== 'undefined' ? window.electronBridge : undefined
  if (!bridge?.startWatching || watching) return
  bridge.startWatching(root)
  unsubFileEvent = bridge.onFileEvent((payload) => { void handleFileEvent(payload) })
  watching = true
}

function stopWatching(): void {
  const bridge = typeof window !== 'undefined' ? window.electronBridge : undefined
  if (unsubFileEvent) { unsubFileEvent(); unsubFileEvent = null }
  bridge?.stopWatching?.()
  watching = false
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

/** Map a file's directory segment back to a folderId (best-effort by name). */
async function resolveFolderIdFromPath(relPath: string): Promise<number | null> {
  const segs = relPath.split('/')
  if (segs.length < 2) return null // root
  const dir = segs[0]
  const folders = await getAllFolders()
  const match = folders.find((f) => !f.isSystem && sanitizeSegment(f.name) === dir)
  return match?.id ?? null
}

async function handleFileEvent(event: FileEvent): Promise<void> {
  if (!target) return
  if (circuitBreakerTripped()) return
  try {
    const ctx = await gatherContext(event)
    const decision = decideImport(event, ctx)
    if (decision.action === 'skip') return
    await withLock(target.key, () => applyDecision(decision, event))
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
  const frontmatterMemoExists = parsed.syncId ? !!(await getMemoBySyncId(parsed.syncId)) : false
  return {
    fileHash: contentHash(content),
    record: recordRef,
    recordMemo: recordMemo ? { updatedAt: recordMemo.updatedAt } : null,
    frontmatterMemoExists,
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
  const folderId = await resolveFolderIdFromPath(event.relPath)

  if (decision.action === 'update') {
    const memo = await getMemoBySyncId(decision.memoSyncId)
    if (memo?.id == null) {
      await createFromParsed(parsed, folderId, event, !parsed.hasFrontmatter)
      return
    }
    await dbUpdateMemo(memo.id, {
      title: parsed.title ?? memo.title,
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
    await putFileSyncRecord({
      memoSyncId: decision.memoSyncId,
      filePath: event.relPath,
      contentHash: contentHash(event.content ?? ''),
      lastWrittenAt: nowISO(),
    })
    await refreshMemoStore()
    return
  }

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

/** Add a mirror folder (Electron only, user gesture) and fill it with current memos. */
export async function addMirrorFolder(): Promise<boolean> {
  const picked = await pickMirror()
  if (!picked) return false
  const store = useSyncFolderStore.getState()
  if (store.mirrors.some((m) => m.path === picked.path)) return false
  store.setMirrors([...store.mirrors, picked])
  rebuildMirrors()
  const t = buildIpcTarget(picked.path)
  if (t) await withLock(t.key, () => fillMirror(t))
  return true
}

/** Remove a mirror folder and drop its queued ops. Existing files on the mirror are kept. */
export async function removeMirrorFolder(path: string): Promise<void> {
  const store = useSyncFolderStore.getState()
  store.setMirrors(store.mirrors.filter((m) => m.path !== path))
  rebuildMirrors()
  await deletePendingFileOpsByTarget(`ipc:${path}`)
  await refreshPendingCount()
}
