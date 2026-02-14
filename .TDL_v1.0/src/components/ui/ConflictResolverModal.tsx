import { useState } from 'react'
import { AlertTriangle, Check } from 'lucide-react'
import { Dialog, DialogHeader, DialogBody } from './Dialog'
import { useSyncConflictStore, type PendingConflict } from '@/stores/syncConflictStore'
import { resolveConflicts } from '@/lib/syncConflict'
import type { FieldConflict } from '@/lib/syncConflict'
import { updateTask as dbUpdateTask } from '@/services/database'
import { useTaskStore } from '@/stores/taskStore'

const FIELD_LABELS: Record<string, string> = {
  title: '제목',
  status: '상태',
  priority: '우선순위',
  isFlagged: '깃발',
  isStarred: '별표',
  dueDate: '마감일',
  dueTime: '시간',
  memo: '메모',
  sortOrder: '순서',
  completedAt: '완료일',
  categoryId: '카테고리',
}

function formatValue(value: unknown): string {
  if (value === undefined || value === null) return '(없음)'
  if (typeof value === 'boolean') return value ? '예' : '아니요'
  return String(value)
}

function ConflictItem({
  conflict,
  onResolve,
}: {
  conflict: PendingConflict
  onResolve: (id: string, choices: Map<string, 'local' | 'cloud'>) => void
}) {
  const [choices, setChoices] = useState<Map<string, 'local' | 'cloud'>>(new Map())

  const handleChoice = (field: string, choice: 'local' | 'cloud') => {
    setChoices((prev) => {
      const next = new Map(prev)
      next.set(field, choice)
      return next
    })
  }

  const allResolved = conflict.conflictResult.conflicts.every((c) =>
    choices.has(c.field),
  )

  return (
    <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-500" />
        <h3 className="font-medium text-zinc-900 dark:text-zinc-100 text-sm">
          {conflict.taskTitle}
        </h3>
      </div>

      {/* Auto-merged fields info */}
      {Object.keys(conflict.conflictResult.autoMerged).length > 0 && (
        <p className="text-xs text-zinc-400">
          자동 병합됨:{' '}
          {Object.keys(conflict.conflictResult.autoMerged)
            .map((f) => FIELD_LABELS[f] || f)
            .join(', ')}
        </p>
      )}

      {/* Conflict fields */}
      <div className="space-y-2">
        {conflict.conflictResult.conflicts.map((c: FieldConflict) => (
          <div key={c.field} className="text-sm">
            <span className="font-medium text-zinc-600 dark:text-zinc-400">
              {FIELD_LABELS[c.field] || c.field}
            </span>
            <div className="flex gap-2 mt-1">
              <button
                type="button"
                onClick={() => handleChoice(c.field, 'local')}
                className={`flex-1 px-3 py-2 rounded-lg text-xs border transition-colors ${
                  choices.get(c.field) === 'local'
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                    : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300'
                }`}
              >
                <span className="block text-[10px] text-zinc-400 mb-0.5">
                  내 기기
                </span>
                {formatValue(c.localValue)}
              </button>
              <button
                type="button"
                onClick={() => handleChoice(c.field, 'cloud')}
                className={`flex-1 px-3 py-2 rounded-lg text-xs border transition-colors ${
                  choices.get(c.field) === 'cloud'
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                    : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300'
                }`}
              >
                <span className="block text-[10px] text-zinc-400 mb-0.5">
                  클라우드
                </span>
                {formatValue(c.cloudValue)}
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        disabled={!allResolved}
        onClick={() => onResolve(conflict.id, choices)}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <Check className="w-4 h-4" />
        적용
      </button>
    </div>
  )
}

export function ConflictResolverModal() {
  const isOpen = useSyncConflictStore((s) => s.isResolverOpen)
  const conflicts = useSyncConflictStore((s) => s.pendingConflicts)
  const removeConflict = useSyncConflictStore((s) => s.removeConflict)
  const closeResolver = useSyncConflictStore((s) => s.closeResolver)
  const refreshFromDb = useTaskStore((s) => s.refreshFromDb)

  const handleResolve = async (
    conflictId: string,
    choices: Map<string, 'local' | 'cloud'>,
  ) => {
    const conflict = conflicts.find((c) => c.id === conflictId)
    if (!conflict) return

    const merged = resolveConflicts(
      conflict.conflictResult.conflicts,
      choices as Map<any, 'local' | 'cloud'>,
      conflict.conflictResult.autoMerged,
    )

    // Apply merged changes to local DB
    if (Object.keys(merged).length > 0) {
      await dbUpdateTask(conflict.taskId, {
        ...merged,
        updatedAt: new Date().toISOString(),
      })
    }

    removeConflict(conflictId)
    await refreshFromDb()
  }

  if (conflicts.length === 0) return null

  return (
    <Dialog
      open={isOpen}
      onClose={closeResolver}
    >
      <DialogHeader title="동기화 충돌" onClose={closeResolver} />
      <DialogBody>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            다른 기기에서 변경된 내용과 충돌이 발생했습니다. 각 항목에서 유지할 값을 선택해주세요.
          </p>

          {conflicts.map((conflict) => (
            <ConflictItem
              key={conflict.id}
              conflict={conflict}
              onResolve={handleResolve}
            />
          ))}
        </div>
      </DialogBody>
    </Dialog>
  )
}
