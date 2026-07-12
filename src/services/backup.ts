import { db, getAllMemos, getAllFolders } from './database'
import type { Memo, Folder, MemoImage, MemoVersion, AmbientImage, BackupFile } from '@/lib/types'
import { BACKUP_CONFIG, DEFAULT_FOLDERS, SYSTEM_FOLDERS } from '@/utils/constants'
import { nowISO } from '@/lib/dateUtils'
import { generateSyncId } from '@/utils/id'

export interface BackupValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  metadata?: {
    version: string
    exportDate: string
    memoCount: number
  }
}

export async function createBackup(): Promise<BackupFile> {
  // Read all tables inside one read transaction so a concurrent autosave can't produce
  // an internally inconsistent snapshot (e.g. a version row referencing a memo not in
  // the memos array).
  let memos: Memo[] = []
  let folders: Folder[] = []
  let memoImages: MemoImage[] = []
  let memoVersions: MemoVersion[] = []
  let ambientImages: AmbientImage[] = []
  let demianChats: Array<{ memoId: number; messages: Array<{ role: string; content: string }>; updatedAt: string }> = []
  await db.transaction('r', [db.memos, db.folders, db.memoImages, db.memoVersions, db.ambientImages, db.demianChats], async () => {
    memos = await getAllMemos()
    folders = await getAllFolders()
    memoImages = await db.memoImages.toArray()
    memoVersions = await db.memoVersions.toArray()
    ambientImages = await db.ambientImages.toArray()
    demianChats = await db.demianChats.toArray()
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let settings: any = {}
  try {
    const settingsStr = localStorage.getItem('memo-settings')
    if (settingsStr) settings = JSON.parse(settingsStr).state?.settings ?? {}
  } catch { /* corrupted settings — export with defaults */ }

  return {
    version: BACKUP_CONFIG.CURRENT_VERSION,
    appName: BACKUP_CONFIG.APP_NAME,
    exportDate: new Date().toISOString(),
    data: {
      memos,
      folders,
      memoImages,
      memoVersions,
      ambientImages,
      demianChats: demianChats.map((c) => ({ memoId: c.memoId, messages: c.messages, updatedAt: c.updatedAt })),
      settings: {
        theme: settings.theme || 'light',
        colorPalette: settings.colorPalette || 'default',
        fontFamily: settings.fontFamily || 'pretendard',
        fontSize: settings.fontSize || 'md',
      },
    },
  }
}

export function downloadBackup(backup: BackupFile): void {
  const json = JSON.stringify(backup, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const date = new Date()
  const dateStr = date.toISOString().slice(0, 10)
  const timeStr = date.toTimeString().slice(0, 5).replace(':', '')
  const filename = `${BACKUP_CONFIG.FILE_PREFIX}_${dateStr}_${timeStr}.json`

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function parseBackupFile(
  file: File
): Promise<{ success: boolean; data?: BackupFile; error?: string }> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        const data = JSON.parse(text)
        resolve({ success: true, data })
      } catch {
        resolve({ success: false, error: '파일을 읽을 수 없습니다. 유효한 JSON 파일인지 확인하세요.' })
      }
    }
    reader.onerror = () => resolve({ success: false, error: '파일 읽기에 실패했습니다.' })
    reader.readAsText(file)
  })
}

export function validateBackup(data: unknown): BackupValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { valid: false, errors: ['유효한 JSON 파일이 아닙니다.'], warnings: [] }
  }

  const backup = data as Partial<BackupFile>

  if (!backup.version) {
    errors.push('버전 정보가 없습니다.')
  }

  if (!backup.data) {
    errors.push('데이터가 없습니다.')
    return { valid: false, errors, warnings }
  }

  if (!Array.isArray(backup.data.memos)) {
    errors.push('메모 데이터가 유효하지 않습니다.')
  }

  if (!Array.isArray(backup.data.folders)) {
    warnings.push('폴더 데이터가 없습니다. 기본 폴더가 사용됩니다.')
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    metadata: errors.length === 0
      ? {
          version: backup.version || 'unknown',
          exportDate: backup.exportDate || 'unknown',
          memoCount: backup.data?.memos?.length || 0,
        }
      : undefined,
  }
}

export async function restoreFromBackup(
  backup: BackupFile
): Promise<{ success: boolean; error?: string }> {
  try {
    // Stamp restored data as authoritative: a fresh updatedAt (now) makes the restore
    // win last-write-wins over any newer cloud copy, so on reload initSync re-uploads
    // the restored content instead of the cloud silently reverting it. Backfill missing
    // syncIds so every restored memo/folder participates in sync.
    const restoreStamp = new Date().toISOString()
    const memos = (backup.data.memos || []).map((m: Memo) => ({
      ...m,
      syncId: m.syncId || generateSyncId(),
      createdAt: m.createdAt || restoreStamp,
      updatedAt: restoreStamp,
    }))

    const folders = (backup.data.folders || []).map((f: Folder) => ({
      ...f,
      syncId: f.syncId || generateSyncId(),
      createdAt: f.createdAt || restoreStamp,
      updatedAt: restoreStamp,
    }))

    // Drop child rows referencing a memo id absent from the restored set so a
    // pre-existing inconsistent backup can't seed phantom version/image history.
    const memoIds = new Set(memos.map((m) => m.id).filter((id): id is number => id != null))
    const backupImages = (backup.data.memoImages || []).filter((img) => memoIds.has(img.memoId))
    const backupVersions = (backup.data.memoVersions || []).filter((v) => memoIds.has(v.memoId))
    const backupAmbient = backup.data.ambientImages || []
    const backupChats = (backup.data.demianChats || []).filter((c) => memoIds.has(c.memoId))

    await db.transaction('rw', [db.memos, db.folders, db.memoImages, db.memoVersions, db.ambientImages, db.demianChats], async () => {
      await db.memos.clear()
      await db.folders.clear()
      await db.memoImages.clear()
      await db.memoVersions.clear()
      await db.ambientImages.clear()
      // Clear stale chats so a cross-device restore can't leave one device's private
      // Demian thread misattached to an unrelated memo that inherited the same numeric id.
      await db.demianChats.clear()

      if (folders.length > 0) {
        await db.folders.bulkAdd(folders)
      }
      if (memos.length > 0) {
        await db.memos.bulkAdd(memos)
      }

      // B-11: Restore memoImages and memoVersions
      if (backupImages.length > 0) {
        await db.memoImages.bulkAdd(backupImages)
      }
      if (backupVersions.length > 0) {
        await db.memoVersions.bulkAdd(backupVersions)
      }
      if (backupAmbient.length > 0) {
        await db.ambientImages.bulkAdd(backupAmbient)
      }
      if (backupChats.length > 0) {
        await db.demianChats.bulkAdd(backupChats)
      }
    })

    // Restore settings
    if (backup.data.settings) {
      try {
        const currentSettings = localStorage.getItem('memo-settings')
        const parsed = currentSettings ? JSON.parse(currentSettings) : { state: { settings: {} } }
        parsed.state.settings = {
          ...parsed.state.settings,
          ...backup.data.settings,
        }
        localStorage.setItem('memo-settings', JSON.stringify(parsed))
      } catch { /* settings restore failed — non-critical */ }
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '데이터 복원에 실패했습니다.',
    }
  }
}

export async function clearAllData(): Promise<void> {
  // Wipe EVERY table, not just the visible ones. Leaving demianChats (AI transcripts),
  // embeddings, or the pendingFileOps/syncFolder queues behind means "delete all data"
  // leaks private content — and a surviving queued mirror op could even rewrite a
  // "deleted" memo's file back into the connected folder after reload.
  await db.transaction('rw',
    [db.memos, db.folders, db.memoImages, db.memoVersions, db.ambientImages,
     db.demianChats, db.pendingSyncs, db.pendingFileOps, db.embeddings, db.fileSyncMap, db.syncFolderKV],
    async () => {
      await db.memos.clear()
      await db.folders.clear()
      await db.memoImages.clear()
      await db.memoVersions.clear()
      await db.ambientImages.clear()
      await db.demianChats.clear()
      await db.pendingSyncs.clear()
      await db.pendingFileOps.clear()
      await db.embeddings.clear()
      await db.fileSyncMap.clear()
      await db.syncFolderKV.clear()
    })

  // Recreate default folders
  const now = nowISO()
  const allFolders = [...DEFAULT_FOLDERS, ...SYSTEM_FOLDERS]
  await db.folders.bulkAdd(
    allFolders.map((f, i) => ({
      name: f.name,
      color: f.color,
      sortOrder: i,
      isDefault: f.isDefault,
      isSystem: f.isSystem,
      // Stable canonical syncId so seed folders stay unified across devices
      syncId: f.syncId,
      createdAt: now,
      updatedAt: now,
    }))
  )

  // B-09: Only remove app-specific localStorage keys (memo- prefix)
  const keysToRemove: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith('memo-')) {
      keysToRemove.push(key)
    }
  }
  keysToRemove.forEach((key) => localStorage.removeItem(key))
}
