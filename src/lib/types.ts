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

// ─── Image Types ──────────────────────────────────
export interface MemoImage {
  id?: number
  memoId: number
  syncId: string
  data: string          // base64 data URL
  filename: string
  width: number
  height: number
  size: number          // original file size in bytes
  createdAt: string
}

export type OCRProvider = 'openai' | 'anthropic'
export type EditorMode = 'tabs' | 'split'

// ─── Version History Types ────────────────────────
export interface MemoVersion {
  id?: number
  memoId: number
  title: string
  body: string
  createdAt: string
}

// ─── Gamification Types ───────────────────────────
export interface Badge {
  id: string
  name: string
  unlockedAt: string
}

export interface GamificationState {
  currentStreak: number
  longestStreak: number
  totalMemosCreated: number
  lastActiveDate: string
  badges: Badge[]
}

// ─── Settings Types ────────────────────────────────
export type ThemeMode = 'light' | 'dark' | 'system'
export type FontFamily = 'pretendard' | 'nanum-square' | 'nanum-square-neo' | 'nanum-square-round' | 'nanum-barun-pen' | 'maruburi'
export type FontSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl'
export type SortBy = 'updatedAt' | 'createdAt' | 'title'
export type ViewMode = 'list' | 'grid'
export type InputStartPosition = 'title' | 'body'
export type ColorPalette = 'default' | 'ocean' | 'rose' | 'purple' | 'forest'
export type AIProvider = 'openai' | 'anthropic' | 'google'
export type STTLanguage = 'ko' | 'en' | 'ja' | 'zh'

export interface AISettings {
  openaiApiKey: string
  anthropicApiKey: string
  whisperModel: 'whisper-1'
  language: STTLanguage
  ocrProvider: OCRProvider
  aiAutocomplete: boolean
}

export interface MemoSettings {
  defaultColor: MemoColor
  defaultFolderId: number | null
  inputStartPosition: InputStartPosition
  hashtagToTag: boolean
  linkPreview: boolean
  editorMode: EditorMode
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
  ai: AISettings
  highContrastMode: boolean
  gamification: GamificationState
}

// ─── Search Filter Types ──────────────────────────
export interface SearchFilters {
  dateRange: 'all' | 'today' | 'week' | 'month'
  starredOnly: boolean
  colorFilter: MemoColor | null
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

// ─── Palette Types ─────────────────────────────────
export interface PaletteDefinition {
  id: ColorPalette
  name: string
  nameKo: string
  colors: {
    primary: string
    secondary: string
  }
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
