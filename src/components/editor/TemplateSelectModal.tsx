import { useState } from 'react'
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { useNavigate } from 'react-router-dom'
import {
  Users, BookOpen, CheckSquare, Lightbulb, Calendar,
  FileText, Star, Heart, Zap, Target, Briefcase, Code,
  X, Plus, Pencil, Trash2, Lock, Settings2,
} from 'lucide-react'
import { getAllTemplates, isBuiltinTemplate } from '@/utils/memoTemplates'
import type { MemoTemplate } from '@/utils/memoTemplates'
import { useUIStore } from '@/stores/uiStore'
import { useTemplateStore } from '@/stores/templateStore'
import { TemplateEditModal } from './TemplateEditModal'

const ICON_MAP: Record<string, React.ElementType> = {
  Users,
  BookOpen,
  CheckSquare,
  Lightbulb,
  Calendar,
  FileText,
  Star,
  Heart,
  Zap,
  Target,
  Briefcase,
  Code,
}

const COLOR_MAP: Record<string, string> = {
  blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400',
  yellow: 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400',
  green: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400',
  purple: 'bg-purple-50 text-purple-600 dark:bg-purple-950/30 dark:text-purple-400',
  pink: 'bg-pink-50 text-pink-600 dark:bg-pink-950/30 dark:text-pink-400',
  white: 'bg-zinc-50 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
}

export function TemplateSelectModal() {
  const navigate = useNavigate()
  const isOpen = useUIStore((s) => s.isTemplateModalOpen)
  const close = useUIStore((s) => s.closeTemplateModal)
  const deleteTemplate = useTemplateStore((s) => s.deleteTemplate)

  const [isManageMode, setIsManageMode] = useState(false)
  const [editTarget, setEditTarget] = useState<MemoTemplate | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const templates = getAllTemplates()

  const handleSelect = (templateId: string) => {
    if (isManageMode) return
    close()
    navigate(`/memo/new?template=${templateId}`)
  }

  const handleBlank = () => {
    close()
    navigate('/memo/new')
  }

  const handleClose = () => {
    setIsManageMode(false)
    setDeleteConfirm(null)
    close()
  }

  const handleAddNew = () => {
    setEditTarget(null)
    setIsEditModalOpen(true)
  }

  const handleEdit = (template: MemoTemplate) => {
    setEditTarget(template)
    setIsEditModalOpen(true)
  }

  const handleDeleteClick = (id: string) => {
    setDeleteConfirm(id)
  }

  const confirmDelete = () => {
    if (deleteConfirm) {
      deleteTemplate(deleteConfirm)
      setDeleteConfirm(null)
    }
  }

  return (
    <>
      <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 flex items-end sm:items-center justify-center p-4">
          <DialogPanel className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-800 shadow-xl p-5 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between mb-4">
              <DialogTitle className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                템플릿 선택
              </DialogTitle>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsManageMode(!isManageMode)}
                  className={`p-2 rounded-lg transition-colors ${
                    isManageMode
                      ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400'
                      : 'text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                  }`}
                  aria-label="관리"
                  title="템플릿 관리"
                >
                  <Settings2 className="w-5 h-5" />
                </button>
                <button onClick={handleClose} className="f-icon-btn" aria-label="닫기">
                  <X className="w-5 h-5 text-zinc-400" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              {templates.map((template) => {
                const Icon = ICON_MAP[template.icon] || BookOpen
                const isBuiltin = isBuiltinTemplate(template.id)
                return (
                  <div key={template.id} className="relative group">
                    <button
                      onClick={() => handleSelect(template.id)}
                      disabled={isManageMode}
                      className={`w-full flex flex-col items-center gap-2 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 transition-colors ${
                        isManageMode
                          ? 'cursor-default opacity-80'
                          : 'hover:bg-zinc-50 dark:hover:bg-zinc-700/50'
                      }`}
                    >
                      <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${COLOR_MAP[template.color] || COLOR_MAP.white}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                        {template.name}
                      </span>
                    </button>

                    {/* Manage mode overlay */}
                    {isManageMode && (
                      <div className="absolute top-1.5 right-1.5 flex gap-0.5">
                        {isBuiltin ? (
                          <span className="p-1 text-zinc-300 dark:text-zinc-600" title="기본 템플릿">
                            <Lock className="w-3.5 h-3.5" />
                          </span>
                        ) : (
                          <>
                            <button
                              onClick={() => handleEdit(template)}
                              className="p-1 rounded text-zinc-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                              title="편집"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteClick(template.id)}
                              className="p-1 rounded text-zinc-400 hover:text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/20 transition-colors"
                              title="삭제"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* Add new template button */}
              {isManageMode && (
                <button
                  onClick={handleAddNew}
                  className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-600 text-zinc-400 dark:text-zinc-500 hover:border-primary-400 hover:text-primary-500 dark:hover:border-primary-500 dark:hover:text-primary-400 transition-colors"
                >
                  <Plus className="w-6 h-6" />
                  <span className="text-sm font-medium">새 템플릿</span>
                </button>
              )}
            </div>

            <button
              onClick={handleBlank}
              className="w-full py-2.5 text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-700/50"
            >
              빈 메모로 시작
            </button>
          </DialogPanel>
        </div>

        {/* Delete confirmation */}
        {deleteConfirm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50" onClick={() => setDeleteConfirm(null)} />
            <div className="relative bg-white dark:bg-zinc-800 rounded-2xl shadow-xl p-6 max-w-xs w-full">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">템플릿 삭제</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-5">
                이 템플릿을 삭제하시겠습니까?
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700"
                >
                  취소
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-4 py-2 text-sm font-medium text-white bg-danger-500 rounded-lg hover:bg-danger-600"
                >
                  삭제
                </button>
              </div>
            </div>
          </div>
        )}
      </Dialog>

      <TemplateEditModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        template={editTarget}
      />
    </>
  )
}
