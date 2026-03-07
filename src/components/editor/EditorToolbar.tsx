import { useState, useEffect, useCallback } from 'react'
import { Bold, Italic, Code, Link2, List, Heading2, Mic, Camera, Undo2, Redo2 } from 'lucide-react'
import clsx from 'clsx'
import { useUIStore } from '@/stores/uiStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useToastStore } from '@/stores/toastStore'
import { useVisualViewport } from '@/hooks/useVisualViewport'
import { ImageInsertButton } from './ImageInsertButton'

interface EditorToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  onContentChange: (value: string) => void
  onUndo?: () => void
  onRedo?: () => void
  canUndo?: boolean
  canRedo?: boolean
  memoId?: number
}

export function EditorToolbar({ textareaRef, onContentChange, onUndo, onRedo, canUndo, canRedo, memoId }: EditorToolbarProps) {
  const hasApiKey = useSettingsStore((s) => !!s.settings.ai?.openaiApiKey || !!s.settings.ai?.anthropicApiKey)
  const { isKeyboardOpen, keyboardHeight } = useVisualViewport()
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set())

  // Detect active formatting at cursor position
  const detectFormats = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    const { selectionStart: start, selectionEnd: end, value } = textarea
    const formats = new Set<string>()

    // Check surrounding markers
    const before = value.substring(0, start)
    const after = value.substring(end)

    if (/\*\*[^*]*$/.test(before) && /^[^*]*\*\*/.test(after)) formats.add('bold')
    if (/(?<!\*)\*[^*]*$/.test(before) && /^[^*]*\*(?!\*)/.test(after)) formats.add('italic')
    if (/`[^`]*$/.test(before) && /^[^`]*`/.test(after)) formats.add('code')
    if (/\[[^\]]*$/.test(before) && /^[^\]]*\]\([^)]*\)/.test(after)) formats.add('link')

    setActiveFormats(formats)
  }, [textareaRef])

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    const handler = () => requestAnimationFrame(detectFormats)
    textarea.addEventListener('keyup', handler)
    textarea.addEventListener('mouseup', handler)
    textarea.addEventListener('select', handler)
    return () => {
      textarea.removeEventListener('keyup', handler)
      textarea.removeEventListener('mouseup', handler)
      textarea.removeEventListener('select', handler)
    }
  }, [textareaRef, detectFormats])
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

  // UX-02: shortcut hints in title
  const tools = [
    { icon: <Bold className="w-5 h-5" />, label: '굵게', title: '굵게 (Ctrl+B)', formatKey: 'bold', action: () => insertAtCursor('**', '**') },
    { icon: <Italic className="w-5 h-5" />, label: '기울임', title: '기울임 (Ctrl+I)', formatKey: 'italic', action: () => insertAtCursor('*', '*') },
    { icon: <Code className="w-5 h-5" />, label: '코드', title: '코드 (Ctrl+E)', formatKey: 'code', action: () => insertAtCursor('`', '`') },
    { icon: <Link2 className="w-5 h-5" />, label: '링크', title: '링크 (Ctrl+K)', formatKey: 'link', action: () => insertAtCursor('[', '](url)') },
    { icon: <List className="w-5 h-5" />, label: '목록', title: '목록', formatKey: 'list', action: () => insertAtCursor('- ') },
    { icon: <Heading2 className="w-5 h-5" />, label: '제목', title: '제목', formatKey: 'heading', action: () => insertAtCursor('## ') },
  ]

  return (
    <div
      className={clsx(
        'bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-700 px-2 py-2',
        isKeyboardOpen ? 'fixed left-0 right-0 z-20' : 'sticky bottom-0'
      )}
      style={isKeyboardOpen ? { bottom: `${keyboardHeight}px` } : undefined}
    >
      <div className="flex items-center justify-around max-w-md mx-auto">
        {/* Undo/Redo */}
        {onUndo && (
          <>
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className="p-2.5 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors active:scale-95 disabled:opacity-30"
              title="실행취소 (Ctrl+Z)"
              aria-label="실행취소"
            >
              <Undo2 className="w-5 h-5" />
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              className="p-2.5 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors active:scale-95 disabled:opacity-30"
              title="다시실행 (Ctrl+Shift+Z)"
              aria-label="다시실행"
            >
              <Redo2 className="w-5 h-5" />
            </button>
            <div className="h-5 w-px bg-zinc-200 dark:bg-zinc-700" />
          </>
        )}
        {tools.map((tool) => (
          <button
            key={tool.label}
            onClick={tool.action}
            className={clsx(
              'p-2.5 rounded-lg transition-colors active:scale-95',
              activeFormats.has(tool.formatKey)
                ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            )}
            title={tool.title}
            aria-label={tool.label}
          >
            {tool.icon}
          </button>
        ))}

        {/* Image insert button */}
        <div className="h-5 w-px bg-zinc-200 dark:bg-zinc-700" />
        <ImageInsertButton
          memoId={memoId}
          onInsert={(markdown) => {
            const textarea = textareaRef.current
            if (!textarea) return
            const start = textarea.selectionStart
            const text = textarea.value
            const newText = text.substring(0, start) + markdown + text.substring(start)
            onContentChange(newText)
          }}
        />

        {/* AI buttons — only when API key configured */}
        {hasApiKey && (
          <>
            <button
              onClick={handleMicClick}
              className="p-2.5 rounded-lg text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors active:scale-95"
              title="음성 입력"
              aria-label="음성 입력"
            >
              <Mic className="w-5 h-5" />
            </button>
            <button
              onClick={handleCameraClick}
              className="p-2.5 rounded-lg text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors active:scale-95"
              title="이미지 OCR"
              aria-label="이미지 OCR"
            >
              <Camera className="w-5 h-5" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
