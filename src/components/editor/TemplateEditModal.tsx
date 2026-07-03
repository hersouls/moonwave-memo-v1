import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react'
import { Fragment, useState, useEffect } from 'react'
import {
  Users, BookOpen, CheckSquare, Lightbulb, Calendar,
  FileText, Star, Heart, Zap, Target, Briefcase, Code, Check,
} from 'lucide-react'
import { useTemplateStore } from '@/stores/templateStore'
import type { MemoColor } from '@/lib/types'
import type { MemoTemplate } from '@/utils/memoTemplates'

const AVAILABLE_ICONS = [
  { name: 'Users', component: Users },
  { name: 'BookOpen', component: BookOpen },
  { name: 'CheckSquare', component: CheckSquare },
  { name: 'Lightbulb', component: Lightbulb },
  { name: 'Calendar', component: Calendar },
  { name: 'FileText', component: FileText },
  { name: 'Star', component: Star },
  { name: 'Heart', component: Heart },
  { name: 'Zap', component: Zap },
  { name: 'Target', component: Target },
  { name: 'Briefcase', component: Briefcase },
  { name: 'Code', component: Code },
]

const TEMPLATE_COLORS: { id: MemoColor; label: string; cls: string }[] = [
  { id: 'white', label: '기본', cls: 'bg-zinc-100 dark:bg-zinc-700' },
  { id: 'yellow', label: '노랑', cls: 'bg-amber-300' },
  { id: 'green', label: '초록', cls: 'bg-emerald-300' },
  { id: 'blue', label: '파랑', cls: 'bg-blue-300' },
  { id: 'pink', label: '분홍', cls: 'bg-pink-300' },
  { id: 'purple', label: '보라', cls: 'bg-purple-300' },
]

interface TemplateEditModalProps {
  isOpen: boolean
  onClose: () => void
  template?: MemoTemplate | null
}

export function TemplateEditModal({ isOpen, onClose, template }: TemplateEditModalProps) {
  const addTemplate = useTemplateStore((s) => s.addTemplate)
  const updateTemplate = useTemplateStore((s) => s.updateTemplate)

  const [name, setName] = useState('')
  const [icon, setIcon] = useState('FileText')
  const [color, setColor] = useState<MemoColor>('white')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')

  const isEditing = !!template

  useEffect(() => {
    if (template) {
      setName(template.name)
      setIcon(template.icon)
      setColor(template.color)
      setTitle(template.title)
      setBody(template.body)
    } else {
      setName('')
      setIcon('FileText')
      setColor('white')
      setTitle('')
      setBody('')
    }
  }, [template, isOpen])

  const handleSave = () => {
    if (!name.trim()) return
    if (isEditing && template) {
      updateTemplate(template.id, {
        name: name.trim(),
        icon,
        color,
        title: title.trim(),
        body,
      })
    } else {
      addTemplate({
        name: name.trim(),
        icon,
        color,
        title: title.trim(),
        body,
      })
    }
    onClose()
  }

  return (
    <Transition show={isOpen} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-[60]">
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40" />
        </TransitionChild>

        <div className="fixed inset-0 flex items-end sm:items-center justify-center p-4">
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <DialogPanel className="w-full max-w-md bg-white dark:bg-zinc-800 rounded-2xl shadow-xl p-6 max-h-[85dvh] overflow-y-auto">
              <DialogTitle className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4">
                {isEditing ? '템플릿 편집' : '새 템플릿'}
              </DialogTitle>

              {/* Name */}
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                이름 <span className="text-danger-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="템플릿 이름"
                className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 mb-4"
                autoFocus
              />

              {/* Icon */}
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                아이콘
              </label>
              <div className="grid grid-cols-6 gap-2 mb-4">
                {AVAILABLE_ICONS.map(({ name: iconName, component: IconComp }) => (
                  <button
                    key={iconName}
                    onClick={() => setIcon(iconName)}
                    className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all ${
                      icon === iconName
                        ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400 ring-2 ring-primary-500'
                        : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                    }`}
                    title={iconName}
                  >
                    <IconComp className="w-5 h-5" />
                  </button>
                ))}
              </div>

              {/* Color */}
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                색상
              </label>
              <div role="group" aria-label="색상 선택" className="flex gap-2 mb-4">
                {TEMPLATE_COLORS.map((c) => {
                  const isSelected = color === c.id
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setColor(c.id)}
                      aria-label={c.label}
                      aria-pressed={isSelected}
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${c.cls} transition-transform duration-150 ease-standard hover:scale-110 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${
                        isSelected ? 'scale-110' : ''
                      }`}
                    >
                      {isSelected && <Check className="w-4 h-4 text-white drop-shadow-sm" aria-hidden="true" />}
                    </button>
                  )
                })}
              </div>

              {/* Title preset */}
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                제목 프리셋
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="자동으로 채워질 제목 (선택)"
                className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 mb-4"
              />

              {/* Body preset */}
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                본문 프리셋
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="마크다운 형식으로 본문 템플릿 작성 (선택)"
                rows={6}
                className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 mb-6 resize-none font-mono text-sm"
              />

              {/* Actions */}
              <div className="flex gap-2 justify-end">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700"
                >
                  취소
                </button>
                <button
                  onClick={handleSave}
                  disabled={!name.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isEditing ? '저장' : '만들기'}
                </button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  )
}
