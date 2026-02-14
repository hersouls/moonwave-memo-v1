import {
  collection,
  doc,
  getDocs,
  setDoc,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore'
import { firestore } from '@/lib/firebase'
import type { Memo, Folder } from '@/lib/types'
import * as database from './database'
import { generateSyncId } from '@/utils/id'

let unsubMemos: Unsubscribe | null = null
let unsubFolders: Unsubscribe | null = null
let currentUserId: string | null = null
let refreshMemos: (() => Promise<void>) | null = null
let refreshFolders: (() => Promise<void>) | null = null

const recentlyPushed = new Set<string>()
let mergeInProgress = false

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

// ─── Push to Firestore ────────────────────────────

export async function pushMemo(memo: Memo) {
  if (!currentUserId || !memo.syncId) return
  try {
    recentlyPushed.add(`memo-${memo.syncId}`)
    const ref = doc(firestore, `users/${currentUserId}/memos`, memo.syncId)
    await setDoc(ref, stripUndefined({
      title: memo.title,
      body: memo.body,
      folderId: memo.folderId,
      tags: memo.tags,
      isStarred: memo.isStarred,
      color: memo.color,
      isPinned: memo.isPinned,
      createdAt: memo.createdAt,
      updatedAt: memo.updatedAt,
      deletedAt: memo.deletedAt || null,
    }), { merge: true })
    setTimeout(() => recentlyPushed.delete(`memo-${memo.syncId}`), 3000)
  } catch (err) {
    console.error('Push memo failed:', err)
    recentlyPushed.delete(`memo-${memo.syncId}`)
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
    setTimeout(() => recentlyPushed.delete(`folder-${folder.syncId}`), 3000)
  } catch (err) {
    console.error('Push folder failed:', err)
    recentlyPushed.delete(`folder-${folder.syncId}`)
  }
}

// ─── Initial Merge ─────────────────────────────────

async function initialMerge(userId: string) {
  if (mergeInProgress) return
  mergeInProgress = true

  try {
    // Merge folders
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
          updatedAt: remote.updatedAt,
        })
      } else if (remote.updatedAt && (!local.updatedAt || remote.updatedAt > local.updatedAt)) {
        await database.updateFolder(local.id!, {
          name: remote.name,
          color: remote.color,
          sortOrder: remote.sortOrder,
        })
      }
    }

    // Push local folders without syncId
    const localFolders = await database.getAllFolders()
    for (const folder of localFolders) {
      if (!folder.syncId) {
        folder.syncId = generateSyncId()
        await database.updateFolder(folder.id!, { syncId: folder.syncId })
      }
      const exists = folderSnap.docs.find((d) => d.id === folder.syncId)
      if (!exists) {
        await pushFolder(folder)
      }
    }

    // Merge memos
    const memoSnap = await getDocs(collection(firestore, `users/${userId}/memos`))
    for (const docSnap of memoSnap.docs) {
      const remote = docSnap.data()
      const syncId = docSnap.id
      const local = await database.getMemoBySyncId(syncId)

      if (!local) {
        await database.addMemo({
          title: remote.title || '',
          body: remote.body || '',
          folderId: remote.folderId,
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
          folderId: remote.folderId,
          tags: remote.tags || [],
          isStarred: remote.isStarred,
          color: remote.color,
          isPinned: remote.isPinned,
          deletedAt: remote.deletedAt || undefined,
        })
      }
    }

    // Push local memos
    const localMemos = await database.getAllMemos()
    for (const memo of localMemos) {
      if (!memo.syncId) {
        memo.syncId = generateSyncId()
        await database.updateMemo(memo.id!, { syncId: memo.syncId })
      }
      const exists = memoSnap.docs.find((d) => d.id === memo.syncId)
      if (!exists) {
        await pushMemo(memo)
      }
    }

    if (refreshFolders) await refreshFolders()
    if (refreshMemos) await refreshMemos()
  } finally {
    mergeInProgress = false
  }
}

// ─── Real-time Listeners ───────────────────────────

function startListeners(userId: string) {
  unsubMemos = onSnapshot(
    collection(firestore, `users/${userId}/memos`),
    async (snapshot) => {
      if (mergeInProgress) return

      for (const change of snapshot.docChanges()) {
        const syncId = change.doc.id
        if (recentlyPushed.has(`memo-${syncId}`)) continue

        const remote = change.doc.data()
        if (change.type === 'added' || change.type === 'modified') {
          const local = await database.getMemoBySyncId(syncId)
          if (!local) {
            await database.addMemo({
              title: remote.title || '',
              body: remote.body || '',
              folderId: remote.folderId,
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
              folderId: remote.folderId,
              tags: remote.tags || [],
              isStarred: remote.isStarred,
              color: remote.color,
              isPinned: remote.isPinned,
              deletedAt: remote.deletedAt || undefined,
            })
          }
        }
      }

      if (refreshMemos) await refreshMemos()
    }
  )

  unsubFolders = onSnapshot(
    collection(firestore, `users/${userId}/folders`),
    async (snapshot) => {
      if (mergeInProgress) return

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
              updatedAt: remote.updatedAt,
            })
          } else if (remote.updatedAt && (!local.updatedAt || remote.updatedAt > local.updatedAt)) {
            await database.updateFolder(local.id!, {
              name: remote.name,
              color: remote.color,
              sortOrder: remote.sortOrder,
            })
          }
        }
      }

      if (refreshFolders) await refreshFolders()
    }
  )
}

// ─── Init / Stop ───────────────────────────────────

export async function initSync(userId: string) {
  currentUserId = userId
  await initialMerge(userId)
  startListeners(userId)
}

export function stopSync() {
  if (unsubMemos) { unsubMemos(); unsubMemos = null }
  if (unsubFolders) { unsubFolders(); unsubFolders = null }
  currentUserId = null
}
