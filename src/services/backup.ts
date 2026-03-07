import { db, getAllMemos, getAllFolders } from './database'
import type { Memo, Folder, BackupFile } from '@/lib/types'
import { BACKUP_CONFIG, DEFAULT_FOLDERS, SYSTEM_FOLDERS } from '@/utils/constants'
import { generateSyncId } from '@/utils/id'
import { nowISO } from '@/lib/dateUtils'

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
  const memos = await getAllMemos()
  const folders = await getAllFolders()
  const memoImages = await db.memoImages.toArray()
  const memoVersions = await db.memoVersions.toArray()
  const ambientImages = await db.ambientImages.toArray()
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

  if (!data || typeof data !== 'object') {
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
    const memos = (backup.data.memos || []).map((m: Memo) => ({
      ...m,
      createdAt: m.createdAt || new Date().toISOString(),
      updatedAt: m.updatedAt || new Date().toISOString(),
    }))

    const folders = (backup.data.folders || []).map((f: Folder) => ({
      ...f,
      createdAt: f.createdAt || new Date().toISOString(),
    }))

    await db.transaction('rw', [db.memos, db.folders, db.memoImages, db.memoVersions, db.ambientImages], async () => {
      await db.memos.clear()
      await db.folders.clear()
      await db.memoImages.clear()
      await db.memoVersions.clear()
      await db.ambientImages.clear()

      if (folders.length > 0) {
        await db.folders.bulkAdd(folders)
      }
      if (memos.length > 0) {
        await db.memos.bulkAdd(memos)
      }

      // B-11: Restore memoImages and memoVersions
      const backupImages = (backup.data as Record<string, unknown>).memoImages as unknown[] || []
      if (backupImages.length > 0) {
        await db.memoImages.bulkAdd(backupImages as never[])
      }
      const backupVersions = (backup.data as Record<string, unknown>).memoVersions as unknown[] || []
      if (backupVersions.length > 0) {
        await db.memoVersions.bulkAdd(backupVersions as never[])
      }
      const backupAmbient = (backup.data as Record<string, unknown>).ambientImages as unknown[] || []
      if (backupAmbient.length > 0) {
        await db.ambientImages.bulkAdd(backupAmbient as never[])
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
  await db.memos.clear()
  await db.folders.clear()
  await db.memoImages.clear()
  await db.memoVersions.clear()
  await db.ambientImages.clear()

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
      syncId: generateSyncId(),
      createdAt: now,
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
