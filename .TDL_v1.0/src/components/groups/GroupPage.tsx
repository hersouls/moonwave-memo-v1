import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Sparkles, FolderKanban, Trash2, Pencil } from 'lucide-react'
import { clsx } from 'clsx'
import { PageContainer, PageHeader, EmptyState } from '@/components/layout/PageContainer'
import { useGroupStore } from '@/stores/groupStore'
import { useTaskStore } from '@/stores/taskStore'
import { useCategoryStore } from '@/stores/categoryStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { suggestTaskGroups } from '@/services/aiService'
import { GroupCreateModal } from './GroupCreateModal'
import { AISuggestModal } from './AISuggestModal'
import type { SuggestedGroup } from '@/lib/types'

export function GroupPage() {
  const navigate = useNavigate()
  const groups = useGroupStore((s) => s.groups)
  const addGroup = useGroupStore((s) => s.addGroup)
  const deleteGroup = useGroupStore((s) => s.deleteGroup)
  const updateGroup = useGroupStore((s) => s.updateGroup)
  const setTaskIds = useGroupStore((s) => s.setTaskIds)
  const tasks = useTaskStore((s) => s.tasks)
  const categories = useCategoryStore((s) => s.categories)
  const aiEnabled = useSettingsStore((s) => s.settings.aiEnabled)

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editGroup, setEditGroup] = useState<{ name: string; color: string; description?: string; id: number } | null>(null)
  const [showAIModal, setShowAIModal] = useState(false)
  const [aiSuggestions, setAiSuggestions] = useState<SuggestedGroup[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string>()

  const taskTitles = useMemo(() => {
    const map: Record<number, string> = {}
    tasks.forEach((t) => { if (t.id) map[t.id] = t.title })
    return map
  }, [tasks])

  const getGroupProgress = (taskIds: number[]) => {
    if (taskIds.length === 0) return { total: 0, completed: 0, percent: 0 }
    const groupTasks = tasks.filter((t) => taskIds.includes(t.id!))
    const completed = groupTasks.filter((t) => t.status === 'completed').length
    return {
      total: groupTasks.length,
      completed,
      percent: groupTasks.length > 0 ? Math.round((completed / groupTasks.length) * 100) : 0,
    }
  }

  const handleAISuggest = async () => {
    setShowAIModal(true)
    setAiLoading(true)
    setAiError(undefined)
    setAiSuggestions([])

    try {
      const apiKey = await useSettingsStore.getState().getDecryptedApiKey()
      if (!apiKey) {
        setAiError('AI API 키가 설정되지 않았습니다. 설정에서 API 키를 입력해주세요.')
        return
      }
      const taskData = tasks.map((t) => ({
        id: t.id!,
        title: t.title,
        categoryName: categories.find((c) => c.id === t.categoryId)?.name,
        dueDate: t.dueDate,
        memo: t.memo,
      }))
      const suggestions = await suggestTaskGroups(apiKey, taskData)
      setAiSuggestions(suggestions)
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'AI 요청 중 오류가 발생했습니다.')
    } finally {
      setAiLoading(false)
    }
  }

  const handleAcceptSuggestions = async (accepted: SuggestedGroup[]) => {
    for (const group of accepted) {
      const created = await addGroup(group.name, group.color, group.description)
      if (created.id) {
        await setTaskIds(created.id, group.taskIds)
      }
    }
  }

  const handleDelete = (id: number) => {
    if (window.confirm('이 그룹을 삭제하시겠습니까? 할일은 삭제되지 않습니다.')) {
      deleteGroup(id)
    }
  }

  const handleEdit = (g: typeof groups[0]) => {
    setEditGroup({ id: g.id!, name: g.name, color: g.color, description: g.description })
  }

  const handleEditSave = (name: string, color: string, description?: string) => {
    if (editGroup) {
      updateGroup(editGroup.id, { name, color, description })
      setEditGroup(null)
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="그룹"
        description="관련 작업을 그룹으로 묶어 프로젝트를 관리하세요"
        action={
          <div className="flex items-center gap-2">
            {aiEnabled && (
              <button
                onClick={handleAISuggest}
                disabled={tasks.length < 3}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/30 rounded-lg transition-colors disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                <span className="hidden sm:inline">AI 분류</span>
              </button>
            )}
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">새 그룹</span>
            </button>
          </div>
        }
      />

      {groups.length === 0 ? (
        <EmptyState
          icon={<FolderKanban className="w-8 h-8" />}
          title="아직 그룹이 없습니다"
          description="새 그룹을 만들어 관련 작업을 묶어보세요"
          action={
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors"
            >
              첫 그룹 만들기
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => {
            const progress = getGroupProgress(group.taskIds)
            return (
              <div
                key={group.id}
                onClick={() => navigate(`/groups/${group.id}`)}
                className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-sm transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: group.color }}
                    />
                    <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 truncate">
                      {group.icon && <span className="mr-1">{group.icon}</span>}
                      {group.name}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleEdit(group) }}
                      className="p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(group.id!) }}
                      className="p-1 rounded text-zinc-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {group.description && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3 line-clamp-2">
                    {group.description}
                  </p>
                )}

                {/* Progress bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-500 dark:text-zinc-400">
                      {progress.completed}/{progress.total} 완료
                    </span>
                    <span
                      className={clsx(
                        'font-semibold',
                        progress.percent === 100 ? 'text-green-500' : 'text-primary-500'
                      )}
                    >
                      {progress.percent}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                    <div
                      className={clsx(
                        'h-full rounded-full transition-all duration-500',
                        progress.percent === 100 ? 'bg-green-500' : 'bg-primary-500'
                      )}
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modals */}
      <GroupCreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSave={(name, color, desc) => addGroup(name, color, desc)}
      />

      {editGroup && (
        <GroupCreateModal
          isOpen={true}
          onClose={() => setEditGroup(null)}
          onSave={handleEditSave}
          initialData={editGroup}
        />
      )}

      <AISuggestModal
        isOpen={showAIModal}
        onClose={() => setShowAIModal(false)}
        suggestions={aiSuggestions}
        isLoading={aiLoading}
        error={aiError}
        onAccept={handleAcceptSuggestions}
        taskTitles={taskTitles}
      />
    </PageContainer>
  )
}
