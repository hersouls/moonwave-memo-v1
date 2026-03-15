import { useState, useEffect, useCallback } from 'react'
import { Bold, Italic, Code, Link2, List, ListTree, Heading2, Mic, Camera, Undo2, Redo2, Wand2, Loader2, Brain, MonitorPlay } from 'lucide-react'
import clsx from 'clsx'
import { useUIStore } from '@/stores/uiStore'
import { useToastStore } from '@/stores/toastStore'
import { ImageInsertButton } from './ImageInsertButton'
import { enhanceReadability } from '@/services/aiFeatures'
import type { Editor } from '@tiptap/react'

interface EditorToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  onContentChange: (value: string) => void
  tiptapEditor?: Editor | null
  onUndo?: () => void
  onRedo?: () => void
  canUndo?: boolean
  canRedo?: boolean
  memoId?: number
  body?: string
  onAIEnhance?: (enhanced: string) => void
  onToggleAlterEgo?: () => void
  alterEgoEnabled?: boolean
  onToggleOutline?: () => void
  onSlideView?: () => void
}

export function EditorToolbar({ textareaRef, onContentChange, tiptapEditor, onUndo, onRedo, canUndo, canRedo, memoId, body, onAIEnhance, onToggleAlterEgo, alterEgoEnabled, onToggleOutline, onSlideView }: EditorToolbarProps) {
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set())
  const [isEnhancing, setIsEnhancing] = useState(false)

  const handleAIEnhanceClick = async () => {
    if (!body || body.trim().length < 20) {
      useToastStore.getState().showToast('내용이 너무 짧습니다 (20자 이상 필요)', 'warning')
      return
    }
    if (isEnhancing) return
    setIsEnhancing(true)
    const result = await enhanceReadability(body)
    setIsEnhancing(false)
    if (result.error) {
      useToastStore.getState().showToast(`AI 편집 실패: ${result.error}`, 'error')
      return
    }
    if (result.enhanced && onAIEnhance) {
      onAIEnhance(result.enhanced)
    }
  }

  // Detect active formatting at cursor position
  const detectFormats = useCallback(() => {
    if (tiptapEditor) {
      // Tiptap: use built-in isActive API
      const formats = new Set<string>()
      if (tiptapEditor.isActive('bold')) formats.add('bold')
      if (tiptapEditor.isActive('italic')) formats.add('italic')
      if (tiptapEditor.isActive('code')) formats.add('code')
      if (tiptapEditor.isActive('link')) formats.add('link')
      if (tiptapEditor.isActive('bulletList') || tiptapEditor.isActive('orderedList')) formats.add('list')
      if (tiptapEditor.isActive('heading')) formats.add('heading')
      setActiveFormats(formats)
      return
    }
    const textarea = textareaRef.current
    if (!textarea) return
    const { selectionStart: start, selectionEnd: end, value } = textarea
    const formats = new Set<string>()

    const before = value.substring(0, start)
    const after = value.substring(end)

    if (/\*\*[^*]*$/.test(before) && /^[^*]*\*\*/.test(after)) formats.add('bold')
    if (/(?<!\*)\*[^*]*$/.test(before) && /^[^*]*\*(?!\*)/.test(after)) formats.add('italic')
    if (/`[^`]*$/.test(before) && /^[^`]*`/.test(after)) formats.add('code')
    if (/\[[^\]]*$/.test(before) && /^[^\]]*\]\([^)]*\)/.test(after)) formats.add('link')

    setActiveFormats(formats)
  }, [textareaRef, tiptapEditor])

  // Tiptap: listen to editor transaction events for format detection
  useEffect(() => {
    if (tiptapEditor) {
      const handler = () => detectFormats()
      tiptapEditor.on('selectionUpdate', handler)
      tiptapEditor.on('transaction', handler)
      return () => {
        tiptapEditor.off('selectionUpdate', handler)
        tiptapEditor.off('transaction', handler)
      }
    }
    // Legacy textarea: listen to keyup/mouseup/select
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
  }, [textareaRef, tiptapEditor, detectFormats])
  const insertAtCursor = (before: string, after: string = '') => {
    // Tiptap mode: insert raw markdown content at cursor
    if (tiptapEditor) {
      tiptapEditor.chain().focus().insertContent(before + after).run()
      return
    }
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
    useUIStore.getState().openVoiceModal()
  }

  const handleCameraClick = () => {
    useUIStore.getState().openImageOCRModal()
  }

  // UX-02: shortcut hints in title
  const e = tiptapEditor
  const tools = [
    { icon: <Bold className="w-5 h-5" />, label: '굵게', title: '굵게 (Ctrl+B)', formatKey: 'bold', action: () => e ? e.chain().focus().toggleBold().run() : insertAtCursor('**', '**') },
    { icon: <Italic className="w-5 h-5" />, label: '기울임', title: '기울임 (Ctrl+I)', formatKey: 'italic', action: () => e ? e.chain().focus().toggleItalic().run() : insertAtCursor('*', '*') },
    { icon: <Code className="w-5 h-5" />, label: '코드', title: '인라인 코드 (Ctrl+E)', formatKey: 'code', action: () => e ? e.chain().focus().toggleCode().run() : insertAtCursor('`', '`') },
    { icon: <Link2 className="w-5 h-5" />, label: '링크', title: '링크 삽입 (Ctrl+K)', formatKey: 'link', action: () => {
      if (e) {
        if (e.isActive('link')) { e.chain().focus().unsetLink().run(); return }
        const url = prompt('URL을 입력하세요:')
        if (url) e.chain().focus().setLink({ href: url }).run()
      } else {
        insertAtCursor('[', '](url)')
      }
    } },
    { icon: <List className="w-5 h-5" />, label: '목록', title: '목록', formatKey: 'list', action: () => e ? e.chain().focus().toggleBulletList().run() : insertAtCursor('- ') },
    { icon: <Heading2 className="w-5 h-5" />, label: '제목', title: '제목', formatKey: 'heading', action: () => e ? e.chain().focus().toggleHeading({ level: 2 }).run() : insertAtCursor('## ') },
  ]

  return (
    <div
      className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-700 py-2 shrink-0 overflow-x-auto scrollbar-none"
    >
      <div className="flex items-center justify-center gap-0.5 px-2 w-max min-w-full mx-auto">
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
            if (tiptapEditor) {
              tiptapEditor.chain().focus().insertContent(markdown).run()
              return
            }
            const textarea = textareaRef.current
            if (!textarea) return
            const start = textarea.selectionStart
            const text = textarea.value
            const newText = text.substring(0, start) + markdown + text.substring(start)
            onContentChange(newText)
          }}
        />

        {/* AI buttons — always available (server proxy or user key) */}
        {(
          <>
            <button
              onClick={handleAIEnhanceClick}
              disabled={isEnhancing}
              className="p-2.5 rounded-lg text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors active:scale-95 disabled:opacity-50"
              title="AI 가독성 편집"
              aria-label="AI 가독성 편집"
            >
              {isEnhancing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Wand2 className="w-5 h-5" />
              )}
            </button>
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

        {/* Slide view button */}
        {onSlideView && (
          <button
            onClick={onSlideView}
            className="p-2.5 rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors active:scale-95"
            title="슬라이드 보기 (F5)"
            aria-label="슬라이드 보기"
          >
            <MonitorPlay className="w-5 h-5" />
          </button>
        )}

        {/* Outline (목차) button — desktop only */}
        {onToggleOutline && (
          <button
            onClick={onToggleOutline}
            className="hidden lg:block p-2.5 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors active:scale-95"
            title="목차 (Outline)"
            aria-label="목차"
          >
            <ListTree className="w-5 h-5" />
          </button>
        )}

        {/* Alter Ego (데미안) button */}
        {alterEgoEnabled && onToggleAlterEgo && (
          <button
            onClick={onToggleAlterEgo}
            className="p-2.5 rounded-lg text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors active:scale-95"
            title="데미안 (AI 대화)"
            aria-label="데미안"
          >
            <Brain className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  )
}
