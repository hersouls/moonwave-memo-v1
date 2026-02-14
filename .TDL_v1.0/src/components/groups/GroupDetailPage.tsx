import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Sparkles, X } from 'lucide-react'
import { clsx } from 'clsx'
import { PageContainer } from '@/components/layout/PageContainer'
import { Checkbox } from '@/components/ui/Checkbox'
import { useGroupStore } from '@/stores/groupStore'
import { useTaskStore } from '@/stores/taskStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { suggestNextSteps, type NextStepsSuggestion } from '@/services/aiService'
import { formatDueDate } from '@/lib/dateUtils'
import { TaskPickerModal } from './TaskPickerModal'

export function GroupDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const group = useGroupStore((s) => s.groups.find((g) => g.id === Number(id)))
  const removeTaskFromGroup = useGroupStore((s) => s.removeTaskFromGroup)
  const setTaskIds = useGroupStore((s) => s.setTaskIds)
  const tasks = useTaskStore((s) => s.tasks)
  const toggleComplete = useTaskStore((s) => s.toggleComplete)
  const aiEnabled = useSettingsStore((s) => s.settings.aiEnabled)

  const [showPicker, setShowPicker] = useState(false)
  const [aiSuggestion, setAiSuggestion] = useState<NextStepsSuggestion | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  const groupTasks = useMemo(() => {
    if (!group) return []
    return group.taskIds
      .map((id) => tasks.find((t) => t.id === id))
      .filter(Boolean)
      .sort((a, b) => {
        if (a!.status === 'pending' && b!.status === 'completed') return -1
        if (a!.status === 'completed' && b!.status === 'pending') return 1
        return 0
      }) as typeof tasks
  }, [group, tasks])

  const progress = useMemo(() => {
    if (groupTasks.length === 0) return { total: 0, completed: 0, percent: 0 }
    const completed = groupTasks.filter((t) => t.status === 'completed').length
    return {
      total: groupTasks.length,
      completed,
      percent: Math.round((completed / groupTasks.length) * 100),
    }
  }, [groupTasks])

  const handleAISuggest = async () => {
    if (!group) return
    setAiLoading(true)
    try {
      const apiKey = await useSettingsStore.getState().getDecryptedApiKey()
      if (!apiKey) return
      const result = await suggestNextSteps(
        apiKey,
        group.name,
        groupTasks.map((t) => ({
          title: t.title,
          status: t.status,
          dueDate: t.dueDate,
        }))
      )
      setAiSuggestion(result)
    } catch {
      // silently fail
    } finally {
      setAiLoading(false)
    }
  }

  if (!group) {
    return (
      <PageContainer>
        <div className="text-center py-12">
          <p className="text-zinc-500">그룹을 찾을 수 없습니다.</p>
          <button onClick={() => navigate('/groups')} className="mt-4 text-primary-500 text-sm">
            그룹 목록으로 돌아가기
          </button>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/groups')}
          className="flex items-center gap-1 text-sm text-zinc-500 dark:text-zinc-400 hover:text-primary-500 mb-3 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          그룹 목록
        </button>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className="w-4 h-4 rounded-full flex-shrink-0"
              style={{ backgroundColor: group.color }}
            />
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              {group.icon && <span className="mr-1">{group.icon}</span>}
              {group.name}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {aiEnabled && groupTasks.length > 0 && (
              <button
                onClick={handleAISuggest}
                disabled={aiLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/30 rounded-lg transition-colors disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                AI 추천
              </button>
            )}
            <button
              onClick={() => setShowPicker(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              할일 추가
            </button>
          </div>
        </div>

        {group.description && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">{group.description}</p>
        )}
      </div>

      {/* Progress */}
      <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">전체 진행률</span>
          <span
            className={clsx(
              'text-2xl font-bold',
              progress.percent === 100 ? 'text-green-500' : 'text-primary-500'
            )}
          >
            {progress.percent}%
          </span>
        </div>
        <div className="h-3 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
          <div
            className={clsx(
              'h-full rounded-full transition-all duration-500',
              progress.percent === 100 ? 'bg-green-500' : 'bg-primary-500'
            )}
            style={{ width: `${progress.percent}%` }}
          />
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
          {progress.total}개 작업 중 {progress.completed}개 완료
        </p>
      </div>

      {/* AI Suggestion */}
      {aiSuggestion && (
        <div className="p-4 rounded-xl bg-primary-50 dark:bg-primary-900/10 border border-primary-200 dark:border-primary-800 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-primary-500" />
              <span className="text-sm font-medium text-primary-700 dark:text-primary-300">AI 추천</span>
            </div>
            <button onClick={() => setAiSuggestion(null)} className="text-zinc-400 hover:text-zinc-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-sm text-zinc-700 dark:text-zinc-300 mb-3">{aiSuggestion.summary}</p>
          <div className="space-y-1.5">
            {aiSuggestion.nextSteps.map((step, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-xs text-primary-500 font-bold mt-0.5">{i + 1}.</span>
                <span className="text-sm text-zinc-600 dark:text-zinc-400">{step}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-primary-600 dark:text-primary-400 mt-3 italic">
            💡 {aiSuggestion.tip}
          </p>
        </div>
      )}

      {/* Task List */}
      <div className="space-y-2">
        {groupTasks.length === 0 ? (
          <div className="text-center py-12 text-zinc-400 dark:text-zinc-500">
            <p className="text-sm">아직 할일이 없습니다.</p>
            <button
              onClick={() => setShowPicker(true)}
              className="mt-2 text-sm text-primary-500 hover:underline"
            >
              할일 추가하기
            </button>
          </div>
        ) : (
          groupTasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-primary-300 dark:hover:border-primary-700 transition-all"
            >
              <Checkbox
                checked={task.status === 'completed'}
                onChange={() => toggleComplete(task.id!)}
              />
              <div
                className="flex-1 min-w-0 cursor-pointer"
                onClick={() => navigate(`/task/${task.id}`)}
              >
                <span
                  className={clsx(
                    'text-sm font-medium block truncate',
                    task.status === 'completed'
                      ? 'line-through text-zinc-400 dark:text-zinc-500'
                      : 'text-zinc-900 dark:text-zinc-100'
                  )}
                >
                  {task.title}
                </span>
                {task.dueDate && (
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">
                    {formatDueDate(task.dueDate)}
                  </span>
                )}
              </div>
              <button
                onClick={() => removeTaskFromGroup(group.id!, task.id!)}
                className="p-1 rounded text-zinc-400 hover:text-red-500 transition-colors flex-shrink-0"
                title="그룹에서 제거"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Task Picker Modal */}
      <TaskPickerModal
        isOpen={showPicker}
        onClose={() => setShowPicker(false)}
        selectedTaskIds={group.taskIds}
        onSave={(taskIds) => setTaskIds(group.id!, taskIds)}
      />
    </PageContainer>
  )
}
