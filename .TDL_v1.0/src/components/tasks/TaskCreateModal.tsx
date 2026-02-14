import { useEffect, useMemo, useRef, useState } from 'react'
import {
  X,
  LayoutTemplate,
  Sparkles,
  Loader2,
  Repeat,
  Paperclip,
  Plus,
  FileText,
  Image as ImageIcon,
  MoreVertical,
  Check,
  Copy,
  Trash2,
  FolderKanban,
} from 'lucide-react'
import { clsx } from 'clsx'
import { Button } from '@/components/ui/Button'
import { DatePicker } from '@/components/ui/DatePicker'
import { TemplatePickerModal } from './TemplatePickerModal'
import { useTaskStore } from '@/stores/taskStore'
import { useCategoryStore } from '@/stores/categoryStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useAttachmentStore } from '@/stores/attachmentStore'
import { useGroupStore } from '@/stores/groupStore'
import { parseTaskWithAI } from '@/services/aiService'
import { parseNaturalLanguage } from '@/lib/nlParser'
import type { Task, TaskPriority, RepeatType, Attachment } from '@/lib/types'

interface TaskCreateModalProps {
  isOpen: boolean
  onClose: () => void
  defaultDueDate?: string
  editTask?: Task | null
}

const priorityOptions: { value: TaskPriority; label: string }[] = [
  { value: 'none', label: '없음' },
  { value: 'low', label: '낮음' },
  { value: 'medium', label: '중간' },
  { value: 'high', label: '높음' },
]

const repeatOptions: { value: RepeatType; label: string }[] = [
  { value: 'daily', label: '매일' },
  { value: 'weekly', label: '주간' },
  { value: 'monthly', label: '월간' },
  { value: 'yearly', label: '매년' },
]

interface PendingFile {
  id: string
  file: File
  previewUrl?: string
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

function ExistingAttachmentItem({ attachment, onDelete }: {
  attachment: Attachment; onDelete: () => void
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    if (attachment.thumbnailData) {
      const url = URL.createObjectURL(attachment.thumbnailData)
      setPreviewUrl(url)
      return () => URL.revokeObjectURL(url)
    } else if (attachment.mimeType.startsWith('image/')) {
      const url = URL.createObjectURL(attachment.data)
      setPreviewUrl(url)
      return () => URL.revokeObjectURL(url)
    }
  }, [attachment.id, attachment.thumbnailData, attachment.data, attachment.mimeType])

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 group">
      {previewUrl ? (
        <img src={previewUrl} alt={attachment.filename} className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
      ) : (
        <div className="w-9 h-9 rounded-lg bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center flex-shrink-0">
          {attachment.mimeType.startsWith('image/') ? (
            <ImageIcon className="w-4 h-4 text-zinc-400" />
          ) : (
            <FileText className="w-4 h-4 text-zinc-400" />
          )}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate">{attachment.filename}</p>
        <p className="text-[10px] text-zinc-400">{formatFileSize(attachment.size)}</p>
      </div>
      <button
        type="button"
        onClick={onDelete}
        className="p-1 rounded text-zinc-400 hover:text-red-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

const EMPTY_ATTACHMENTS: Attachment[] = []

export function TaskCreateModal({ isOpen, onClose, defaultDueDate, editTask }: TaskCreateModalProps) {
  const addTask = useTaskStore((s) => s.addTask)
  const updateTask = useTaskStore((s) => s.updateTask)
  const toggleComplete = useTaskStore((s) => s.toggleComplete)
  const deleteTask = useTaskStore((s) => s.deleteTask)
  const categories = useCategoryStore((s) => s.categories)
  const aiEnabled = useSettingsStore((s) => s.settings.aiEnabled)
  const aiApiKey = useSettingsStore((s) => s.settings.aiApiKey)
  const getDecryptedApiKey = useSettingsStore((s) => s.getDecryptedApiKey)
  const addAttachment = useAttachmentStore((s) => s.addAttachment)
  const loadAttachments = useAttachmentStore((s) => s.loadAttachments)
  const existingAttachments = useAttachmentStore((s) =>
    editTask?.id ? (s.attachments[editTask.id] || EMPTY_ATTACHMENTS) : EMPTY_ATTACHMENTS
  )
  const deleteExistingAttachment = useAttachmentStore((s) => s.deleteAttachment)
  const groups = useGroupStore((s) => s.groups)
  const addTaskToGroup = useGroupStore((s) => s.addTaskToGroup)
  const removeTaskFromGroup = useGroupStore((s) => s.removeTaskFromGroup)

  const [title, setTitle] = useState('')
  const [memo, setMemo] = useState('')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [dueDate, setDueDate] = useState<string>(defaultDueDate ?? '')
  const [priority, setPriority] = useState<TaskPriority>('none')
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)
  const [isAiParsing, setIsAiParsing] = useState(false)

  // Repeat
  const [repeatEnabled, setRepeatEnabled] = useState(false)
  const [repeatType, setRepeatType] = useState<RepeatType>('daily')
  const [repeatInterval, setRepeatInterval] = useState(1)

  // Subtasks
  const [subtasks, setSubtasks] = useState<{ id: string; title: string; isCompleted: boolean }[]>([])
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')

  // Edit mode menu
  const [showMoreMenu, setShowMoreMenu] = useState(false)

  // Attachments (pending, before task creation)
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [fileError, setFileError] = useState<string | null>(null)
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<number>>(new Set())
  const initialGroupIdsRef = useRef<Set<number>>(new Set())
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isEditMode = !!editTask

  // Natural language parse suggestions (create mode only)
  const nlHint = useMemo(() => {
    if (isEditMode || !title.trim()) return null
    const result = parseNaturalLanguage(title)
    if (!result.dueDate && !result.priority) return null
    return result
  }, [title, isEditMode])

  // Initialize form when modal opens
  useEffect(() => {
    if (!isOpen) return
    if (editTask) {
      setTitle(editTask.title)
      setMemo(editTask.memo || '')
      setCategoryId(editTask.categoryId)
      setDueDate(editTask.dueDate || '')
      setPriority(editTask.priority)
      if (editTask.repeat.type !== 'none') {
        setRepeatEnabled(true)
        setRepeatType(editTask.repeat.type as RepeatType)
        setRepeatInterval(editTask.repeat.interval)
      } else {
        setRepeatEnabled(false)
        setRepeatType('daily')
        setRepeatInterval(1)
      }
      setSubtasks(editTask.subtasks?.map(st => ({
        id: st.id, title: st.title, isCompleted: st.isCompleted
      })) || [])
      setNewSubtaskTitle('')
      setShowMoreMenu(false)
      setPendingFiles([])
      setFileError(null)
      if (editTask.id) {
        loadAttachments(editTask.id)
        const taskGroups = groups.filter(g => g.taskIds.includes(editTask.id!))
        const groupIdSet = new Set(taskGroups.map(g => g.id!))
        setSelectedGroupIds(groupIdSet)
        initialGroupIdsRef.current = new Set(groupIdSet)
      }
    } else {
      setTitle('')
      setMemo('')
      setCategoryId(null)
      setDueDate(defaultDueDate ?? '')
      setPriority('none')
      setRepeatEnabled(false)
      setRepeatType('daily')
      setRepeatInterval(1)
      setSubtasks([])
      setNewSubtaskTitle('')
      setShowMoreMenu(false)
      setPendingFiles([])
      setFileError(null)
      setSelectedGroupIds(new Set())
      initialGroupIdsRef.current = new Set()
    }
  }, [isOpen, editTask])

  if (!isOpen) return null

  const resetForm = () => {
    setTitle('')
    setMemo('')
    setCategoryId(null)
    setDueDate(defaultDueDate ?? '')
    setPriority('none')
    setRepeatEnabled(false)
    setRepeatType('daily')
    setRepeatInterval(1)
    setSubtasks([])
    setNewSubtaskTitle('')
    setShowMoreMenu(false)
    setPendingFiles([])
    setFileError(null)
    setSelectedGroupIds(new Set())
    initialGroupIdsRef.current = new Set()
  }

  const toggleGroup = (groupId: number) => {
    setSelectedGroupIds(prev => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  // Subtask handlers
  const handleAddSubtask = () => {
    const trimmed = newSubtaskTitle.trim()
    if (!trimmed) return
    setSubtasks(prev => [...prev, {
      id: crypto.randomUUID(),
      title: trimmed,
      isCompleted: false,
    }])
    setNewSubtaskTitle('')
  }

  const handleToggleSubtask = (id: string) => {
    setSubtasks(prev => prev.map(st =>
      st.id === id ? { ...st, isCompleted: !st.isCompleted } : st
    ))
  }

  const handleDeleteSubtask = (id: string) => {
    setSubtasks(prev => prev.filter(st => st.id !== id))
  }

  // Edit mode action handlers
  const handleMarkComplete = async () => {
    if (!editTask?.id) return
    await toggleComplete(editTask.id)
    setShowMoreMenu(false)
    onClose()
  }

  const handleDuplicate = async () => {
    if (!editTask) return
    await addTask({
      title: editTask.title,
      memo: editTask.memo,
      categoryId: editTask.categoryId,
      status: 'pending',
      priority: editTask.priority,
      isFlagged: false,
      isStarred: false,
      dueDate: editTask.dueDate,
      alarm: { enabled: false },
      repeat: editTask.repeat,
      subtasks: editTask.subtasks?.map(st => ({
        ...st, id: crypto.randomUUID(), isCompleted: false,
      })) || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sortOrder: 0,
    })
    setShowMoreMenu(false)
    onClose()
  }

  const handleDeleteTask = async () => {
    if (!editTask?.id) return
    await deleteTask(editTask.id)
    setShowMoreMenu(false)
    onClose()
  }

  const handleSave = async () => {
    const trimmedTitle = title.trim()
    if (!trimmedTitle) return

    if (editTask?.id) {
      // Edit mode
      await updateTask(editTask.id, {
        title: trimmedTitle,
        memo: memo.trim() || undefined,
        categoryId,
        priority,
        dueDate: dueDate || undefined,
        repeat: repeatEnabled
          ? { type: repeatType, interval: repeatInterval }
          : { type: 'none' as const, interval: 1 },
        subtasks: subtasks.map((st, i) => ({
          id: st.id,
          title: st.title,
          isCompleted: st.isCompleted,
          sortOrder: i,
          createdAt: new Date().toISOString(),
        })),
      })

      if (pendingFiles.length > 0) {
        for (const pf of pendingFiles) {
          await addAttachment(editTask.id, pf.file)
        }
      }

      // Group changes (diff)
      for (const gid of selectedGroupIds) {
        if (!initialGroupIdsRef.current.has(gid)) {
          await addTaskToGroup(gid, editTask.id)
        }
      }
      for (const gid of initialGroupIdsRef.current) {
        if (!selectedGroupIds.has(gid)) {
          await removeTaskFromGroup(gid, editTask.id)
        }
      }
    } else {
      // Create mode
      const taskId = await addTask({
        title: trimmedTitle,
        memo: memo.trim() || undefined,
        categoryId,
        status: 'pending',
        priority,
        isFlagged: false,
        isStarred: false,
        dueDate: dueDate || undefined,
        alarm: { enabled: false },
        repeat: repeatEnabled
          ? { type: repeatType, interval: repeatInterval }
          : { type: 'none', interval: 1 },
        subtasks: subtasks.map((st, i) => ({
          id: st.id,
          title: st.title,
          isCompleted: st.isCompleted,
          sortOrder: i,
          createdAt: new Date().toISOString(),
        })),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sortOrder: 0,
      })

      if (taskId && pendingFiles.length > 0) {
        for (const pf of pendingFiles) {
          await addAttachment(taskId, pf.file)
        }
      }

      // Add to selected groups
      if (taskId && selectedGroupIds.size > 0) {
        for (const gid of selectedGroupIds) {
          await addTaskToGroup(gid, taskId)
        }
      }
    }

    // Cleanup preview URLs
    pendingFiles.forEach((pf) => {
      if (pf.previewUrl) URL.revokeObjectURL(pf.previewUrl)
    })

    resetForm()
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSave()
    }
    if (e.key === 'Escape') {
      onClose()
    }
  }

  const handleTemplateSelect = (template: {
    title: string
    categoryId: number | null
    priority: TaskPriority
    subtasks: { title: string; sortOrder: number }[]
    repeat: { type: string; interval: number }
    memo?: string
  }) => {
    setTitle(template.title)
    if (template.memo) setMemo(template.memo)
    setCategoryId(template.categoryId)
    setPriority(template.priority)
    if (template.repeat.type !== 'none') {
      setRepeatEnabled(true)
      setRepeatType(template.repeat.type as RepeatType)
      setRepeatInterval(template.repeat.interval)
    }
    setShowTemplatePicker(false)
  }

  const handleAiParse = async () => {
    const trimmed = title.trim()
    if (!trimmed || !aiApiKey) return

    setIsAiParsing(true)
    try {
      const categoryNames = categories.map((c) => c.name)
      const decryptedKey = await getDecryptedApiKey()
      const parsed = await parseTaskWithAI(decryptedKey, trimmed, categoryNames)

      setTitle(parsed.title)
      if (parsed.priority) setPriority(parsed.priority)
      if (parsed.dueDate) setDueDate(parsed.dueDate)
      if (parsed.categoryHint) {
        const matchedCat = categories.find((c) => c.name === parsed.categoryHint)
        if (matchedCat?.id) setCategoryId(matchedCat.id)
      }
    } catch (error) {
      console.error('AI parse failed:', error)
    } finally {
      setIsAiParsing(false)
    }
  }

  // Attachment handlers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    setFileError(null)

    for (const file of Array.from(files)) {
      if (pendingFiles.length >= 5) {
        setFileError('최대 5개까지 첨부할 수 있습니다.')
        break
      }
      if (file.size > 5 * 1024 * 1024) {
        setFileError('파일 크기는 5MB를 초과할 수 없습니다.')
        continue
      }

      const previewUrl = file.type.startsWith('image/')
        ? URL.createObjectURL(file)
        : undefined

      setPendingFiles((prev) => [
        ...prev,
        { id: crypto.randomUUID(), file, previewUrl },
      ])
    }

    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleRemoveFile = (id: string) => {
    setPendingFiles((prev) => {
      const target = prev.find((f) => f.id === id)
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((f) => f.id !== id)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full sm:max-w-md h-[85dvh] sm:h-auto sm:max-h-[85dvh] pb-[env(safe-area-inset-bottom,0px)] sm:pb-0 bg-white dark:bg-zinc-900 rounded-t-2xl sm:rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {isEditMode ? '작업 수정' : '새 작업'}
          </h2>
          <div className="flex items-center gap-1">
            {!isEditMode && aiEnabled && aiApiKey && (
              <button
                type="button"
                onClick={handleAiParse}
                disabled={isAiParsing || !title.trim()}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-purple-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title="AI로 자동 분석"
              >
                {isAiParsing ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Sparkles className="w-5 h-5" />
                )}
              </button>
            )}
            {!isEditMode && (
              <button
                type="button"
                onClick={() => setShowTemplatePicker(true)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-primary-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                title="템플릿에서 만들기"
              >
                <LayoutTemplate className="w-5 h-5" />
              </button>
            )}
            {isEditMode && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowMoreMenu(!showMoreMenu)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  title="더보기"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>
                {showMoreMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowMoreMenu(false)} />
                    <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-lg z-20 py-1">
                      <button
                        type="button"
                        onClick={handleMarkComplete}
                        className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 text-zinc-700 dark:text-zinc-300 transition-colors"
                      >
                        <Check className="w-4 h-4" />
                        {editTask?.status === 'completed' ? '미완료로 변경' : '완료로 표시'}
                      </button>
                      <button
                        type="button"
                        onClick={handleDuplicate}
                        className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 text-zinc-700 dark:text-zinc-300 transition-colors"
                      >
                        <Copy className="w-4 h-4" />
                        복사
                      </button>
                      <div className="border-t border-zinc-100 dark:border-zinc-700 my-1" />
                      <button
                        type="button"
                        onClick={handleDeleteTask}
                        className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        삭제
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body - scrollable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Title */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="자연어로 입력 (예: 내일까지 보고서 작성 긴급)"
            autoFocus
            className="w-full px-3 py-2.5 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
          />

          {/* NL parse hint */}
          {nlHint && (
            <div className="flex items-center gap-2 flex-wrap">
              {nlHint.dueDate && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                  📅 {nlHint.dueDate}
                </span>
              )}
              {nlHint.priority && (
                <span className={clsx(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs',
                  nlHint.priority === 'high' && 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
                  nlHint.priority === 'medium' && 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
                  nlHint.priority === 'low' && 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
                )}>
                  🔔 {nlHint.priority === 'high' ? '높음' : nlHint.priority === 'medium' ? '중간' : '낮음'}
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  if (nlHint.cleanTitle) setTitle(nlHint.cleanTitle)
                  if (nlHint.dueDate) setDueDate(nlHint.dueDate)
                  if (nlHint.priority) setPriority(nlHint.priority)
                }}
                className="text-xs text-primary-500 hover:text-primary-600 font-medium"
              >
                적용
              </button>
            </div>
          )}

          {/* Subtasks */}
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
              하위 작업
            </label>

            {subtasks.length > 0 && (
              <div className="space-y-1 mb-2">
                {subtasks.map(st => (
                  <div key={st.id} className="flex items-center gap-2 group">
                    <button
                      type="button"
                      onClick={() => handleToggleSubtask(st.id)}
                      className={clsx(
                        "w-4 h-4 rounded-full border-2 flex-shrink-0 transition-colors",
                        st.isCompleted
                          ? "bg-primary-500 border-primary-500"
                          : "border-zinc-300 dark:border-zinc-600"
                      )}
                    >
                      {st.isCompleted && <Check className="w-2.5 h-2.5 text-white m-auto" />}
                    </button>
                    <span className={clsx(
                      "flex-1 text-sm text-zinc-700 dark:text-zinc-300",
                      st.isCompleted && "line-through text-zinc-400 dark:text-zinc-500"
                    )}>
                      {st.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteSubtask(st.id)}
                      className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-0.5 text-zinc-400 hover:text-red-500 transition-opacity"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-primary-500 flex-shrink-0" />
              <input
                type="text"
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    e.stopPropagation()
                    handleAddSubtask()
                  }
                }}
                placeholder="하위 작업 추가"
                className="flex-1 text-sm py-1.5 bg-transparent text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 outline-none border-b border-zinc-200 dark:border-zinc-700 focus:border-primary-500 transition-colors"
              />
            </div>
          </div>

          {/* Memo */}
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
              메모
            </label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="메모를 입력하세요 (선택사항)"
              rows={3}
              className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors resize-none"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
              카테고리
            </label>
            <div className="overflow-x-auto scrollbar-none -mx-1 px-1">
              <div className="flex items-center gap-1.5 pb-1">
                <button
                  type="button"
                  onClick={() => setCategoryId(null)}
                  className={clsx(
                    'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap',
                    categoryId === null
                      ? 'bg-primary-500 text-white'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                  )}
                >
                  미분류
                </button>
                {categories
                  .filter((c) => !c.parentId)
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .flatMap((root) => {
                    const children = categories
                      .filter((c) => c.parentId === root.id)
                      .sort((a, b) => a.sortOrder - b.sortOrder)
                    return [root, ...children]
                  })
                  .map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategoryId(cat.id ?? null)}
                      className={clsx(
                        'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1',
                        categoryId === cat.id
                          ? 'bg-primary-500 text-white'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                      )}
                    >
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      {cat.parentId && <span className="text-[10px] opacity-60">└</span>}
                      {cat.name}
                    </button>
                  ))}
              </div>
            </div>
          </div>

          {/* Group */}
          {groups.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <FolderKanban className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  그룹
                </label>
                {selectedGroupIds.size > 0 && (
                  <span className="text-[10px] text-primary-500 font-medium">{selectedGroupIds.size}개</span>
                )}
              </div>
              <div className="overflow-x-auto scrollbar-none -mx-1 px-1">
                <div className="flex items-center gap-1.5 pb-1">
                  {groups.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => toggleGroup(g.id!)}
                      className={clsx(
                        'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap flex items-center gap-1.5',
                        selectedGroupIds.has(g.id!)
                          ? 'bg-primary-500 text-white'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                      )}
                    >
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: selectedGroupIds.has(g.id!) ? '#fff' : g.color }}
                      />
                      {g.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Due Date */}
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
              마감일
            </label>
            <div className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800">
              <DatePicker
                value={dueDate || undefined}
                onChange={setDueDate}
                placeholder="날짜를 선택하세요"
              />
            </div>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
              우선순위
            </label>
            <div className="flex gap-2">
              {priorityOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPriority(opt.value)}
                  className={`flex-1 px-3 py-1.5 text-sm rounded-lg border transition-colors ${priority === opt.value
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 font-medium'
                    : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                    }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-zinc-200 dark:border-zinc-800" />

          {/* Repeat Task */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Repeat className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  반복 작업으로 설정
                </label>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={repeatEnabled}
                onClick={() => setRepeatEnabled(!repeatEnabled)}
                className={clsx(
                  'relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
                  repeatEnabled ? 'bg-primary-500' : 'bg-zinc-200 dark:bg-zinc-700'
                )}
              >
                <span
                  aria-hidden="true"
                  className={clsx(
                    'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                    repeatEnabled ? 'translate-x-4' : 'translate-x-0'
                  )}
                />
              </button>
            </div>

            {repeatEnabled && (
              <div className="space-y-3 mt-2">
                <div className="flex gap-2">
                  {repeatOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setRepeatType(opt.value)}
                      className={`flex-1 px-2 py-1.5 text-xs rounded-lg border transition-colors ${repeatType === opt.value
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 font-medium'
                        : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                        }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {/* Interval */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">반복 간격:</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setRepeatInterval(Math.max(1, repeatInterval - 1))}
                      className="w-7 h-7 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 text-sm flex items-center justify-center hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    >
                      -
                    </button>
                    <span className="w-8 text-center text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {repeatInterval}
                    </span>
                    <button
                      type="button"
                      onClick={() => setRepeatInterval(Math.min(30, repeatInterval + 1))}
                      className="w-7 h-7 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 text-sm flex items-center justify-center hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    >
                      +
                    </button>
                  </div>
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">
                    {repeatType === 'daily' && (repeatInterval === 1 ? '매일' : `${repeatInterval}일마다`)}
                    {repeatType === 'weekly' && (repeatInterval === 1 ? '매주' : `${repeatInterval}주마다`)}
                    {repeatType === 'monthly' && (repeatInterval === 1 ? '매월' : `${repeatInterval}개월마다`)}
                    {repeatType === 'yearly' && (repeatInterval === 1 ? '매년' : `${repeatInterval}년마다`)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-zinc-200 dark:border-zinc-800" />

          {/* Attachments */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  첨부 파일
                </label>
                {(existingAttachments.length + pendingFiles.length) > 0 && (
                  <span className="text-[10px] text-zinc-400">
                    {existingAttachments.length + pendingFiles.length}/5
                  </span>
                )}
              </div>
              {(existingAttachments.length + pendingFiles.length) < 5 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1 text-xs text-primary-500 hover:text-primary-600"
                >
                  <Plus className="w-3.5 h-3.5" />
                  추가
                </button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf,text/*,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />

            {fileError && (
              <p className="text-xs text-red-500 mb-2">{fileError}</p>
            )}

            {/* Existing attachments (edit mode) */}
            {isEditMode && existingAttachments.length > 0 && (
              <div className="space-y-1.5 mb-2">
                {existingAttachments.map((att) => (
                  <ExistingAttachmentItem
                    key={att.id}
                    attachment={att}
                    onDelete={() => deleteExistingAttachment(att.id!, editTask!.id!)}
                  />
                ))}
              </div>
            )}

            {/* New pending files */}
            {pendingFiles.length > 0 && (
              <div className="space-y-1.5">
                {pendingFiles.map((pf) => (
                  <div
                    key={pf.id}
                    className="flex items-center gap-3 p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 group"
                  >
                    {pf.previewUrl ? (
                      <img
                        src={pf.previewUrl}
                        alt={pf.file.name}
                        className="w-9 h-9 rounded-lg object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center flex-shrink-0">
                        {pf.file.type.startsWith('image/') ? (
                          <ImageIcon className="w-4 h-4 text-zinc-400" />
                        ) : (
                          <FileText className="w-4 h-4 text-zinc-400" />
                        )}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate">
                        {pf.file.name}
                      </p>
                      <p className="text-[10px] text-zinc-400">{formatFileSize(pf.file.size)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(pf.id)}
                      className="p-1 rounded text-zinc-400 hover:text-red-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-zinc-200 dark:border-zinc-800">
          <Button variant="ghost" size="sm" onClick={onClose}>
            취소
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={!title.trim()}
          >
            {isEditMode ? '수정' : '저장'}
          </Button>
        </div>
      </div>

      {/* Template picker modal */}
      {showTemplatePicker && (
        <TemplatePickerModal
          isOpen={showTemplatePicker}
          onClose={() => setShowTemplatePicker(false)}
          onSelect={handleTemplateSelect}
        />
      )}
    </div>
  )
}
