import { db, getAllTasks, getAllCategories } from './database'
import type { Task, Category, CompletionLog, Attachment, TaskTemplate, ActivityLog } from '@/lib/types'
import { BACKUP_CONFIG } from '@/utils/constants'

export interface BackupFile {
  version: string
  appName: string
  exportDate: string
  data: {
    tasks: Task[]
    categories: Category[]
    completionLogs: CompletionLog[]
    settings: {
      theme: string
      colorPalette: string
      isMusicPlayerEnabled: boolean
    }
    attachments?: Array<Omit<Attachment, 'data' | 'thumbnailData'> & { dataBase64: string; thumbnailBase64?: string }>
    templates?: TaskTemplate[]
    activityLogs?: ActivityLog[]
  }
}

export interface BackupValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  metadata?: {
    version: string
    exportDate: string
    taskCount: number
  }
}

// Blob to base64 helper
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.readAsDataURL(blob)
  })
}

// base64 to Blob helper
function base64ToBlob(base64: string): Blob {
  const parts = base64.split(',')
  const mime = parts[0].match(/:(.*?);/)?.[1] || 'application/octet-stream'
  const raw = atob(parts[1])
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) {
    arr[i] = raw.charCodeAt(i)
  }
  return new Blob([arr], { type: mime })
}

// 백업 생성
export async function createBackup(): Promise<BackupFile> {
  const tasks = await getAllTasks()
  const categories = await getAllCategories()
  const completionLogs = await db.completionLogs.toArray()
  const settingsStr = localStorage.getItem('todo-settings')
  const settings = settingsStr ? JSON.parse(settingsStr).state?.settings : {}

  // Attachments (Blob → base64)
  const rawAttachments = await db.attachments.toArray()
  const attachments = await Promise.all(
    rawAttachments.map(async (att) => {
      const dataBase64 = await blobToBase64(att.data)
      const thumbnailBase64 = att.thumbnailData ? await blobToBase64(att.thumbnailData) : undefined
      const { data, thumbnailData, ...rest } = att
      return { ...rest, dataBase64, thumbnailBase64 }
    })
  )

  // Templates
  const templates = await db.templates.toArray()

  // Activity logs
  const activityLogs = await db.activityLogs.toArray()

  return {
    version: BACKUP_CONFIG.CURRENT_VERSION,
    appName: BACKUP_CONFIG.APP_NAME,
    exportDate: new Date().toISOString(),
    data: {
      tasks,
      categories,
      completionLogs,
      settings: {
        theme: settings.theme || 'system',
        colorPalette: settings.colorPalette || 'default',
        isMusicPlayerEnabled: settings.isMusicPlayerEnabled || false,
      },
      attachments,
      templates,
      activityLogs,
    },
  }
}

// 백업 다운로드
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

// 백업 파일 파싱
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

// 백업 유효성 검사
export function validateBackup(data: unknown): BackupValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['유효한 JSON 파일이 아닙니다.'], warnings: [] }
  }

  const backup = data as Partial<BackupFile>

  if (!backup.version) {
    errors.push('버전 정보가 없습니다.')
  } else if (!(BACKUP_CONFIG.SUPPORTED_VERSIONS as readonly string[]).includes(backup.version)) {
    warnings.push(`지원되지 않는 버전입니다: ${backup.version}. 호환성 문제가 발생할 수 있습니다.`)
  }

  if (!backup.data) {
    errors.push('데이터가 없습니다.')
    return { valid: false, errors, warnings }
  }

  if (!Array.isArray(backup.data.tasks)) {
    errors.push('작업 데이터가 유효하지 않습니다.')
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    metadata: errors.length === 0
      ? {
          version: backup.version || 'unknown',
          exportDate: backup.exportDate || 'unknown',
          taskCount: backup.data?.tasks?.length || 0,
        }
      : undefined,
  }
}

// 백업에서 복원
export async function restoreFromBackup(
  backup: BackupFile
): Promise<{ success: boolean; error?: string }> {
  try {
    // 작업 데이터 복원
    const tasks = (backup.data.tasks || []).map((t) => ({
      ...t,
      createdAt: t.createdAt || new Date().toISOString(),
      updatedAt: t.updatedAt || new Date().toISOString(),
    }))

    // 카테고리 데이터 복원
    const categories = (backup.data.categories || []).map((c) => ({
      ...c,
      createdAt: c.createdAt || new Date().toISOString(),
    }))

    // 완료 로그 복원
    const completionLogs = backup.data.completionLogs || []

    // 기존 데이터 삭제 후 복원
    await db.tasks.clear()
    await db.categories.clear()
    await db.completionLogs.clear()
    await db.attachments.clear()
    await db.templates.clear()
    await db.activityLogs.clear()

    if (tasks.length > 0) {
      await db.tasks.bulkAdd(tasks)
    }
    if (categories.length > 0) {
      await db.categories.bulkAdd(categories)
    }
    if (completionLogs.length > 0) {
      await db.completionLogs.bulkAdd(completionLogs)
    }

    // 첨부 파일 복원 (base64 → Blob)
    if (backup.data.attachments && backup.data.attachments.length > 0) {
      const attachments = backup.data.attachments.map((att) => {
        const { dataBase64, thumbnailBase64, ...rest } = att
        return {
          ...rest,
          data: base64ToBlob(dataBase64),
          thumbnailData: thumbnailBase64 ? base64ToBlob(thumbnailBase64) : undefined,
        }
      })
      await db.attachments.bulkAdd(attachments)
    }

    // 템플릿 복원
    if (backup.data.templates && backup.data.templates.length > 0) {
      await db.templates.bulkAdd(backup.data.templates)
    }

    // 활동 로그 복원
    if (backup.data.activityLogs && backup.data.activityLogs.length > 0) {
      await db.activityLogs.bulkAdd(backup.data.activityLogs)
    }

    // 설정 복원
    const currentSettings = localStorage.getItem('todo-settings')
    const parsed = currentSettings ? JSON.parse(currentSettings) : { state: { settings: {} } }
    parsed.state.settings = {
      ...parsed.state.settings,
      ...backup.data.settings,
    }
    localStorage.setItem('todo-settings', JSON.stringify(parsed))

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '데이터 복원에 실패했습니다.',
    }
  }
}

// 모든 데이터 삭제
export async function clearAllData(): Promise<void> {
  // IndexedDB 삭제
  await db.tasks.clear()
  await db.categories.clear()
  await db.completionLogs.clear()
  await db.attachments.clear()
  await db.templates.clear()
  await db.activityLogs.clear()

  // 기본 카테고리 재생성
  await db.categories.bulkAdd([
    { name: '작업', color: '#3B82F6', isDefault: true, sortOrder: 0, createdAt: new Date().toISOString() },
    { name: '개인', color: '#10B981', isDefault: true, sortOrder: 1, createdAt: new Date().toISOString() },
    { name: '위시리스트', color: '#F59E0B', isDefault: true, sortOrder: 2, createdAt: new Date().toISOString() },
  ])

  // localStorage 삭제
  localStorage.clear()
}
