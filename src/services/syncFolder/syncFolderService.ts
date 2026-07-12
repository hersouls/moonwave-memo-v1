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
import {
  getMemo,
  getActiveMemos,
  getFolder,
  getMemoImage,
  getFileSyncRecord,
  putFileSyncRecord,
  deleteFileSyncRecord,
  countFileSyncRecords,
  clearFileSyncMap,
  getSyncFolderValue,
  setSyncFolderValue,
  deleteSyncFolderValue,
} from '@/services/database'
import { useSyncFolderStore } from '@/stores/syncFolderStore'
import { serializeMemo, type ImageResolver } from './serializer'
import { contentHash } from './hash'
import { sanitizeSegment } from './filename'
import { dataUrlToBlob, type FileSyncTarget } from './FileSyncTarget'
import { FsaFileSyncTarget } from './fsaTarget'

const HANDLE_KEY = 'dirHandle'
const FILE_WRITE_DEBOUNCE_MS = 2000

// Module-level runtime state (single instance per tab).
let target: FileSyncTarget | null = null
const writeTimers = new Map<number, ReturnType<typeof setTimeout>>()

// ─── Capability ──────────────────────────────────────

export function isSyncFolderSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function'
}

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

async function buildTargetFromHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  target = new FsaFileSyncTarget(handle)
  const store = useSyncFolderStore.getState()
  store.setFolderName(handle.name)
  store.setStatus('idle')
  store.setFileCount(await countFileSyncRecords())
}

/**
 * Restore the persisted handle and (silently) verify permission. Called on app start.
 * With Chrome 122+ persistent permissions this succeeds without a prompt for an
 * installed PWA; otherwise status becomes 'needs-permission' and the UI shows a
 * reconnect button (which can call requestPermission from a user gesture).
 */
export async function initSyncFolder(): Promise<void> {
  const store = useSyncFolderStore.getState()
  if (!store.enabled || !isSyncFolderSupported()) return
  try {
    const handle = await getSyncFolderValue<FileSystemDirectoryHandle>(HANDLE_KEY)
    if (!handle) {
      store.setStatus('needs-permission')
      return
    }
    const perm = (await handle.queryPermission?.({ mode: 'readwrite' })) ?? 'prompt'
    if (perm === 'granted') {
      await buildTargetFromHandle(handle)
    } else {
      store.setStatus('needs-permission')
    }
  } catch (err) {
    console.error('Sync folder init failed:', err)
    store.setStatus('error', '동기화 폴더를 복원하지 못했습니다.')
  }
}

/** Prompt the user to pick a folder (user gesture). Persists the handle and enables. */
export async function pickSyncFolder(): Promise<boolean> {
  if (!isSyncFolderSupported()) return false
  const store = useSyncFolderStore.getState()
  try {
    const handle = await window.showDirectoryPicker!({ id: 'moonwave-memo-sync', mode: 'readwrite' })
    const perm = (await handle.requestPermission?.({ mode: 'readwrite' })) ?? 'granted'
    if (perm !== 'granted') {
      store.setStatus('needs-permission')
      return false
    }
    await setSyncFolderValue(HANDLE_KEY, handle)
    store.setEnabled(true)
    await buildTargetFromHandle(handle)
    return true
  } catch (err) {
    // AbortError = user cancelled the picker; not an error worth surfacing.
    if ((err as DOMException)?.name === 'AbortError') return false
    console.error('Sync folder pick failed:', err)
    store.setStatus('error', '폴더를 선택하지 못했습니다.')
    return false
  }
}

/** Re-request permission for the stored handle from a user gesture (reconnect button). */
export async function reconnectSyncFolder(): Promise<boolean> {
  if (!isSyncFolderSupported()) return false
  const store = useSyncFolderStore.getState()
  try {
    const handle = await getSyncFolderValue<FileSystemDirectoryHandle>(HANDLE_KEY)
    if (!handle) {
      store.setStatus('needs-permission')
      return false
    }
    const perm = (await handle.requestPermission?.({ mode: 'readwrite' })) ?? 'granted'
    if (perm !== 'granted') {
      store.setStatus('needs-permission')
      return false
    }
    await buildTargetFromHandle(handle)
    return true
  } catch (err) {
    console.error('Sync folder reconnect failed:', err)
    store.setStatus('error', '폴더 권한을 다시 얻지 못했습니다.')
    return false
  }
}

/** Turn the feature off. Files on disk are the user's — they are NOT deleted (§10 rollback). */
export async function disableSyncFolder(): Promise<void> {
  for (const timer of writeTimers.values()) clearTimeout(timer)
  writeTimers.clear()
  target = null
  await deleteSyncFolderValue(HANDLE_KEY)
  await clearFileSyncMap()
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
