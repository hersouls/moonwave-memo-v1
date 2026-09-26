import { db } from './database'
import { nowISO } from '@/lib/dateUtils'
import {
  pushMemo,
  pushFolder,
  deleteMemoFromCloud,
  deleteFolderFromCloud,
  currentWriteContext,
  isWriteContextLive,
  isSyncReady,
  type SyncWriteContext,
} from './firestoreSync'
import * as database from './database'
import { getLocalOwnerUid } from './localOwner'
import { connectivity } from './connectivity'
import * as syncStatus from './syncStatus'

// Queue replay runs in ONE tab at a time: every open tab gets the 'online' event and the
// service worker's SYNC_PENDING_MEMOS message, and they all share this IndexedDB queue.
const QUEUE_LOCK = 'memo-sync-queue'
const REPLAY_PUSH_TIMEOUT_MS = 15_000
const REPLAY_RETRY_BASE_MS = 5_000
const REPLAY_RETRY_MAX_MS = 5 * 60_000
const MAX_DRAIN_PASSES = 5

let localDrain: Promise<void> | null = null
let replayTimer: ReturnType<typeof setTimeout> | null = null
let replayAttempt = 0

/**
 * Queue a cloud intent. `ownerUid` is the account the intent was made for; it is dropped
 * if the local data no longer belongs to that account (never re-homed into another one).
 * Omit it only when no session exists — the intent then belongs to the local-data owner.
 */
export async function enqueueSync(
  type: 'memo' | 'folder',
  action: 'upsert' | 'delete',
  syncId: string,
  ownerUid?: string,
): Promise<void> {
  const queued = await db.transaction('rw', db.pendingSyncs, db.syncMeta, async () => {
    if (ownerUid !== undefined && (await getLocalOwnerUid()) !== ownerUid) return false
    const existing = await db.pendingSyncs.where('syncId').equals(syncId).first()
    if (existing) {
      await db.pendingSyncs.update(existing.id!, { action, createdAt: nowISO() })
    } else {
      await db.pendingSyncs.add({ type, action, syncId, createdAt: nowISO() })
    }
    return true
  })
  if (!queued) return
  syncStatus.noteQueueChanged()
  if (isSyncReady()) scheduleQueueReplay()

  // Request background sync if available. Packaged shells (Electron/Capacitor)
  // never register a SW, and `ready` never resolves without one (§4.8) — so only
  // proceed when a registration actually exists.
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    try {
      if (!(await navigator.serviceWorker.getRegistration())) return
      const reg = await navigator.serviceWorker.ready
      await (reg as unknown as { sync: { register: (tag: string) => Promise<void> } }).sync.register('sync-memos')
    } catch { /* not supported */ }
  }
}

/**
 * Remove queued intents for a syncId after a confirmed push. Only rows queued no later
 * than `notAfter` (when that push started) are removed, so an intent queued while the push
 * was in flight — possibly a newer one — survives.
 */
export async function dequeueSync(syncId: string, notAfter?: string): Promise<void> {
  const rows = db.pendingSyncs.where('syncId').equals(syncId)
  const removed = notAfter
    ? await rows.filter((row) => row.createdAt <= notAfter).delete()
    : await rows.delete()
  if (removed > 0) syncStatus.noteQueueChanged()
}

/** Runs fn under the cross-tab queue lock; resolves undefined when another drain holds it. */
async function withQueueLock<T>(fn: () => Promise<T>): Promise<T | undefined> {
  const locks = typeof navigator !== 'undefined'
    ? (navigator as Navigator & { locks?: LockManager }).locks
    : undefined
  if (locks?.request) {
    // ifAvailable: when another tab (or this one) is already draining, skip — the holder
    // re-reads the queue until it is empty, and a retry is scheduled below either way.
    return locks.request(QUEUE_LOCK, { ifAvailable: true }, async (lock) => (lock ? fn() : undefined))
  }
  // No Web Locks (old WebView): at least never run two drains in this tab.
  if (localDrain) return undefined
  const run = fn()
  localDrain = run.then(() => {}, () => {}).finally(() => { localDrain = null })
  return run
}

async function replayItem(
  item: { type: string; action: string; syncId: string },
  ctx: SyncWriteContext,
): Promise<boolean> {
  // The push/delete helpers report success as a boolean and never throw.
  if (item.type === 'memo') {
    if (item.action === 'delete') return deleteMemoFromCloud(item.syncId, ctx)
    const memo = await database.getMemoBySyncId(item.syncId)
    // The memo no longer exists locally (deleted since queueing) → drop the intent.
    return memo ? pushMemo(memo, ctx) : true
  }
  if (item.action === 'delete') return deleteFolderFromCloud(item.syncId, ctx)
  const folder = await database.getFolderBySyncId(item.syncId)
  return folder ? pushFolder(folder, ctx) : true
}

/**
 * Returns true when the queue is stuck: a full pass delivered nothing while online and at
 * least one write was rejected (a slow/unreachable backend that merely times out is not
 * reported as an error — the status stays 'syncing').
 */
async function drainQueue(ctx: SyncWriteContext): Promise<boolean> {
  // Loop so intents queued while we drain are picked up by this lock holder, but stop
  // once a pass makes no progress (everything left is failing) instead of spinning.
  for (let pass = 0; pass < MAX_DRAIN_PASSES; pass++) {
    const pending = await db.pendingSyncs.toArray()
    if (pending.length === 0) return false
    let progressed = false
    let rejected = false
    for (const item of pending) {
      if (!isWriteContextLive(ctx) || !connectivity.isOnline()) return false
      let ok = false
      try {
        ok = await withTimeout(replayItem(item, ctx), REPLAY_PUSH_TIMEOUT_MS)
        if (!ok) rejected = true
      } catch { /* timed out — the write stays persisted in Firestore; retry later */ }
      if (ok && item.id != null) {
        // Only drop the row if it wasn't re-queued (newer intent) while we pushed.
        await db.pendingSyncs
          .where('id').equals(item.id)
          .filter((row) => row.createdAt === item.createdAt && row.action === item.action)
          .delete()
        progressed = true
      }
    }
    if (!progressed) return rejected && isWriteContextLive(ctx) && connectivity.isOnline()
  }
  return false
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Queue replay timed out')), ms)
    }),
  ]).finally(() => clearTimeout(timer))
}

export async function processPendingSyncs(): Promise<void> {
  // Replaying while signed out would push nothing yet delete the queue row — the
  // 'online' event can fire before Firebase restores auth, so gate on readiness. The
  // context is captured once: every write of this replay goes to that account only.
  const ctx = currentWriteContext()
  if (!ctx) return
  // Offline, every push would just hang; the reconnect triggers a replay.
  if (!connectivity.isOnline()) return

  let stalled: boolean | undefined
  try {
    stalled = await withQueueLock(() => drainQueue(ctx))
  } catch (err) {
    console.error('Offline queue replay failed:', err)
  }

  const remaining = await db.pendingSyncs.count().catch(() => 0)
  if (remaining === 0) {
    replayAttempt = 0
    syncStatus.noteQueueChanged(false)
    return
  }
  // A full pass that delivered nothing while online means the writes are being rejected
  // (not merely offline) — surface it as a sync error until a later replay succeeds.
  if (stalled !== undefined) syncStatus.noteQueueChanged(stalled)
  if (isWriteContextLive(ctx)) scheduleQueueReplay()
}

/** Retry the queue later with capped exponential backoff (one timer per tab). */
export function scheduleQueueReplay(): void {
  if (replayTimer) return
  const delay = Math.min(REPLAY_RETRY_BASE_MS * 2 ** replayAttempt, REPLAY_RETRY_MAX_MS)
  replayAttempt++
  replayTimer = setTimeout(() => {
    replayTimer = null
    void processPendingSyncs()
  }, delay)
}

export function cancelQueueReplay(): void {
  if (replayTimer) {
    clearTimeout(replayTimer)
    replayTimer = null
  }
  replayAttempt = 0
}
