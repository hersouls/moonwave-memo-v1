import Dexie, { type Table } from 'dexie'
import type { Task, Category, CompletionLog, Attachment, TaskTemplate, ActivityLog, TaskGroup } from '@/lib/types'

class TodoDatabase extends Dexie {
  tasks!: Table<Task>
  categories!: Table<Category>
  completionLogs!: Table<CompletionLog>
  attachments!: Table<Attachment>
  templates!: Table<TaskTemplate>
  activityLogs!: Table<ActivityLog>
  taskGroups!: Table<TaskGroup>

  constructor() {
    super('TodoList')
    this.version(1).stores({
      tasks: '++id, categoryId, status, dueDate, isFlagged, isStarred, createdAt, sortOrder',
      categories: '++id, name, isDefault, sortOrder',
      completionLogs: '++id, taskId, date, completedAt',
    })

    this.version(2).stores({
      tasks: '++id, categoryId, status, dueDate, isFlagged, isStarred, createdAt, sortOrder',
      categories: '++id, name, isDefault, sortOrder',
      completionLogs: '++id, taskId, date, completedAt',
      attachments: '++id, taskId, createdAt',
      templates: '++id, name, categoryId, createdAt',
      activityLogs: '++id, taskId, action, date, createdAt',
    })

    this.version(3).stores({
      tasks: '++id, categoryId, status, dueDate, isFlagged, isStarred, createdAt, sortOrder, syncId',
      categories: '++id, name, isDefault, sortOrder, syncId',
      completionLogs: '++id, taskId, date, completedAt, syncId',
      attachments: '++id, taskId, createdAt',
      templates: '++id, name, categoryId, createdAt',
      activityLogs: '++id, taskId, action, date, createdAt',
    }).upgrade(async (tx) => {
      const tasks = await tx.table('tasks').toArray()
      for (const task of tasks) {
        await tx.table('tasks').update(task.id, { syncId: crypto.randomUUID() })
      }
      const categories = await tx.table('categories').toArray()
      for (const cat of categories) {
        await tx.table('categories').update(cat.id, {
          syncId: crypto.randomUUID(),
          updatedAt: cat.createdAt,
        })
      }
      const logs = await tx.table('completionLogs').toArray()
      for (const log of logs) {
        await tx.table('completionLogs').update(log.id, { syncId: crypto.randomUUID() })
      }
    })

    this.version(4).stores({
      tasks: '++id, categoryId, status, dueDate, isFlagged, isStarred, createdAt, sortOrder, syncId',
      categories: '++id, name, isDefault, sortOrder, syncId, parentId',
      completionLogs: '++id, taskId, date, completedAt, syncId',
      attachments: '++id, taskId, createdAt',
      templates: '++id, name, categoryId, createdAt',
      activityLogs: '++id, taskId, action, date, createdAt',
    })

    this.version(5).stores({
      tasks: '++id, categoryId, status, dueDate, isFlagged, isStarred, createdAt, sortOrder, syncId',
      categories: '++id, name, isDefault, sortOrder, syncId, parentId',
      completionLogs: '++id, taskId, date, completedAt, syncId',
      attachments: '++id, taskId, createdAt',
      templates: '++id, name, categoryId, createdAt',
      activityLogs: '++id, taskId, action, date, createdAt',
      taskGroups: '++id, name, sortOrder, syncId, createdAt',
    })
  }
}

const db = new TodoDatabase()

db.on('populate', () => {
  db.categories.bulkAdd([
    { name: '작업', color: '#3B82F6', isDefault: true, sortOrder: 0, createdAt: new Date().toISOString() },
    { name: '개인', color: '#10B981', isDefault: true, sortOrder: 1, createdAt: new Date().toISOString() },
    { name: '위시리스트', color: '#F59E0B', isDefault: true, sortOrder: 2, createdAt: new Date().toISOString() },
  ])
})

export { db }

// ─── Task CRUD ─────────────────────────────────────
export async function getAllTasks(): Promise<Task[]> {
  return db.tasks.toArray()
}

export async function getTask(id: number): Promise<Task | undefined> {
  return db.tasks.get(id)
}

export async function addTask(task: Omit<Task, 'id'>): Promise<number> {
  return db.tasks.add(task as Task) as Promise<number>
}

export async function updateTask(id: number, updates: Partial<Task>): Promise<void> {
  await db.tasks.update(id, { ...updates, updatedAt: new Date().toISOString() })
}

export async function deleteTask(id: number): Promise<void> {
  await db.tasks.delete(id)
  await db.completionLogs.where('taskId').equals(id).delete()
  await db.attachments.where('taskId').equals(id).delete()
}

export async function getTasksByDate(date: string): Promise<Task[]> {
  return db.tasks.where('dueDate').equals(date).toArray()
}

export async function getTasksByCategory(categoryId: number): Promise<Task[]> {
  return db.tasks.where('categoryId').equals(categoryId).toArray()
}

export async function getOverdueTasks(): Promise<Task[]> {
  const today = new Date().toISOString().split('T')[0]
  return db.tasks
    .where('status').equals('pending')
    .filter(t => !!t.dueDate && t.dueDate < today)
    .toArray()
}

export async function getUpcomingTasks(days: number): Promise<Task[]> {
  const today = new Date()
  const end = new Date(today)
  end.setDate(end.getDate() + days)
  const todayStr = today.toISOString().split('T')[0]
  const endStr = end.toISOString().split('T')[0]
  return db.tasks
    .where('status').equals('pending')
    .filter(t => !!t.dueDate && t.dueDate >= todayStr && t.dueDate <= endStr)
    .toArray()
}

// ─── Bulk Task Operations ─────────────────────────
export async function bulkUpdateTasks(ids: number[], updates: Partial<Task>): Promise<void> {
  await db.transaction('rw', db.tasks, async () => {
    const now = new Date().toISOString()
    for (const id of ids) {
      await db.tasks.update(id, { ...updates, updatedAt: now })
    }
  })
}

export async function bulkDeleteTasks(ids: number[]): Promise<void> {
  await db.transaction('rw', [db.tasks, db.completionLogs, db.attachments], async () => {
    await db.tasks.bulkDelete(ids)
    for (const id of ids) {
      await db.completionLogs.where('taskId').equals(id).delete()
      await db.attachments.where('taskId').equals(id).delete()
    }
  })
}

// ─── Category CRUD ─────────────────────────────────
export async function getAllCategories(): Promise<Category[]> {
  return db.categories.orderBy('sortOrder').toArray()
}

export async function addCategory(cat: Omit<Category, 'id'>): Promise<number> {
  return db.categories.add(cat as Category) as Promise<number>
}

export async function updateCategory(id: number, updates: Partial<Category>): Promise<void> {
  await db.categories.update(id, updates)
}

export async function deleteCategory(id: number): Promise<void> {
  await db.categories.delete(id)
  await db.tasks.where('categoryId').equals(id).modify({ categoryId: null })
}

// ─── CompletionLog ─────────────────────────────────
export async function addCompletionLog(log: Omit<CompletionLog, 'id'>): Promise<void> {
  await db.completionLogs.add(log as CompletionLog)
}

export async function getCompletionLogsByRange(start: string, end: string): Promise<CompletionLog[]> {
  return db.completionLogs
    .where('date')
    .between(start, end, true, true)
    .toArray()
}

export async function getDailyCompletionCounts(start: string, end: string): Promise<Record<string, number>> {
  const logs = await getCompletionLogsByRange(start, end)
  const counts: Record<string, number> = {}
  for (const log of logs) {
    counts[log.date] = (counts[log.date] || 0) + 1
  }
  return counts
}

export async function getTotalCompletedCount(): Promise<number> {
  return db.completionLogs.count()
}

// ─── Attachment CRUD ──────────────────────────────
export async function getAttachmentsByTask(taskId: number): Promise<Attachment[]> {
  return db.attachments.where('taskId').equals(taskId).toArray()
}

export async function addAttachment(attachment: Omit<Attachment, 'id'>): Promise<number> {
  return db.attachments.add(attachment as Attachment) as Promise<number>
}

export async function deleteAttachment(id: number): Promise<void> {
  await db.attachments.delete(id)
}

export async function getAttachmentCountByTask(taskId: number): Promise<number> {
  return db.attachments.where('taskId').equals(taskId).count()
}

// ─── Template CRUD ────────────────────────────────
export async function getAllTemplates(): Promise<TaskTemplate[]> {
  return db.templates.toArray()
}

export async function addTemplate(template: Omit<TaskTemplate, 'id'>): Promise<number> {
  return db.templates.add(template as TaskTemplate) as Promise<number>
}

export async function deleteTemplate(id: number): Promise<void> {
  await db.templates.delete(id)
}

// ─── Activity Log CRUD ────────────────────────────
export async function getActivityLogs(limit: number = 100): Promise<ActivityLog[]> {
  return db.activityLogs.orderBy('createdAt').reverse().limit(limit).toArray()
}

export async function getActivityLogsByDateRange(start: string, end: string): Promise<ActivityLog[]> {
  return db.activityLogs
    .where('date')
    .between(start, end, true, true)
    .reverse()
    .toArray()
}

export async function addActivityLog(log: Omit<ActivityLog, 'id'>): Promise<void> {
  await db.activityLogs.add(log as ActivityLog)
  // 자동 정리: 1000개 초과 시 오래된 항목 삭제
  const count = await db.activityLogs.count()
  if (count > 1000) {
    const oldest = await db.activityLogs.orderBy('createdAt').limit(count - 1000).toArray()
    await db.activityLogs.bulkDelete(oldest.map(l => l.id!))
  }
}

export async function clearOldActivityLogs(daysToKeep: number): Promise<void> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - daysToKeep)
  const cutoffStr = cutoff.toISOString().split('T')[0]
  await db.activityLogs.where('date').below(cutoffStr).delete()
}

// ─── Sync Helpers ─────────────────────────────────
export function generateSyncId(): string {
  return crypto.randomUUID()
}

export async function getTaskBySyncId(syncId: string): Promise<Task | undefined> {
  return db.tasks.where('syncId').equals(syncId).first()
}

export async function getCategoryBySyncId(syncId: string): Promise<Category | undefined> {
  return db.categories.where('syncId').equals(syncId).first()
}

export async function getCompletionLogBySyncId(syncId: string): Promise<CompletionLog | undefined> {
  return db.completionLogs.where('syncId').equals(syncId).first()
}

// ─── Task Group CRUD ─────────────────────────────
export async function getAllTaskGroups(): Promise<TaskGroup[]> {
  return db.taskGroups.orderBy('sortOrder').toArray()
}

export async function addTaskGroup(group: Omit<TaskGroup, 'id'>): Promise<number> {
  return db.taskGroups.add(group as TaskGroup) as Promise<number>
}

export async function updateTaskGroup(id: number, updates: Partial<TaskGroup>): Promise<void> {
  await db.taskGroups.update(id, { ...updates, updatedAt: new Date().toISOString() })
}

export async function deleteTaskGroup(id: number): Promise<void> {
  await db.taskGroups.delete(id)
}

// ─── Bulk Operations ───────────────────────────────
export async function clearAllData(): Promise<void> {
  await db.tasks.clear()
  await db.categories.clear()
  await db.completionLogs.clear()
  await db.attachments.clear()
  await db.templates.clear()
  await db.activityLogs.clear()
  await db.taskGroups.clear()
  await db.categories.bulkAdd([
    { name: '작업', color: '#3B82F6', isDefault: true, sortOrder: 0, createdAt: new Date().toISOString() },
    { name: '개인', color: '#10B981', isDefault: true, sortOrder: 1, createdAt: new Date().toISOString() },
    { name: '위시리스트', color: '#F59E0B', isDefault: true, sortOrder: 2, createdAt: new Date().toISOString() },
  ])
}
