import { useState } from 'react'
import { Sparkles, Check, X } from 'lucide-react'
import { Dialog, DialogHeader } from '@/components/ui/Dialog'
import type { SuggestedGroup } from '@/lib/types'

interface AISuggestModalProps {
  isOpen: boolean
  onClose: () => void
  suggestions: SuggestedGroup[]
  isLoading: boolean
  error?: string
  onAccept: (groups: SuggestedGroup[]) => void
  taskTitles: Record<number, string>
}

export function AISuggestModal({
  isOpen,
  onClose,
  suggestions,
  isLoading,
  error,
  onAccept,
  taskTitles,
}: AISuggestModalProps) {
  const [accepted, setAccepted] = useState<Set<number>>(new Set(suggestions.map((_, i) => i)))

  const toggleGroup = (index: number) => {
    setAccepted((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const handleAccept = () => {
    const selectedGroups = suggestions.filter((_, i) => accepted.has(i))
    onAccept(selectedGroups)
    onClose()
  }

  return (
    <Dialog open={isOpen} onClose={onClose}>
      <DialogHeader title="AI 자동 그룹 분류" onClose={onClose} />
      <div className="space-y-4 mt-6">
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="relative">
              <Sparkles className="w-8 h-8 text-primary-500 animate-pulse" />
            </div>
            <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
              AI가 할일을 분석하고 있습니다...
            </p>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {!isLoading && !error && suggestions.length > 0 && (
          <>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              AI가 {suggestions.length}개의 그룹을 제안합니다. 원하는 그룹을 선택하세요.
            </p>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {suggestions.map((group, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    accepted.has(index)
                      ? 'border-primary-300 dark:border-primary-700 bg-primary-50/50 dark:bg-primary-900/10'
                      : 'border-zinc-200 dark:border-zinc-800 opacity-60'
                  }`}
                  onClick={() => toggleGroup(index)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: group.color }}
                        />
                        <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
                          {group.name}
                        </span>
                      </div>
                      {group.description && (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                          {group.description}
                        </p>
                      )}
                      <p className="text-xs text-primary-600 dark:text-primary-400 mt-1.5 italic">
                        {group.reason}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      {accepted.has(index) ? (
                        <Check className="w-5 h-5 text-primary-500" />
                      ) : (
                        <X className="w-5 h-5 text-zinc-300 dark:text-zinc-600" />
                      )}
                    </div>
                  </div>

                  {/* Task list preview */}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {group.taskIds.slice(0, 5).map((id) => (
                      <span
                        key={id}
                        className="inline-block px-2 py-0.5 rounded text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 truncate max-w-[140px]"
                      >
                        {taskTitles[id] || `#${id}`}
                      </span>
                    ))}
                    {group.taskIds.length > 5 && (
                      <span className="text-[10px] text-zinc-400">+{group.taskIds.length - 5}개</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleAccept}
                disabled={accepted.size === 0}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 disabled:opacity-50 rounded-lg transition-colors"
              >
                {accepted.size}개 그룹 생성
              </button>
            </div>
          </>
        )}

        {!isLoading && !error && suggestions.length === 0 && (
          <p className="text-center text-sm text-zinc-400 py-8">
            그룹핑할 할일이 충분하지 않습니다.
          </p>
        )}
      </div>
    </Dialog>
  )
}
