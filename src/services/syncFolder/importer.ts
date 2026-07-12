/**
 * Reverse sync — external file edits → memos (Phase 2, Milestone 2 · §4.4 가져오기 계약).
 *
 * This module holds only the PURE decision logic: given a file-watcher event plus the
 * relevant app state (the fileSyncMap record for that path, the memo it maps to, and the
 * parsed file), decide what to do. All I/O and application live in syncFolderService, so
 * this stays deterministic and unit-testable.
 *
 * Rules encoded here:
 *   - §4.6 self-write suppression: a change whose contentHash equals the recorded hash is
 *     our own write echoing back → skip (prevents write→watch→import loops).
 *   - §4.5 conflict: for a tracked file, the file wins only if its front-matter updatedAt
 *     is strictly newer than the memo's; otherwise the app state is kept.
 *   - §4.4 identity: match by fileSyncMap path first, then front-matter syncId; a file with
 *     neither is a brand-new memo (and its front-matter must be written back).
 *   - §4.3 reverse: an unlinked tracked file soft-deletes its memo.
 */
import type { DeserializedMemo } from './serializer'

export type FileEventType = 'add' | 'change' | 'unlink'

export interface FileEvent {
  type: FileEventType
  /** Path relative to the sync-folder root, `/`-separated. */
  relPath: string
  /** File text for add/change; absent for unlink. */
  content?: string
}

export interface ImportContext {
  /** contentHash of the file's current bytes (add/change only). */
  fileHash?: string
  /** fileSyncMap record for this path, if the app has written here before. */
  record?: { memoSyncId: string; contentHash: string } | null
  /** The memo the record maps to (for the conflict comparison). */
  recordMemo?: { updatedAt: string } | null
  /** True if a memo already exists for the file's front-matter syncId. */
  frontmatterMemoExists?: boolean
  /** The memo matched by front-matter syncId (for the untracked conflict comparison). */
  frontmatterMemo?: { updatedAt: string } | null
  /** Parsed file (add/change only). */
  parsed?: DeserializedMemo
}

export type ImportDecision =
  | { action: 'skip'; reason: string }
  | { action: 'create'; parsed: DeserializedMemo; writeBack: boolean }
  | { action: 'update'; memoSyncId: string; parsed: DeserializedMemo }
  | { action: 'delete'; memoSyncId: string }

export function decideImport(event: FileEvent, ctx: ImportContext): ImportDecision {
  if (event.type === 'unlink') {
    return ctx.record
      ? { action: 'delete', memoSyncId: ctx.record.memoSyncId }
      : { action: 'skip', reason: 'unlink-untracked' }
  }

  // add / change
  // §4.6: our own write echoing back — identical bytes at a tracked path.
  if (ctx.record && ctx.fileHash && ctx.record.contentHash === ctx.fileHash) {
    return { action: 'skip', reason: 'self-write' }
  }

  const parsed = ctx.parsed
  if (!parsed) return { action: 'skip', reason: 'no-content' }

  // Tracked path → external edit of a known memo.
  if (ctx.record) {
    const memo = ctx.recordMemo
    // §4.5: keep app state unless the file is strictly newer (front-matter updatedAt).
    if (memo && parsed.updatedAt && memo.updatedAt && parsed.updatedAt <= memo.updatedAt) {
      return { action: 'skip', reason: 'app-newer' }
    }
    return { action: 'update', memoSyncId: ctx.record.memoSyncId, parsed }
  }

  // Untracked path, but front-matter syncId maps to an existing memo (file moved/renamed).
  if (parsed.syncId && (ctx.frontmatterMemo || ctx.frontmatterMemoExists)) {
    // Apply the same strict-newer guard as tracked files: dropping an OLD copy of a
    // file (e.g. restoring a memo from a stale backup, or Ctrl+C/V of a live file) must
    // not silently roll the memo back. Equal-or-newer still updates so a genuine
    // move/rename (identical timestamps) repoints tracking.
    const memoUpdatedAt = ctx.frontmatterMemo?.updatedAt
    if (parsed.updatedAt && memoUpdatedAt && parsed.updatedAt < memoUpdatedAt) {
      return { action: 'skip', reason: 'app-newer-untracked' }
    }
    return { action: 'update', memoSyncId: parsed.syncId, parsed }
  }

  // Brand-new file. If it has no front-matter, we must write it back so it becomes tracked.
  return { action: 'create', parsed, writeBack: !parsed.hasFrontmatter }
}
