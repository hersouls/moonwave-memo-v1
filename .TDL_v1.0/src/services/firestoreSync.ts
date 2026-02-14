import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  type DocumentChange,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore'
import { firestore } from '@/lib/firebase'
import {
  db,
  getAllTasks,
  getAllCategories,
  getTaskBySyncId,
  getCategoryBySyncId,
  getCompletionLogBySyncId,
  generateSyncId,
  addTask as dbAddTask,
  updateTask as dbUpdateTask,
  deleteTask as dbDeleteTask,
  addCategory as dbAddCategory,
  updateCategory as dbUpdateCategory,
  deleteCategory as dbDeleteCategory,
  addCompletionLog as dbAddCompletionLog,
} from './database'
import type { Task, Category, CompletionLog } from '@/lib/types'
import { detectConflicts } from '@/lib/syncConflict'
import { useSyncConflictStore } from '@/stores/syncConflictStore'

// ─── Firestore Document Types ───────────────────────

interface FirestoreTask {
  title: string
  categorySyncId: string | null
  status: string
  priority: string
  isFlagged: boolean
  isStarred: boolean
  dueDate?: string
  dueTime?: string
  alarm: unknown
  repeat: unknown
  memo?: string
  subtasks: unknown[]
  completedAt?: string
  createdAt: string
  updatedAt: string
  sortOrder: number
}

interface FirestoreCategory {
  name: string
  color: string
  icon?: string
  isDefault: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

interface FirestoreCompletionLog {
  taskSyncId: string
  completedAt: string
  date: string
}

// ─── Module State ───────────────────────────────────

let unsubTasks: Unsubscribe | null = null
let unsubCategories: Unsubscribe | null = null
let unsubLogs: Unsubscribe | null = null
let currentUserId: string | null = null
let mergeInProgress = false
const recentlyPushed = new Set<string>()

function markPushed(syncId: string) {
  recentlyPushed.add(syncId)
  setTimeout(() => recentlyPushed.delete(syncId), 2000)
}

// ─── Store Refresh Callbacks ────────────────────────

let refreshTasksFn: (() => Promise<void>) | null = null
let refreshCategoriesFn: (() => Promise<void>) | null = null

export function registerRefreshCallbacks(
  refreshTasks: () => Promise<void>,
  refreshCategories: () => Promise<void>,
) {
  refreshTasksFn = refreshTasks
  refreshCategoriesFn = refreshCategories
}

// ─── Helpers ────────────────────────────────────────

/** Firestore rejects `undefined` values — strip them before setDoc */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stripUndefined<T>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj as any).filter(([, v]) => v !== undefined)
  ) as T
}

// ─── Converters ─────────────────────────────────────

function taskToFirestore(task: Task, categories: Category[]): FirestoreTask {
  const cat = categories.find((c) => c.id === task.categoryId)
  return stripUndefined<FirestoreTask>({
    title: task.title,
    categorySyncId: cat?.syncId || null,
    status: task.status,
    priority: task.priority,
    isFlagged: task.isFlagged,
    isStarred: task.isStarred,
    dueDate: task.dueDate,
    dueTime: task.dueTime,
    alarm: task.alarm,
    repeat: task.repeat,
    memo: task.memo,
    subtasks: task.subtasks,
    completedAt: task.completedAt,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    sortOrder: task.sortOrder,
  })
}

function categoryToFirestore(cat: Category): FirestoreCategory {
  return stripUndefined<FirestoreCategory>({
    name: cat.name,
    color: cat.color,
    icon: cat.icon,
    isDefault: cat.isDefault,
    sortOrder: cat.sortOrder,
    createdAt: cat.createdAt,
    updatedAt: cat.updatedAt || cat.createdAt,
  })
}

async function resolveCategorySyncId(syncId: string | null): Promise<number | null> {
  if (!syncId) return null
  const cat = await getCategoryBySyncId(syncId)
  return cat?.id ?? null
}

// ─── Push Operations ────────────────────────────────

export async function pushTask(task: Task): Promise<void> {
  if (!currentUserId || !task.syncId) return
  const categories = await getAllCategories()
  const docRef = doc(firestore, `users/${currentUserId}/tasks`, task.syncId)
  markPushed(task.syncId)
  await setDoc(docRef, taskToFirestore(task, categories))
}

export async function pushCategory(category: Category): Promise<void> {
  if (!currentUserId || !category.syncId) return
  const docRef = doc(firestore, `users/${currentUserId}/categories`, category.syncId)
  markPushed(category.syncId)
  await setDoc(docRef, categoryToFirestore(category))
}

export async function pushCompletionLog(log: CompletionLog, taskSyncId: string): Promise<void> {
  if (!currentUserId || !log.syncId) return
  const docRef = doc(firestore, `users/${currentUserId}/completionLogs`, log.syncId)
  markPushed(log.syncId)
  await setDoc(docRef, {
    taskSyncId,
    completedAt: log.completedAt,
    date: log.date,
  } satisfies FirestoreCompletionLog)
}

export async function deleteTaskFromCloud(syncId?: string): Promise<void> {
  if (!currentUserId || !syncId) return
  markPushed(syncId)
  await deleteDoc(doc(firestore, `users/${currentUserId}/tasks`, syncId))
}

export async function deleteCategoryFromCloud(syncId?: string): Promise<void> {
  if (!currentUserId || !syncId) return
  markPushed(syncId)
  await deleteDoc(doc(firestore, `users/${currentUserId}/categories`, syncId))
}

// ─── Initial Merge ──────────────────────────────────

async function initialMerge(userId: string): Promise<void> {
  mergeInProgress = true
  try {
    // Fetch cloud data
    const cloudCatsSnap = await getDocs(collection(firestore, `users/${userId}/categories`))
    const cloudTasksSnap = await getDocs(collection(firestore, `users/${userId}/tasks`))
    const cloudLogsSnap = await getDocs(collection(firestore, `users/${userId}/completionLogs`))

    // Fetch local data
    let localCategories = await getAllCategories()
    const localTasks = await getAllTasks()
    const localLogs = await db.completionLogs.toArray()

    // ── Detect new device (never synced before) ─────────
    const isNewDevice =
      localCategories.every((c) => !c.syncId) &&
      localTasks.every((t) => !t.syncId) &&
      localLogs.every((l) => !l.syncId)

    const cloudHasData =
      cloudCatsSnap.size > 0 || cloudTasksSnap.size > 0 || cloudLogsSnap.size > 0

    // ── New device + cloud has data: cloud-first import ─
    if (isNewDevice && cloudHasData) {
      // Delete local seed categories
      await db.categories.clear()

      // Import cloud categories → local
      for (const d of cloudCatsSnap.docs) {
        const cloudCat = d.data() as FirestoreCategory
        await dbAddCategory({
          syncId: d.id,
          name: cloudCat.name,
          color: cloudCat.color,
          icon: cloudCat.icon,
          isDefault: cloudCat.isDefault,
          sortOrder: cloudCat.sortOrder,
          createdAt: cloudCat.createdAt,
          updatedAt: cloudCat.updatedAt,
        })
      }

      // Import cloud tasks → local
      for (const d of cloudTasksSnap.docs) {
        const cloudTask = d.data() as FirestoreTask
        const categoryId = await resolveCategorySyncId(cloudTask.categorySyncId)
        await dbAddTask({
          syncId: d.id,
          title: cloudTask.title,
          categoryId,
          status: cloudTask.status as Task['status'],
          priority: cloudTask.priority as Task['priority'],
          isFlagged: cloudTask.isFlagged,
          isStarred: cloudTask.isStarred,
          dueDate: cloudTask.dueDate,
          dueTime: cloudTask.dueTime,
          alarm: cloudTask.alarm as Task['alarm'],
          repeat: cloudTask.repeat as Task['repeat'],
          memo: cloudTask.memo,
          subtasks: cloudTask.subtasks as Task['subtasks'],
          completedAt: cloudTask.completedAt,
          createdAt: cloudTask.createdAt,
          updatedAt: cloudTask.updatedAt,
          sortOrder: cloudTask.sortOrder,
        })
      }

      // Import cloud completion logs → local
      for (const d of cloudLogsSnap.docs) {
        const cloudLog = d.data() as FirestoreCompletionLog
        const task = await getTaskBySyncId(cloudLog.taskSyncId)
        if (task) {
          await dbAddCompletionLog({
            syncId: d.id,
            taskId: task.id!,
            completedAt: cloudLog.completedAt,
            date: cloudLog.date,
          })
        }
      }

      // Refresh stores and skip bidirectional merge
      await refreshTasksFn?.()
      await refreshCategoriesFn?.()
      return
    }

    // 1. Merge categories first

    // Deduplicate existing local categories before merge
    const seenSyncIds = new Set<string>()
    const seenNames = new Set<string>()
    const deduped: typeof localCategories = []
    for (const cat of localCategories) {
      if (cat.syncId && seenSyncIds.has(cat.syncId)) {
        await db.categories.delete(cat.id!)
      } else if (!cat.syncId && seenNames.has(cat.name)) {
        await db.categories.delete(cat.id!)
      } else {
        if (cat.syncId) seenSyncIds.add(cat.syncId)
        seenNames.add(cat.name)
        deduped.push(cat)
      }
    }
    localCategories = deduped

    const cloudCatMap = new Map<string, FirestoreCategory & { syncId: string }>()
    cloudCatsSnap.forEach((d) => {
      cloudCatMap.set(d.id, { ...(d.data() as FirestoreCategory), syncId: d.id })
    })

    const localCatBySyncId = new Map(
      localCategories.filter((c) => c.syncId).map((c) => [c.syncId!, c])
    )

    // Cloud → Local (categories)
    for (const [syncId, cloudCat] of cloudCatMap) {
      const localCat = localCatBySyncId.get(syncId)
      if (localCat) {
        const localUpdated = localCat.updatedAt || localCat.createdAt
        if (cloudCat.updatedAt > localUpdated) {
          await dbUpdateCategory(localCat.id!, {
            name: cloudCat.name,
            color: cloudCat.color,
            icon: cloudCat.icon,
            isDefault: cloudCat.isDefault,
            sortOrder: cloudCat.sortOrder,
            updatedAt: cloudCat.updatedAt,
          })
        } else if (localUpdated > cloudCat.updatedAt) {
          await pushCategory(localCat)
        }
      } else {
        // Fallback: match by name for seed categories without syncId
        const localByName = localCategories.find(
          (c) => !c.syncId && c.name === cloudCat.name
        )
        if (localByName) {
          await dbUpdateCategory(localByName.id!, {
            syncId,
            name: cloudCat.name,
            color: cloudCat.color,
            icon: cloudCat.icon,
            isDefault: cloudCat.isDefault,
            sortOrder: cloudCat.sortOrder,
            updatedAt: cloudCat.updatedAt,
          })
          localByName.syncId = syncId
          localCatBySyncId.set(syncId, localByName)
        } else {
          await dbAddCategory({
            syncId,
            name: cloudCat.name,
            color: cloudCat.color,
            icon: cloudCat.icon,
            isDefault: cloudCat.isDefault,
            sortOrder: cloudCat.sortOrder,
            createdAt: cloudCat.createdAt,
            updatedAt: cloudCat.updatedAt,
          })
        }
      }
    }

    // Local-only categories → Cloud
    for (const localCat of localCategories) {
      if (localCat.syncId && !cloudCatMap.has(localCat.syncId)) {
        await pushCategory(localCat)
      } else if (!localCat.syncId) {
        const syncId = generateSyncId()
        await db.categories.update(localCat.id!, { syncId, updatedAt: localCat.createdAt })
        localCat.syncId = syncId
        localCat.updatedAt = localCat.createdAt
        await pushCategory(localCat)
      }
    }

    // Refresh categories to have latest syncIds
    await getAllCategories()

    // 2. Merge tasks
    const cloudTaskMap = new Map<string, FirestoreTask & { syncId: string }>()
    cloudTasksSnap.forEach((d) => {
      cloudTaskMap.set(d.id, { ...(d.data() as FirestoreTask), syncId: d.id })
    })

    const localTaskBySyncId = new Map(
      localTasks.filter((t) => t.syncId).map((t) => [t.syncId!, t])
    )

    // Cloud → Local (tasks)
    for (const [syncId, cloudTask] of cloudTaskMap) {
      const localTask = localTaskBySyncId.get(syncId)
      if (localTask) {
        if (cloudTask.updatedAt > localTask.updatedAt) {
          const categoryId = await resolveCategorySyncId(cloudTask.categorySyncId)
          await dbUpdateTask(localTask.id!, {
            title: cloudTask.title,
            categoryId,
            status: cloudTask.status as Task['status'],
            priority: cloudTask.priority as Task['priority'],
            isFlagged: cloudTask.isFlagged,
            isStarred: cloudTask.isStarred,
            dueDate: cloudTask.dueDate,
            dueTime: cloudTask.dueTime,
            alarm: cloudTask.alarm as unknown as Task['alarm'],
            repeat: cloudTask.repeat as unknown as Task['repeat'],
            memo: cloudTask.memo,
            subtasks: cloudTask.subtasks as unknown as Task['subtasks'],
            completedAt: cloudTask.completedAt,
            sortOrder: cloudTask.sortOrder,
          })
        } else if (localTask.updatedAt > cloudTask.updatedAt) {
          await pushTask(localTask)
        }
      } else {
        const categoryId = await resolveCategorySyncId(cloudTask.categorySyncId)
        await dbAddTask({
          syncId,
          title: cloudTask.title,
          categoryId,
          status: cloudTask.status as Task['status'],
          priority: cloudTask.priority as Task['priority'],
          isFlagged: cloudTask.isFlagged,
          isStarred: cloudTask.isStarred,
          dueDate: cloudTask.dueDate,
          dueTime: cloudTask.dueTime,
          alarm: cloudTask.alarm as Task['alarm'],
          repeat: cloudTask.repeat as Task['repeat'],
          memo: cloudTask.memo,
          subtasks: cloudTask.subtasks as Task['subtasks'],
          completedAt: cloudTask.completedAt,
          createdAt: cloudTask.createdAt,
          updatedAt: cloudTask.updatedAt,
          sortOrder: cloudTask.sortOrder,
        })
      }
    }

    // Local-only tasks → Cloud
    for (const localTask of localTasks) {
      if (localTask.syncId && !cloudTaskMap.has(localTask.syncId)) {
        await pushTask(localTask)
      } else if (!localTask.syncId) {
        const syncId = generateSyncId()
        await db.tasks.update(localTask.id!, { syncId })
        localTask.syncId = syncId
        await pushTask(localTask)
      }
    }

    // 3. Merge completion logs (append-only union)
    const cloudLogSyncIds = new Set<string>()
    const cloudLogs: (FirestoreCompletionLog & { syncId: string })[] = []
    cloudLogsSnap.forEach((d) => {
      cloudLogSyncIds.add(d.id)
      cloudLogs.push({ ...(d.data() as FirestoreCompletionLog), syncId: d.id })
    })

    const localLogSyncIds = new Set(localLogs.filter((l) => l.syncId).map((l) => l.syncId!))

    for (const cloudLog of cloudLogs) {
      if (!localLogSyncIds.has(cloudLog.syncId)) {
        const task = await getTaskBySyncId(cloudLog.taskSyncId)
        if (task) {
          await dbAddCompletionLog({
            syncId: cloudLog.syncId,
            taskId: task.id!,
            completedAt: cloudLog.completedAt,
            date: cloudLog.date,
          })
        }
      }
    }

    for (const localLog of localLogs) {
      if (localLog.syncId && !cloudLogSyncIds.has(localLog.syncId)) {
        const task = await db.tasks.get(localLog.taskId)
        if (task?.syncId) {
          await pushCompletionLog(localLog, task.syncId)
        }
      } else if (!localLog.syncId) {
        const syncId = generateSyncId()
        await db.completionLogs.update(localLog.id!, { syncId })
        localLog.syncId = syncId
        const task = await db.tasks.get(localLog.taskId)
        if (task?.syncId) {
          await pushCompletionLog(localLog, task.syncId)
        }
      }
    }

    // Refresh stores
    await refreshTasksFn?.()
    await refreshCategoriesFn?.()
  } finally {
    mergeInProgress = false
  }
}

// ─── Real-time Listeners ────────────────────────────

function startListeners(userId: string): void {
  unsubTasks = onSnapshot(
    collection(firestore, `users/${userId}/tasks`),
    (snapshot) => {
      if (mergeInProgress) return
      handleTaskChanges(snapshot.docChanges())
    }
  )

  unsubCategories = onSnapshot(
    collection(firestore, `users/${userId}/categories`),
    (snapshot) => {
      if (mergeInProgress) return
      handleCategoryChanges(snapshot.docChanges())
    }
  )

  unsubLogs = onSnapshot(
    collection(firestore, `users/${userId}/completionLogs`),
    (snapshot) => {
      if (mergeInProgress) return
      handleLogChanges(snapshot.docChanges())
    }
  )
}

async function handleTaskChanges(changes: DocumentChange<DocumentData>[]): Promise<void> {
  let needsRefresh = false

  for (const change of changes) {
    const syncId = change.doc.id
    if (recentlyPushed.has(syncId)) continue

    const cloudTask = change.doc.data() as FirestoreTask

    if (change.type === 'added' || change.type === 'modified') {
      const localTask = await getTaskBySyncId(syncId)
      if (localTask) {
        const categoryId = await resolveCategorySyncId(cloudTask.categorySyncId)
        const cloudData: Partial<Task> = {
          title: cloudTask.title,
          categoryId,
          status: cloudTask.status as Task['status'],
          priority: cloudTask.priority as Task['priority'],
          isFlagged: cloudTask.isFlagged,
          isStarred: cloudTask.isStarred,
          dueDate: cloudTask.dueDate,
          dueTime: cloudTask.dueTime,
          memo: cloudTask.memo,
          completedAt: cloudTask.completedAt,
          sortOrder: cloudTask.sortOrder,
        }

        if (cloudTask.updatedAt > localTask.updatedAt) {
          // Cloud is newer — apply all cloud changes
          await dbUpdateTask(localTask.id!, {
            ...cloudData,
            alarm: cloudTask.alarm as unknown as Task['alarm'],
            repeat: cloudTask.repeat as unknown as Task['repeat'],
            subtasks: cloudTask.subtasks as unknown as Task['subtasks'],
          })
          needsRefresh = true
        } else if (cloudTask.updatedAt !== localTask.updatedAt) {
          // Both sides changed — detect field-level conflicts
          const result = detectConflicts(localTask, cloudData)
          if (result.hasConflicts) {
            // Queue for manual resolution
            useSyncConflictStore.getState().addConflict({
              id: crypto.randomUUID(),
              taskId: localTask.id!,
              taskTitle: localTask.title,
              localTask,
              cloudData,
              conflictResult: result,
            })
          }
          // Apply auto-merged fields
          if (Object.keys(result.autoMerged).length > 0) {
            await dbUpdateTask(localTask.id!, result.autoMerged)
            needsRefresh = true
          }
        }
      } else {
        const categoryId = await resolveCategorySyncId(cloudTask.categorySyncId)
        await dbAddTask({
          syncId,
          title: cloudTask.title,
          categoryId,
          status: cloudTask.status as Task['status'],
          priority: cloudTask.priority as Task['priority'],
          isFlagged: cloudTask.isFlagged,
          isStarred: cloudTask.isStarred,
          dueDate: cloudTask.dueDate,
          dueTime: cloudTask.dueTime,
          alarm: cloudTask.alarm as Task['alarm'],
          repeat: cloudTask.repeat as Task['repeat'],
          memo: cloudTask.memo,
          subtasks: cloudTask.subtasks as Task['subtasks'],
          completedAt: cloudTask.completedAt,
          createdAt: cloudTask.createdAt,
          updatedAt: cloudTask.updatedAt,
          sortOrder: cloudTask.sortOrder,
        })
        needsRefresh = true
      }
    } else if (change.type === 'removed') {
      const localTask = await getTaskBySyncId(syncId)
      if (localTask) {
        await dbDeleteTask(localTask.id!)
        needsRefresh = true
      }
    }
  }

  if (needsRefresh) await refreshTasksFn?.()
}

async function handleCategoryChanges(changes: DocumentChange<DocumentData>[]): Promise<void> {
  let needsRefresh = false

  for (const change of changes) {
    const syncId = change.doc.id
    if (recentlyPushed.has(syncId)) continue

    const cloudCat = change.doc.data() as FirestoreCategory

    if (change.type === 'added' || change.type === 'modified') {
      const localCat = await getCategoryBySyncId(syncId)
      if (localCat) {
        const localUpdated = localCat.updatedAt || localCat.createdAt
        if (cloudCat.updatedAt > localUpdated) {
          await dbUpdateCategory(localCat.id!, {
            name: cloudCat.name,
            color: cloudCat.color,
            icon: cloudCat.icon,
            isDefault: cloudCat.isDefault,
            sortOrder: cloudCat.sortOrder,
            updatedAt: cloudCat.updatedAt,
          })
          needsRefresh = true
        }
      } else {
        await dbAddCategory({
          syncId,
          name: cloudCat.name,
          color: cloudCat.color,
          icon: cloudCat.icon,
          isDefault: cloudCat.isDefault,
          sortOrder: cloudCat.sortOrder,
          createdAt: cloudCat.createdAt,
          updatedAt: cloudCat.updatedAt,
        })
        needsRefresh = true
      }
    } else if (change.type === 'removed') {
      const localCat = await getCategoryBySyncId(syncId)
      if (localCat) {
        await dbDeleteCategory(localCat.id!)
        needsRefresh = true
      }
    }
  }

  if (needsRefresh) await refreshCategoriesFn?.()
}

async function handleLogChanges(changes: DocumentChange<DocumentData>[]): Promise<void> {
  for (const change of changes) {
    const syncId = change.doc.id
    if (recentlyPushed.has(syncId)) continue

    if (change.type === 'added') {
      const existing = await getCompletionLogBySyncId(syncId)
      if (!existing) {
        const cloudLog = change.doc.data() as FirestoreCompletionLog
        const task = await getTaskBySyncId(cloudLog.taskSyncId)
        if (task) {
          await dbAddCompletionLog({
            syncId,
            taskId: task.id!,
            completedAt: cloudLog.completedAt,
            date: cloudLog.date,
          })
        }
      }
    }
  }
}

// ─── Public API ─────────────────────────────────────

export async function initSync(userId: string): Promise<void> {
  if (currentUserId === userId) return
  stopSync()
  currentUserId = userId
  await initialMerge(userId)
  startListeners(userId)
}

export function stopSync(): void {
  unsubTasks?.()
  unsubCategories?.()
  unsubLogs?.()
  unsubTasks = null
  unsubCategories = null
  unsubLogs = null
  currentUserId = null
}

export function isSyncActive(): boolean {
  return currentUserId !== null
}
