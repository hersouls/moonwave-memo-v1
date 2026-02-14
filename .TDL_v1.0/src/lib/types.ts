// ─── Core Task Types ───────────────────────────────
export type TaskPriority = 'none' | 'low' | 'medium' | 'high'
export type TaskStatus = 'pending' | 'completed'
export type RepeatType = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface RepeatPattern {
  type: RepeatType
  interval: number
  weekDays?: number[]
  monthDay?: number
  endDate?: string
}

export interface SubTask {
  id: string
  title: string
  isCompleted: boolean
  sortOrder: number
  createdAt: string
}

export interface TaskAlarm {
  enabled: boolean
  time?: string
  minutesBefore?: number
}

export interface Task {
  id?: number
  syncId?: string
  title: string
  categoryId: number | null
  status: TaskStatus
  priority: TaskPriority
  isFlagged: boolean
  isStarred: boolean
  dueDate?: string
  dueTime?: string
  alarm: TaskAlarm
  repeat: RepeatPattern
  memo?: string
  subtasks: SubTask[]
  completedAt?: string
  createdAt: string
  updatedAt: string
  sortOrder: number
}

export interface Category {
  id?: number
  syncId?: string
  name: string
  color: string
  icon?: string
  parentId?: number | null
  isDefault: boolean
  sortOrder: number
  createdAt: string
  updatedAt?: string
}

export interface CompletionLog {
  id?: number
  syncId?: string
  taskId: number
  completedAt: string
  date: string
}

export interface UserProfile {
  name: string
  avatarUrl?: string
  streakStartDate?: string
  currentStreak: number
}

// ─── Notification Types ────────────────────────────
export type NotificationType =
  | 'task-due'
  | 'task-overdue'
  | 'task-reminder'
  | 'backup-reminder'
  | 'streak-milestone'

export interface AppNotification {
  id: string
  type: NotificationType
  title: string
  message: string
  taskId?: number
  createdAt: Date
  read: boolean
}

// ─── Dashboard/Stats Types ─────────────────────────
export interface TaskStats {
  completedCount: number
  pendingCount: number
  currentStreak: number
}

export interface DailyCompletionData {
  date: string
  count: number
}

export interface CategoryBreakdown {
  categoryId: number | null
  categoryName: string
  categoryColor: string
  count: number
}

// ─── Settings Types ────────────────────────────────
export type ThemeMode = 'light' | 'dark' | 'system'
export type ColorPalette = 'default' | 'ocean' | 'rose' | 'purple' | 'forest'

export interface TaskAlertPreferences {
  dueReminder: boolean
  overdueAlert: boolean
}

export interface Settings {
  theme: ThemeMode
  isMusicPlayerEnabled: boolean
  colorPalette: ColorPalette
  lastBackupDate?: string
  alertPreferences: {
    task: TaskAlertPreferences
  }
  googleDrive: {
    isConnected: boolean
    autoBackup: boolean
    lastSyncDate?: string
  }
  browserNotificationsEnabled: boolean
  paymentMethods: CreditCard[]
  userProfile: UserProfile
  aiEnabled: boolean
  aiApiKey: string
  hasCompletedOnboarding: boolean
}

export interface CreditCard {
  id: string
  cardholderName: string
  cardNumber: string // Last 4 digits or masked
  expiryDate: string // MM/YY
  cvc: string // Dummy for UI
  cardType: 'visa' | 'mastercard' | 'amex' | 'other'
}

// ─── Attachment Types ─────────────────────────────
export interface Attachment {
  id?: number
  taskId: number
  filename: string
  mimeType: string
  size: number
  data: Blob
  thumbnailData?: Blob
  createdAt: string
}

// ─── Template Types ──────────────────────────────
export interface TaskTemplate {
  id?: number
  name: string
  description?: string
  categoryId: number | null
  priority: TaskPriority
  subtasks: { title: string; sortOrder: number }[]
  repeat: RepeatPattern
  memo?: string
  isBuiltIn: boolean
  createdAt: string
}

// ─── Activity Log Types ──────────────────────────
export type ActivityAction =
  | 'task-created'
  | 'task-completed'
  | 'task-uncompleted'
  | 'task-deleted'
  | 'task-edited'
  | 'task-moved'
  | 'task-flagged'
  | 'task-unflagged'
  | 'subtask-added'
  | 'subtask-completed'

export interface ActivityLog {
  id?: number
  taskId: number
  taskTitle: string
  action: ActivityAction
  details?: string
  date: string
  createdAt: string
}

// ─── Task Group Types ─────────────────────────────
export interface TaskGroup {
  id?: number
  syncId?: string
  name: string
  description?: string
  color: string
  icon?: string
  taskIds: number[]
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface SuggestedGroup {
  name: string
  description: string
  color: string
  taskIds: number[]
  reason: string
}

// ─── Backup Types ──────────────────────────────────
export interface BackupFile {
  version: string
  appName: string
  exportDate: string
  data: {
    tasks: Task[]
    categories: Category[]
    completionLogs: CompletionLog[]
    attachments?: Omit<Attachment, 'data' | 'thumbnailData'>[]
    templates?: TaskTemplate[]
    activityLogs?: ActivityLog[]
    settings: {
      theme: string
      colorPalette: string
      isMusicPlayerEnabled: boolean
    }
  }
}
