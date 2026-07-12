import { db } from './database'
import { nowISO } from '@/lib/dateUtils'
import { pushMemo, pushFolder, isSyncReady } from './firestoreSync'
import * as database from './database'

export async function enqueueSync(
  type: 'memo' | 'folder',
  action: 'upsert' | 'delete',
  syncId: string,
): Promise<void> {
  const existing = await db.pendingSyncs
    .where('syncId')
    .equals(syncId)
    .first()

  if (existing) {
    await db.pendingSyncs.update(existing.id!, { action, createdAt: nowISO() })
  } else {
    await db.pendingSyncs.add({ type, action, syncId, createdAt: nowISO() })
  }

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

/** Remove any queued intents for a syncId (called after a confirmed push). */
export async function dequeueSync(syncId: string): Promise<void> {
  await db.pendingSyncs.where('syncId').equals(syncId).delete()
}

export async function processPendingSyncs(): Promise<void> {
  // Replaying while signed out would push nothing yet delete the queue row — the
  // 'online' event can fire before Firebase restores auth, so gate on readiness.
  if (!isSyncReady()) return

  const pending = await db.pendingSyncs.toArray()
  if (pending.length === 0) return

  for (const item of pending) {
    // The push/delete helpers report success as a boolean and never throw; only drop
    // the queue row when the change was actually accepted, otherwise leave it to retry.
    let ok = false
    if (item.type === 'memo') {
      if (item.action === 'delete') {
        const { deleteMemoFromCloud } = await import('./firestoreSync')
        ok = await deleteMemoFromCloud(item.syncId)
      } else {
        const memo = await database.getMemoBySyncId(item.syncId)
        // The memo no longer exists locally (deleted since queueing) → drop the intent.
        ok = memo ? await pushMemo(memo) : true
      }
    } else {
      if (item.action === 'delete') {
        const { deleteFolderFromCloud } = await import('./firestoreSync')
        ok = await deleteFolderFromCloud(item.syncId)
      } else {
        const folder = await database.getFolderBySyncId(item.syncId)
        ok = folder ? await pushFolder(folder) : true
      }
    }

    if (ok && item.id != null) await db.pendingSyncs.delete(item.id)
  }
}
