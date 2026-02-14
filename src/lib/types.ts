// ─── Core Memo Types ───────────────────────────────
export type MemoColor = 'white' | 'yellow' | 'green' | 'blue' | 'pink' | 'purple'

export interface Memo {
  id?: number
  syncId?: string
  title: string
  body: string
  folderId: number | null
  tags: string[]
  isStarred: boolean
  color: MemoColor
  isPinned: boolean
  createdAt: string
  updatedAt: string
  deletedAt?: string
}

export interface Folder {
  id?: number
  syncId?: string
  name: string
  color: string
  sortOrder: number
  isDefault: boolean
  isSystem: boolean
  createdAt: string
  updatedAt?: string
}

// ─── Settings Types ────────────────────────────────
export type ThemeMode = 'light' | 'dark' | 'system'
export type FontFamily = 'pretendard' | 'nanum-square' | 'nanum-square-neo' | 'nanum-square-round' | 'nanum-barun-pen' | 'maruburi'
export type FontSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl'
export type SortBy = 'updatedAt' | 'createdAt' | 'title'
export type ViewMode = 'list' | 'grid'
export type InputStartPosition = 'title' | 'body'
export type ColorPalette = 'default' | 'ocean' | 'rose' | 'purple' | 'forest'

export interface MemoSettings {
  defaultColor: MemoColor
  defaultFolderId: number | null
  inputStartPosition: InputStartPosition
  hashtagToTag: boolean
  linkPreview: boolean
}

export interface UserProfile {
  name: string
  avatarUrl?: string
}

export interface Settings {
  theme: ThemeMode
  colorPalette: ColorPalette
  fontFamily: FontFamily
  fontSize: FontSize
  memoSettings: MemoSettings
  hasCompletedOnboarding: boolean
  userProfile: UserProfile
  googleDrive: {
    isConnected: boolean
    autoBackup: boolean
    lastSyncDate?: string
  }
  lastBackupDate?: string
}

// ─── View/Filter Types ─────────────────────────────
export type MemoFilter = 'all' | 'starred'

export interface MemoFilterState {
  type: MemoFilter
  folderId?: number
  tag?: string
}

// ─── Sync Types ────────────────────────────────────
export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error'

export interface AuthUser {
  uid: string
  email: string
  displayName: string
  photoURL: string
}

// ─── Undo Types ────────────────────────────────────
export interface UndoAction {
  type: 'delete-memo' | 'delete-memos' | 'move-memo'
  data: unknown
  timestamp: number
}

// ─── Backup Types ──────────────────────────────────
export interface BackupFile {
  version: string
  appName: string
  exportDate: string
  data: {
    memos: Memo[]
    folders: Folder[]
    settings: Partial<Settings>
  }
}
