import type { Task } from './types'

/** Fields that can be individually merged */
const MERGEABLE_FIELDS = [
  'title',
  'status',
  'priority',
  'isFlagged',
  'isStarred',
  'dueDate',
  'dueTime',
  'memo',
  'sortOrder',
  'completedAt',
  'categoryId',
] as const

type MergeableField = (typeof MERGEABLE_FIELDS)[number]

export interface FieldConflict {
  field: MergeableField
  localValue: unknown
  cloudValue: unknown
}

export interface ConflictResult {
  /** Fields that can be auto-merged (no conflict) */
  autoMerged: Partial<Task>
  /** Fields where both sides changed differently */
  conflicts: FieldConflict[]
  /** True if there are unresolvable conflicts requiring user input */
  hasConflicts: boolean
}

/**
 * Detect field-level conflicts between local and cloud versions of a task.
 * `base` is the last known synced version (before either side changed).
 * If no base is available, falls back to last-write-wins.
 */
export function detectConflicts(
  local: Task,
  cloud: Partial<Task>,
  base?: Partial<Task>,
): ConflictResult {
  const autoMerged: Partial<Task> = {}
  const conflicts: FieldConflict[] = []

  for (const field of MERGEABLE_FIELDS) {
    const localVal = local[field]
    const cloudVal = cloud[field]

    // Skip if cloud doesn't have this field
    if (cloudVal === undefined) continue

    // Same value → no conflict
    if (JSON.stringify(localVal) === JSON.stringify(cloudVal)) continue

    if (base) {
      const baseVal = base[field]
      const localChanged = JSON.stringify(localVal) !== JSON.stringify(baseVal)
      const cloudChanged = JSON.stringify(cloudVal) !== JSON.stringify(baseVal)

      if (localChanged && cloudChanged) {
        // Both sides changed the same field → conflict
        conflicts.push({ field, localValue: localVal, cloudValue: cloudVal })
      } else if (cloudChanged && !localChanged) {
        // Only cloud changed → accept cloud
        ;(autoMerged as Record<string, unknown>)[field] = cloudVal
      }
      // Only local changed → keep local (no action needed)
    } else {
      // No base available → conflict (can't determine who changed)
      conflicts.push({ field, localValue: localVal, cloudValue: cloudVal })
    }
  }

  return {
    autoMerged,
    conflicts,
    hasConflicts: conflicts.length > 0,
  }
}

/**
 * Apply user's conflict resolution choices.
 * Returns the final merged task update.
 */
export function resolveConflicts(
  conflicts: FieldConflict[],
  choices: Map<MergeableField, 'local' | 'cloud'>,
  autoMerged: Partial<Task>,
): Partial<Task> {
  const result = { ...autoMerged }

  for (const conflict of conflicts) {
    const choice = choices.get(conflict.field) ?? 'cloud'
    if (choice === 'cloud') {
      ;(result as Record<string, unknown>)[conflict.field] = conflict.cloudValue
    }
    // 'local' means keep current — don't override
  }

  return result
}
