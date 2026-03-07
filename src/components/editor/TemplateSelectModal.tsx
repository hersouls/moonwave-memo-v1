import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { useNavigate } from 'react-router-dom'
import { Users, BookOpen, CheckSquare, Lightbulb, Calendar, X } from 'lucide-react'
import { MEMO_TEMPLATES } from '@/utils/memoTemplates'
import { useUIStore } from '@/stores/uiStore'

const ICON_MAP: Record<string, React.ElementType> = {
  Users,
  BookOpen,
  CheckSquare,
  Lightbulb,
  Calendar,
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

  const handleSelect = (templateId: string) => {
    close()
    navigate(`/memo/new?template=${templateId}`)
  }

  const handleBlank = () => {
    close()
    navigate('/memo/new')
  }

  return (
    <Dialog open={isOpen} onClose={close} className="relative z-50">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" aria-hidden="true" />
      <div className="fixed inset-0 flex items-end sm:items-center justify-center p-4">
        <DialogPanel className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-800 shadow-xl p-5 animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center justify-between mb-4">
            <DialogTitle className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              템플릿 선택
            </DialogTitle>
            <button onClick={close} className="f-icon-btn" aria-label="닫기">
              <X className="w-5 h-5 text-zinc-400" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            {MEMO_TEMPLATES.map((template) => {
              const Icon = ICON_MAP[template.icon] || BookOpen
              return (
                <button
                  key={template.id}
                  onClick={() => handleSelect(template.id)}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors"
                >
                  <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${COLOR_MAP[template.color] || COLOR_MAP.white}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    {template.name}
                  </span>
                </button>
              )
            })}
          </div>

          <button
            onClick={handleBlank}
            className="w-full py-2.5 text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-700/50"
          >
            빈 메모로 시작
          </button>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
