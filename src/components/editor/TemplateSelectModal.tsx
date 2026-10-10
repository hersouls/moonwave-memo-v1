import { useState } from 'react'
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react'
import { useNavigate } from 'react-router-dom'
import { getAllTemplates, isBuiltinTemplate } from '@/utils/memoTemplates'
import type { MemoTemplate } from '@/utils/memoTemplates'
import { useUIStore } from '@/stores/uiStore'
import { useTemplateStore } from '@/stores/templateStore'
import { TemplateEditModal } from './TemplateEditModal'
import { IcLineAdd, IcLineBook, IcLineBulb, IcLineCalendar, IcLineClose, IcLineDocument, IcLineEdit, IcLineHeart, IcLineLock, IcLineSetting, IcLineTrash, IcLineUsers, IcMwCheckSquare, IcMwCode, IcMwStar, IcMwTarget } from '@/mw/icons'
import type { IconType } from '@/components/ui/iconType'

// 템플릿에 저장된 아이콘 이름 → 같은 뜻의 키트 아이콘. 키트에 없는 뜻(번개, 서류 가방)은 문서 아이콘으로 보여요.
const ICON_MAP: Record<string, IconType> = {
  Users: IcLineUsers,
  BookOpen: IcLineBook,
  CheckSquare: IcMwCheckSquare,
  Lightbulb: IcLineBulb,
  Calendar: IcLineCalendar,
  FileText: IcLineDocument,
  Star: IcMwStar,
  Heart: IcLineHeart,
  Target: IcMwTarget,
  Code: IcMwCode,
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
      <Dialog open={isOpen} onClose={handleClose} className="relative z-[var(--z-modal)]">
        <DialogBackdrop
          transition
          className="fixed inset-0 transition data-[closed]:opacity-0 data-[enter]:duration-300 data-[leave]:duration-200 data-[enter]:ease-out data-[leave]:ease-in"
          style={{ background: 'var(--overlay-bg)' }}
        />
        <div className="fixed inset-0 flex items-end sm:items-center justify-center p-4">
          <DialogPanel
            transition
            className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-800 shadow-xl p-5 transition duration-300 data-[closed]:translate-y-8 data-[closed]:opacity-0 sm:data-[closed]:translate-y-0 sm:data-[closed]:scale-95 data-[enter]:ease-out data-[leave]:duration-200 data-[leave]:ease-in"
          >
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
                  <IcLineSetting size={20} />
                </button>
                <button onClick={handleClose} className="mw-icon-button" aria-label="닫기">
                  <IcLineClose size={20} className="text-zinc-400" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              {templates.map((template) => {
                const Icon = ICON_MAP[template.icon] || IcLineBook
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
                      <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[var(--background-secondary)] text-[var(--text-secondary)]">
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
                            <IcLineLock size={16} />
                          </span>
                        ) : (
                          <>
                            <button type="button"
                              onClick={() => handleEdit(template)}
                              className="mw-icon-button"
                              title="편집"
                            >
                              <IcLineEdit size={16} />
                            </button>
                            <button type="button"
                              onClick={() => handleDeleteClick(template.id)}
                              className="mw-icon-button"
                              title="삭제"
                            >
                              <IcLineTrash size={16} />
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
                  className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-600 text-zinc-500 dark:text-zinc-400 hover:border-primary-400 hover:text-primary-500 dark:hover:border-primary-500 dark:hover:text-primary-400 transition-colors"
                >
                  <IcLineAdd size={24} />
                  <span className="text-sm font-medium">새 템플릿</span>
                </button>
              )}
            </div>

            <button type="button"
              onClick={handleBlank}
              className="mw-text-button mw-text-button--ghost mw-text-button--medium mw-text-button--default w-full"
            >
              <span>빈 메모로 시작</span>
            </button>
          </DialogPanel>
        </div>

        {/* Delete confirmation */}
        {deleteConfirm && (
          <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4">
            <div
              className="fixed inset-0 animate-in fade-in duration-200 ease-enter"
              style={{ background: 'var(--overlay-bg)' }}
              onClick={() => setDeleteConfirm(null)}
            />
            <div className="relative bg-white dark:bg-zinc-800 rounded-2xl shadow-xl p-6 max-w-xs w-full animate-in fade-in zoom-in-95 duration-200 ease-enter">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">템플릿 삭제</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-5">
                이 템플릿을 삭제하시겠습니까?
              </p>
              <div className="flex justify-end gap-2">
                <button type="button"
                  onClick={() => setDeleteConfirm(null)}
                  className="mw-text-button mw-text-button--ghost mw-text-button--medium mw-text-button--default"
                >
                  <span>취소</span>
                </button>
                <button type="button"
                  onClick={confirmDelete}
                  className="mw-button mw-button--primary mw-button--medium"
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
