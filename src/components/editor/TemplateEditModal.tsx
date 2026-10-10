import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react'
import { Fragment, useState, useEffect } from 'react'
import { useTemplateStore } from '@/stores/templateStore'
import type { MemoColor } from '@/lib/types'
import type { MemoTemplate } from '@/utils/memoTemplates'
import { IcLineBook, IcLineBulb, IcLineCalendar, IcLineDocument, IcLineHeart, IcLineUsers, IcMwCheckSquare, IcMwCode, IcMwStar, IcMwTarget } from '@/mw/icons'
import { TextArea } from '@/mw/TextArea'
import { TextField } from '@/mw/TextField'

// name은 저장해 온 이름이라 그대로 두고, 화면에는 label을 읽어 줘요.
const AVAILABLE_ICONS = [
  { name: 'Users', label: '사람들', component: IcLineUsers },
  { name: 'BookOpen', label: '책', component: IcLineBook },
  { name: 'CheckSquare', label: '할 일', component: IcMwCheckSquare },
  { name: 'Lightbulb', label: '아이디어', component: IcLineBulb },
  { name: 'Calendar', label: '달력', component: IcLineCalendar },
  { name: 'FileText', label: '문서', component: IcLineDocument },
  { name: 'Star', label: '별', component: IcMwStar },
  { name: 'Heart', label: '하트', component: IcLineHeart },
  { name: 'Target', label: '목표', component: IcMwTarget },
  { name: 'Code', label: '코드', component: IcMwCode },
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
          leave="ease-in duration-200"
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
            leave="ease-in duration-200"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <DialogPanel className="w-full max-w-md bg-white dark:bg-zinc-800 rounded-2xl shadow-xl p-6 max-h-[85dvh] overflow-y-auto">
              <DialogTitle className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4">
                {isEditing ? '템플릿 편집' : '새 템플릿'}
              </DialogTitle>

              <div className="flex flex-col gap-4 mb-4">
                <TextField
                  label="템플릿 이름"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />

                <div role="group" aria-labelledby="template-icon-caption">
                  <p id="template-icon-caption" className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    아이콘
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {AVAILABLE_ICONS.map(({ name: iconName, label: iconLabel, component: IconComp }) => (
                      <button type="button" aria-pressed={icon === iconName}
                        key={iconName}
                        onClick={() => setIcon(iconName)}
                        className={icon === iconName ? 'mw-icon-button memo-tool--on' : 'mw-icon-button'}
                        aria-label={iconLabel}
                      >
                        <IconComp size={20} />
                      </button>
                    ))}
                  </div>
                </div>

                <TextField
                  label="자동으로 채울 제목 (비워 둬도 돼요)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />

                <TextArea
                  label="내용 틀 (마크다운, 비워 둬도 돼요)"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2 justify-end">
                <button type="button"
                  onClick={onClose}
                  className="mw-text-button mw-text-button--ghost mw-text-button--medium mw-text-button--default"
                >
                  <span>취소</span>
                </button>
                <button type="button"
                  onClick={handleSave}
                  disabled={!name.trim()}
                  className="mw-button mw-button--primary mw-button--medium"
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
