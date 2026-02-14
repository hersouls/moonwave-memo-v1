import { Bold, Italic, Code, Link2, List, Heading2, Mic, Camera } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useToastStore } from '@/stores/toastStore'

interface EditorToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  onContentChange: (value: string) => void
}

export function EditorToolbar({ textareaRef, onContentChange }: EditorToolbarProps) {
  const insertAtCursor = (before: string, after: string = '') => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = textarea.value
    const selected = text.substring(start, end)

    const newText = text.substring(0, start) + before + selected + after + text.substring(end)
    onContentChange(newText)

    requestAnimationFrame(() => {
      textarea.focus()
      if (selected) {
        const newEnd = start + before.length + selected.length
        textarea.setSelectionRange(newEnd + after.length, newEnd + after.length)
      } else {
        const cursorPos = start + before.length
        textarea.setSelectionRange(cursorPos, cursorPos)
      }
    })
  }

  const handleMicClick = () => {
    const apiKey = useSettingsStore.getState().settings.ai?.openaiApiKey
    if (!apiKey) {
      useToastStore.getState().showToast(
        'AI 서비스 설정에서 OpenAI API 키를 입력해 주세요',
        'warning',
        {
          action: {
            label: '설정',
            onClick: () => useUIStore.getState().openSettingsModal(),
          },
        }
      )
      return
    }
    useUIStore.getState().openVoiceModal()
  }

  const handleCameraClick = () => {
    const ai = useSettingsStore.getState().settings.ai
    const provider = ai?.ocrProvider || 'openai'
    const apiKey = provider === 'anthropic' ? ai?.anthropicApiKey : ai?.openaiApiKey
    if (!apiKey) {
      useToastStore.getState().showToast(
        `AI 서비스 설정에서 ${provider === 'anthropic' ? 'Anthropic' : 'OpenAI'} API 키를 입력해 주세요`,
        'warning',
        {
          action: {
            label: '설정',
            onClick: () => useUIStore.getState().openSettingsModal(),
          },
        }
      )
      return
    }
    useUIStore.getState().openImageOCRModal()
  }

  const tools = [
    { icon: <Bold className="w-5 h-5" />, label: '굵게', action: () => insertAtCursor('**', '**') },
    { icon: <Italic className="w-5 h-5" />, label: '기울임', action: () => insertAtCursor('*', '*') },
    { icon: <Code className="w-5 h-5" />, label: '코드', action: () => insertAtCursor('`', '`') },
    { icon: <Link2 className="w-5 h-5" />, label: '링크', action: () => insertAtCursor('[', '](url)') },
    { icon: <List className="w-5 h-5" />, label: '목록', action: () => insertAtCursor('- ') },
    { icon: <Heading2 className="w-5 h-5" />, label: '제목', action: () => insertAtCursor('## ') },
  ]

  return (
    <div className="sticky bottom-0 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-700 px-2 py-2 lg:hidden">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {tools.map((tool) => (
          <button
            key={tool.label}
            onClick={tool.action}
            className="p-2.5 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors active:scale-95"
            title={tool.label}
            aria-label={tool.label}
          >
            {tool.icon}
          </button>
        ))}

        {/* Divider */}
        <div className="h-5 w-px bg-zinc-200 dark:bg-zinc-700" />

        {/* Mic button */}
        <button
          onClick={handleMicClick}
          className="p-2.5 rounded-lg text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors active:scale-95"
          title="음성 입력"
          aria-label="음성 입력"
        >
          <Mic className="w-5 h-5" />
        </button>

        {/* Image OCR button */}
        <button
          onClick={handleCameraClick}
          className="p-2.5 rounded-lg text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors active:scale-95"
          title="이미지 OCR"
          aria-label="이미지 OCR"
        >
          <Camera className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}
