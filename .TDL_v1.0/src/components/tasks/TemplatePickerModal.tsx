import { useState } from 'react'
import { X, LayoutTemplate, Trash2 } from 'lucide-react'
import { useTemplateStore } from '@/stores/templateStore'
import type { TaskTemplate, TaskPriority, RepeatPattern } from '@/lib/types'

interface TemplateData {
  title: string
  categoryId: number | null
  priority: TaskPriority
  subtasks: { title: string; sortOrder: number }[]
  repeat: RepeatPattern
  memo?: string
}

interface TemplatePickerModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (data: TemplateData) => void
}

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  none: '없음',
  low: '낮음',
  medium: '중간',
  high: '높음',
}

export function TemplatePickerModal({ isOpen, onClose, onSelect }: TemplatePickerModalProps) {
  const templates = useTemplateStore((s) => s.templates)
  const getBuiltInTemplates = useTemplateStore((s) => s.getBuiltInTemplates)
  const deleteTemplate = useTemplateStore((s) => s.deleteTemplate)
  const [activeTab, setActiveTab] = useState<'builtin' | 'custom'>('builtin')

  if (!isOpen) return null

  const builtInTemplates = getBuiltInTemplates()
  const customTemplates = templates.filter((t) => !t.isBuiltIn)

  const handleSelect = (template: Omit<TaskTemplate, 'id'> | TaskTemplate) => {
    onSelect({
      title: template.name,
      categoryId: template.categoryId,
      priority: template.priority,
      subtasks: template.subtasks,
      repeat: template.repeat,
      memo: template.memo,
    })
    onClose()
  }

  const renderTemplate = (template: Omit<TaskTemplate, 'id'> | TaskTemplate, index: number) => {
    const hasId = 'id' in template && template.id != null
    return (
      <button
        key={hasId ? template.id : `builtin-${index}`}
        type="button"
        onClick={() => handleSelect(template)}
        className="w-full text-left p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:border-primary-300 dark:hover:border-primary-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors group"
      >
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{template.name}</h4>
            {template.description && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{template.description}</p>
            )}
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400">
                하위 작업 {template.subtasks.length}개
              </span>
              {template.priority !== 'none' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400">
                  {PRIORITY_LABELS[template.priority]}
                </span>
              )}
            </div>
          </div>
          {hasId && !template.isBuiltIn && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                deleteTemplate((template as TaskTemplate).id!)
              }}
              className="p-1 rounded opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-red-500 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md max-h-[80dvh] pb-[env(safe-area-inset-bottom,0px)] sm:pb-0 bg-white dark:bg-zinc-900 rounded-t-2xl sm:rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <LayoutTemplate className="w-5 h-5 text-primary-500" />
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">템플릿 선택</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => setActiveTab('builtin')}
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'builtin'
                ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-500'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            기본 템플릿
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('custom')}
            className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'custom'
                ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-500'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            내 템플릿 ({customTemplates.length})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {activeTab === 'builtin' ? (
            builtInTemplates.map((t, i) => renderTemplate(t, i))
          ) : customTemplates.length > 0 ? (
            customTemplates.map((t, i) => renderTemplate(t, i))
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-zinc-400">
              <LayoutTemplate className="w-10 h-10 mb-2 opacity-50" />
              <p className="text-sm">저장된 템플릿이 없습니다</p>
              <p className="text-xs mt-1">작업 상세에서 "템플릿으로 저장"을 사용하세요</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
