import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore'
import { firestore } from '@/lib/firebase'
import type { Memo, Folder } from '@/lib/types'
import * as database from './database'
import { generateSyncId } from '@/utils/id'
import { useToastStore } from '@/stores/toastStore'

let unsubMemos: Unsubscribe | null = null
let unsubFolders: Unsubscribe | null = null
let currentUserId: string | null = null
let refreshMemos: (() => Promise<void>) | null = null
let refreshFolders: (() => Promise<void>) | null = null

const recentlyPushed = new Set<string>()
const recentlyPushedTimers = new Map<string, ReturnType<typeof setTimeout>>()
let mergePromise: Promise<void> | null = null

function scheduleRecentlyPushedCleanup(key: string) {
  if (recentlyPushedTimers.has(key)) clearTimeout(recentlyPushedTimers.get(key)!)
  recentlyPushedTimers.set(key, setTimeout(() => {
    recentlyPushed.delete(key)
    recentlyPushedTimers.delete(key)
  }, 5000))
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Sync push timed out')), ms)
    ),
  ])
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = value
    }
  }
  return result as Partial<T>
}

export function registerRefreshCallbacks(
  memoRefresh: () => Promise<void>,
  folderRefresh: () => Promise<void>
) {
  refreshMemos = memoRefresh
  refreshFolders = folderRefresh
}

// ─── Folder syncId ↔ local ID resolution ──────────

async function resolveFolderSyncId(folderSyncId: string | null | undefined): Promise<number | null> {
  if (!folderSyncId) return null
  const folder = await database.getFolderBySyncId(folderSyncId)
  return folder?.id ?? null
}

async function getFolderSyncId(folderId: number | null): Promise<string | null> {
  if (folderId == null) return null
  const folder = await database.getFolder(folderId)
  return folder?.syncId ?? null
}

// ─── Push to Firestore ────────────────────────────

export async function pushMemo(memo: Memo) {
  if (!currentUserId || !memo.syncId) return
  try {
    recentlyPushed.add(`memo-${memo.syncId}`)
    const folderSyncId = await getFolderSyncId(memo.folderId)
    const ref = doc(firestore, `users/${currentUserId}/memos`, memo.syncId)
    await setDoc(ref, stripUndefined({
      title: memo.title,
      body: memo.body,
      folderSyncId,
      tags: memo.tags,
      isStarred: memo.isStarred,
      color: memo.color,
      isPinned: memo.isPinned,
      createdAt: memo.createdAt,
      updatedAt: memo.updatedAt,
      deletedAt: memo.deletedAt || null,
    }), { merge: true })
    scheduleRecentlyPushedCleanup(`memo-${memo.syncId}`)
  } catch (err) {
    recentlyPushed.delete(`memo-${memo.syncId}`)
    if (!navigator.onLine && memo.syncId) {
      import('./offlineQueue').then(({ enqueueSync }) => enqueueSync('memo', 'upsert', memo.syncId!))
    } else {
      console.error('Push memo failed:', err)
      useToastStore.getState().showToast('메모 동기화에 실패했습니다', 'warning')
    }
  }
}

export async function pushFolder(folder: Folder) {
  if (!currentUserId || !folder.syncId) return
  try {
    recentlyPushed.add(`folder-${folder.syncId}`)
    const ref = doc(firestore, `users/${currentUserId}/folders`, folder.syncId)
    await setDoc(ref, stripUndefined({
      name: folder.name,
      color: folder.color,
      sortOrder: folder.sortOrder,
      isDefault: folder.isDefault,
      isSystem: folder.isSystem,
      createdAt: folder.createdAt,
      updatedAt: folder.updatedAt,
    }), { merge: true })
    scheduleRecentlyPushedCleanup(`folder-${folder.syncId}`)
  } catch (err) {
    console.error('Push folder failed:', err)
    recentlyPushed.delete(`folder-${folder.syncId}`)
  }
}

// ─── Delete from Firestore ────────────────────────

export async function deleteMemoFromCloud(syncId: string) {
  if (!currentUserId || !syncId) return
  try {
    recentlyPushed.add(`memo-${syncId}`)
    await deleteDoc(doc(firestore, `users/${currentUserId}/memos`, syncId))
    scheduleRecentlyPushedCleanup(`memo-${syncId}`)
  } catch (err) {
    console.error('Delete memo from cloud failed:', err)
    recentlyPushed.delete(`memo-${syncId}`)
  }
}

export async function deleteFolderFromCloud(syncId: string) {
  if (!currentUserId || !syncId) return
  try {
    recentlyPushed.add(`folder-${syncId}`)
    await deleteDoc(doc(firestore, `users/${currentUserId}/folders`, syncId))
    scheduleRecentlyPushedCleanup(`folder-${syncId}`)
  } catch (err) {
    console.error('Delete folder from cloud failed:', err)
    recentlyPushed.delete(`folder-${syncId}`)
  }
}

// ─── Initial Merge ─────────────────────────────────

async function initialMerge(userId: string) {
  if (mergePromise) return mergePromise
  mergePromise = doInitialMerge(userId)
  return mergePromise
}

async function doInitialMerge(userId: string) {

  try {
    // Patch local folders missing updatedAt (legacy fix)
    const allLocalFolders = await database.getAllFolders()
    for (const f of allLocalFolders) {
      if (!f.updatedAt) {
        await database.updateFolder(f.id!, {})
      }
    }

    // Merge folders first (memos reference folders)
    const folderSnap = await getDocs(collection(firestore, `users/${userId}/folders`))
    for (const docSnap of folderSnap.docs) {
      const remote = docSnap.data()
      const syncId = docSnap.id
      const local = await database.getFolderBySyncId(syncId)

      if (!local) {
        await database.addFolder({
          name: remote.name,
          color: remote.color,
          sortOrder: remote.sortOrder ?? 0,
          isDefault: remote.isDefault ?? false,
          isSystem: remote.isSystem ?? false,
          syncId,
          createdAt: remote.createdAt || new Date().toISOString(),
          updatedAt: remote.updatedAt || new Date().toISOString(),
        })
      } else if (remote.updatedAt && (!local.updatedAt || remote.updatedAt > local.updatedAt)) {
        await database.updateFolder(local.id!, {
          name: remote.name,
          color: remote.color,
          sortOrder: remote.sortOrder,
        })
      }
    }

    // Push local folders without cloud copy + re-push legacy data
    const localFolders = await database.getAllFolders()
    for (const folder of localFolders) {
      if (!folder.syncId) {
        folder.syncId = generateSyncId()
        await database.updateFolder(folder.id!, { syncId: folder.syncId })
      }
      const cloudDoc = folderSnap.docs.find((d) => d.id === folder.syncId)
      if (!cloudDoc) {
        await withTimeout(pushFolder(folder), 10_000).catch(console.error)
      } else {
        const remote = cloudDoc.data()
        if (!remote.updatedAt) {
          await withTimeout(pushFolder(folder), 10_000).catch(console.error)
        }
      }
    }

    // Merge memos
    const memoSnap = await getDocs(collection(firestore, `users/${userId}/memos`))
    for (const docSnap of memoSnap.docs) {
      const remote = docSnap.data()
      const syncId = docSnap.id
      const local = await database.getMemoBySyncId(syncId)

      // Resolve folderSyncId → local folderId (with legacy fallback)
      const folderId = remote.folderSyncId
        ? await resolveFolderSyncId(remote.folderSyncId)
        : (remote.folderId ?? null)

      if (!local) {
        await database.addMemo({
          title: remote.title || '',
          body: remote.body || '',
          folderId,
          tags: remote.tags || [],
          isStarred: remote.isStarred ?? false,
          color: remote.color || 'white',
          isPinned: remote.isPinned ?? false,
          syncId,
          createdAt: remote.createdAt || new Date().toISOString(),
          updatedAt: remote.updatedAt || new Date().toISOString(),
          deletedAt: remote.deletedAt || undefined,
        })
      } else if (remote.updatedAt && remote.updatedAt > local.updatedAt) {
        await database.updateMemo(local.id!, {
          title: remote.title,
          body: remote.body,
          folderId,
          tags: remote.tags || [],
          isStarred: remote.isStarred,
          color: remote.color,
          isPinned: remote.isPinned,
          deletedAt: remote.deletedAt || undefined,
        })
      }
    }

    // Push local memos without cloud copy + migrate legacy folderId
    const localMemos = await database.getAllMemos()
    for (const memo of localMemos) {
      if (!memo.syncId) {
        memo.syncId = generateSyncId()
        await database.updateMemo(memo.id!, { syncId: memo.syncId })
      }
      const cloudDoc = memoSnap.docs.find((d) => d.id === memo.syncId)
      if (!cloudDoc) {
        await withTimeout(pushMemo(memo), 10_000).catch(console.error)
      } else {
        const remote = cloudDoc.data()
        if (memo.folderId != null && !remote.folderSyncId) {
          await withTimeout(pushMemo(memo), 10_000).catch(console.error)
        }
      }
    }

    if (refreshFolders) await refreshFolders()
    if (refreshMemos) await refreshMemos()
  } finally {
    mergePromise = null
  }
}

// ─── Real-time Listeners ───────────────────────────

function startListeners(userId: string) {
  // Clean up existing listeners before re-subscribing
  if (unsubMemos) { unsubMemos(); unsubMemos = null }
  if (unsubFolders) { unsubFolders(); unsubFolders = null }

  unsubMemos = onSnapshot(
    collection(firestore, `users/${userId}/memos`),
    async (snapshot) => {
      if (mergePromise) await mergePromise

      try {
        for (const change of snapshot.docChanges()) {
          const syncId = change.doc.id
          if (recentlyPushed.has(`memo-${syncId}`)) continue

          const remote = change.doc.data()

          if (change.type === 'added' || change.type === 'modified') {
            const local = await database.getMemoBySyncId(syncId)
            // Resolve folderSyncId → local folderId (with legacy fallback)
            const folderId = remote.folderSyncId
              ? await resolveFolderSyncId(remote.folderSyncId)
              : (remote.folderId ?? null)

            if (!local) {
              await database.addMemo({
                title: remote.title || '',
                body: remote.body || '',
                folderId,
                tags: remote.tags || [],
                isStarred: remote.isStarred ?? false,
                color: remote.color || 'white',
                isPinned: remote.isPinned ?? false,
                syncId,
                createdAt: remote.createdAt || new Date().toISOString(),
                updatedAt: remote.updatedAt || new Date().toISOString(),
                deletedAt: remote.deletedAt || undefined,
              })
            } else if (remote.updatedAt && remote.updatedAt > local.updatedAt) {
              await database.updateMemo(local.id!, {
                title: remote.title,
                body: remote.body,
                folderId,
                tags: remote.tags || [],
                isStarred: remote.isStarred,
                color: remote.color,
                isPinned: remote.isPinned,
                deletedAt: remote.deletedAt || undefined,
              })
            }
          }

          if (change.type === 'removed') {
            const local = await database.getMemoBySyncId(syncId)
            if (local) {
              await database.permanentDeleteMemo(local.id!)
            }
          }
        }

        if (refreshMemos) await refreshMemos()
      } catch (err) {
        console.error('Memo sync listener error:', err)
      }
    },
    (err) => {
      console.error('Memo snapshot listener failed:', err)
      useToastStore.getState().showToast('메모 동기화 연결이 끊어졌습니다', 'warning')
    }
  )

  unsubFolders = onSnapshot(
    collection(firestore, `users/${userId}/folders`),
    async (snapshot) => {
      if (mergePromise) await mergePromise

      try {
        for (const change of snapshot.docChanges()) {
          const syncId = change.doc.id
          if (recentlyPushed.has(`folder-${syncId}`)) continue

          const remote = change.doc.data()

          if (change.type === 'added' || change.type === 'modified') {
            const local = await database.getFolderBySyncId(syncId)
            if (!local) {
              await database.addFolder({
                name: remote.name,
                color: remote.color,
                sortOrder: remote.sortOrder ?? 0,
                isDefault: remote.isDefault ?? false,
                isSystem: remote.isSystem ?? false,
                syncId,
                createdAt: remote.createdAt || new Date().toISOString(),
                updatedAt: remote.updatedAt || new Date().toISOString(),
              })
            } else if (remote.updatedAt && (!local.updatedAt || remote.updatedAt > local.updatedAt)) {
              await database.updateFolder(local.id!, {
                name: remote.name,
                color: remote.color,
                sortOrder: remote.sortOrder,
              })
            }
          }

          if (change.type === 'removed') {
            const local = await database.getFolderBySyncId(syncId)
            if (local && !local.isDefault && !local.isSystem) {
              await database.deleteFolder(local.id!)
            }
          }
        }

        if (refreshFolders) await refreshFolders()
      } catch (err) {
        console.error('Folder sync listener error:', err)
      }
    },
    (err) => {
      console.error('Folder snapshot listener failed:', err)
      useToastStore.getState().showToast('폴더 동기화 연결이 끊어졌습니다', 'warning')
    }
  )
}

// ─── Init / Stop ───────────────────────────────────

export async function initSync(userId: string) {
  currentUserId = userId
  await initialMerge(userId)
  startListeners(userId)

  // Settings cloud sync
  const { initSettingsSync } = await import('./settingsSync')
  await initSettingsSync(userId)
}

export function stopSync() {
  if (unsubMemos) { unsubMemos(); unsubMemos = null }
  if (unsubFolders) { unsubFolders(); unsubFolders = null }
  currentUserId = null
  recentlyPushed.clear()
  for (const timer of recentlyPushedTimers.values()) clearTimeout(timer)
  recentlyPushedTimers.clear()
  mergePromise = null

  // Stop settings sync
  import('./settingsSync').then(({ stopSettingsSync }) => stopSettingsSync())
}
