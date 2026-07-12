import { db } from './database'
import { nowISO } from '@/lib/dateUtils'
import { pushMemo, pushFolder } from './firestoreSync'
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

export async function processPendingSyncs(): Promise<void> {
  const pending = await db.pendingSyncs.toArray()
  if (pending.length === 0) return

  for (const item of pending) {
    try {
      if (item.type === 'memo') {
        if (item.action === 'delete') {
          const { deleteMemoFromCloud } = await import('./firestoreSync')
          await deleteMemoFromCloud(item.syncId)
        } else {
          const memo = await database.getMemoBySyncId(item.syncId)
          if (memo) await pushMemo(memo)
        }
      } else {
        if (item.action === 'delete') {
          const { deleteFolderFromCloud } = await import('./firestoreSync')
          await deleteFolderFromCloud(item.syncId)
        } else {
          const folder = await database.getFolderBySyncId(item.syncId)
          if (folder) await pushFolder(folder)
        }
      }
      // Clear on success
      await db.pendingSyncs.delete(item.id!)
    } catch {
      // Will retry on next sync
      console.error(`Failed to sync ${item.type} ${item.syncId}`)
    }
  }
}
