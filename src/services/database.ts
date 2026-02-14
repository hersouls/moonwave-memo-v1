import Dexie, { type Table } from 'dexie'
import type { Memo, Folder, MemoImage, MemoVersion } from '@/lib/types'
import { generateSyncId } from '@/utils/id'
import { nowISO } from '@/lib/dateUtils'
import { DEFAULT_FOLDERS, SYSTEM_FOLDERS } from '@/utils/constants'

class MemoDatabase extends Dexie {
  memos!: Table<Memo>
  folders!: Table<Folder>
  memoImages!: Table<MemoImage>
  memoVersions!: Table<MemoVersion>

  constructor() {
    super('MemoApp')

    this.version(1).stores({
      memos: '++id, folderId, isStarred, isPinned, createdAt, updatedAt, deletedAt, syncId, *tags',
      folders: '++id, name, isDefault, isSystem, sortOrder, syncId',
    })

    this.version(2).stores({
      memos: '++id, folderId, isStarred, isPinned, createdAt, updatedAt, deletedAt, syncId, *tags',
      folders: '++id, name, isDefault, isSystem, sortOrder, syncId',
      memoImages: '++id, memoId, syncId, createdAt',
    })

    this.version(3).stores({
      memos: '++id, folderId, isStarred, isPinned, createdAt, updatedAt, deletedAt, syncId, *tags',
      folders: '++id, name, isDefault, isSystem, sortOrder, syncId',
      memoImages: '++id, memoId, syncId, createdAt',
      memoVersions: '++id, memoId, createdAt',
    })

    this.on('populate', () => {
      const now = nowISO()
      const allFolders = [...DEFAULT_FOLDERS, ...SYSTEM_FOLDERS]
      allFolders.forEach((f, i) => {
        this.folders.add({
          name: f.name,
          color: f.color,
          sortOrder: i,
          isDefault: f.isDefault,
          isSystem: f.isSystem,
          syncId: generateSyncId(),
          createdAt: now,
        })
      })
    })
  }
}

export const db = new MemoDatabase()

// ─── Memo CRUD ─────────────────────────────────────

export async function getAllMemos(): Promise<Memo[]> {
  return db.memos.toArray()
}

export async function getActiveMemos(): Promise<Memo[]> {
  return db.memos.filter((m) => !m.deletedAt).toArray()
}

export async function getMemo(id: number): Promise<Memo | undefined> {
  return db.memos.get(id)
}

export async function addMemo(memo: Omit<Memo, 'id'>): Promise<number> {
  const now = nowISO()
  const data: Omit<Memo, 'id'> = {
    ...memo,
    syncId: memo.syncId || generateSyncId(),
    createdAt: memo.createdAt || now,
    updatedAt: memo.updatedAt || now,
  }
  return db.memos.add(data as Memo) as unknown as number
}

export async function updateMemo(id: number, updates: Partial<Memo>): Promise<void> {
  await db.memos.update(id, {
    ...updates,
    updatedAt: nowISO(),
  })
}

export async function softDeleteMemo(id: number): Promise<void> {
  await db.memos.update(id, {
    deletedAt: nowISO(),
    updatedAt: nowISO(),
  })
}

export async function restoreMemo(id: number): Promise<void> {
  await db.memos.update(id, {
    deletedAt: undefined,
    updatedAt: nowISO(),
  })
}

export async function permanentDeleteMemo(id: number): Promise<void> {
  await db.memoImages.where('memoId').equals(id).delete()
  await db.memos.delete(id)
}

export async function emptyTrash(): Promise<void> {
  const deleted = await db.memos.filter((m) => !!m.deletedAt).toArray()
  const ids = deleted.map((m) => m.id!).filter(Boolean)
  for (const id of ids) {
    await db.memoImages.where('memoId').equals(id).delete()
  }
  await db.memos.bulkDelete(ids)
}

export async function getMemosByFolder(folderId: number): Promise<Memo[]> {
  return db.memos.where('folderId').equals(folderId).filter((m) => !m.deletedAt).toArray()
}

export async function getStarredMemos(): Promise<Memo[]> {
  return db.memos.where('isStarred').equals(1).filter((m) => !m.deletedAt).toArray()
}

export async function getDeletedMemos(): Promise<Memo[]> {
  return db.memos.filter((m) => !!m.deletedAt).toArray()
}

export async function getMemoBySyncId(syncId: string): Promise<Memo | undefined> {
  return db.memos.where('syncId').equals(syncId).first()
}

// Bulk operations
export async function bulkUpdateMemos(ids: number[], updates: Partial<Memo>): Promise<void> {
  const now = nowISO()
  await db.memos.where('id').anyOf(ids).modify({ ...updates, updatedAt: now })
}

export async function bulkSoftDeleteMemos(ids: number[]): Promise<void> {
  const now = nowISO()
  await db.memos.where('id').anyOf(ids).modify({ deletedAt: now, updatedAt: now })
}

export async function bulkMoveMemos(ids: number[], folderId: number): Promise<void> {
  const now = nowISO()
  await db.memos.where('id').anyOf(ids).modify({ folderId, updatedAt: now })
}

// ─── Folder CRUD ───────────────────────────────────

export async function getAllFolders(): Promise<Folder[]> {
  return db.folders.orderBy('sortOrder').toArray()
}

export async function getFolder(id: number): Promise<Folder | undefined> {
  return db.folders.get(id)
}

export async function addFolder(folder: Omit<Folder, 'id'>): Promise<number> {
  const now = nowISO()
  const count = await db.folders.count()
  return db.folders.add({
    ...folder,
    syncId: folder.syncId || generateSyncId(),
    sortOrder: folder.sortOrder ?? count,
    createdAt: folder.createdAt || now,
  } as Folder) as unknown as number
}

export async function updateFolder(id: number, updates: Partial<Folder>): Promise<void> {
  await db.folders.update(id, {
    ...updates,
    updatedAt: nowISO(),
  })
}

export async function deleteFolder(id: number): Promise<void> {
  // Move all memos from this folder to the default folder
  const defaultFolder = await db.folders.where('isDefault').equals(1).first()
  if (defaultFolder?.id) {
    await db.memos.where('folderId').equals(id).modify({ folderId: defaultFolder.id })
  }
  await db.folders.delete(id)
}

export async function getFolderBySyncId(syncId: string): Promise<Folder | undefined> {
  return db.folders.where('syncId').equals(syncId).first()
}

export async function getMemoCountByFolder(folderId: number): Promise<number> {
  return db.memos.where('folderId').equals(folderId).filter((m) => !m.deletedAt).count()
}

// ─── MemoImage CRUD ───────────────────────────────

export async function addMemoImage(image: Omit<MemoImage, 'id'>): Promise<number> {
  return db.memoImages.add(image as MemoImage) as unknown as number
}

export async function getMemoImage(id: number): Promise<MemoImage | undefined> {
  return db.memoImages.get(id)
}

export async function getImagesByMemoId(memoId: number): Promise<MemoImage[]> {
  return db.memoImages.where('memoId').equals(memoId).toArray()
}

export async function deleteMemoImage(id: number): Promise<void> {
  await db.memoImages.delete(id)
}

export async function deleteImagesByMemoId(memoId: number): Promise<void> {
  await db.memoImages.where('memoId').equals(memoId).delete()
}

// ─── MemoVersion CRUD ────────────────────────────

export async function addMemoVersion(version: Omit<MemoVersion, 'id'>): Promise<number> {
  return db.memoVersions.add(version as MemoVersion) as unknown as number
}

export async function getVersionsByMemoId(memoId: number): Promise<MemoVersion[]> {
  return db.memoVersions.where('memoId').equals(memoId).reverse().sortBy('createdAt')
}

export async function getMemoVersion(id: number): Promise<MemoVersion | undefined> {
  return db.memoVersions.get(id)
}

export async function deleteVersionsByMemoId(memoId: number): Promise<void> {
  await db.memoVersions.where('memoId').equals(memoId).delete()
}
