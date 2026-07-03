import { useState, useEffect, useCallback, useRef, type MutableRefObject } from 'react'
import { createPortal } from 'react-dom'
import { Bold, Italic, Code, Link2 } from 'lucide-react'
import { isIOS } from '@/utils/platform'

interface FloatingToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  onInsert: (before: string, after?: string) => void
}

export function FloatingToolbar({ textareaRef, onInsert }: FloatingToolbarProps) {
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const toolbarRef = useRef<HTMLDivElement>(null)
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null) as MutableRefObject<ReturnType<typeof setTimeout> | null>
  const iosSelectTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null) as MutableRefObject<ReturnType<typeof setTimeout> | null>

  const updatePosition = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd

    if (start === end) {
      setVisible(false)
      return
    }

    const rect = textarea.getBoundingClientRect()
    const style = getComputedStyle(textarea)
    const lineHeight = parseFloat(style.lineHeight) || 24
    const paddingTop = parseFloat(style.paddingTop) || 0

    // Anchor to the first line of the selection (slash-menu와 동일한 라인 계산 기법):
    // 논리 라인 수 × line-height − scrollTop → 선택 시작 지점의 y 좌표
    const startLine = textarea.value.substring(0, Math.min(start, end)).split('\n').length - 1
    const caretY = rect.top + paddingTop + startLine * lineHeight - textarea.scrollTop
    // 선택 라인이 스크롤로 화면 밖이면 textarea 경계로 클램프
    const anchorY = Math.min(Math.max(caretY, rect.top), rect.bottom)
    const top = Math.max(8, anchorY - 48) + window.scrollY
    const left = Math.min(window.innerWidth - 100, Math.max(70, rect.left + rect.width / 2))

    setPosition({ top, left })
    setVisible(true)
  }, [textareaRef])

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    const handleSelect = () => {
      if (isIOS()) {
        // Delay on iOS to let native Copy/Paste/Select All popover appear first
        if (iosSelectTimeoutRef.current) clearTimeout(iosSelectTimeoutRef.current)
        iosSelectTimeoutRef.current = setTimeout(() => {
          const sel = window.getSelection()
          if (sel && !sel.isCollapsed && document.activeElement === textarea) {
            requestAnimationFrame(updatePosition)
          }
        }, 350)
      } else {
        requestAnimationFrame(updatePosition)
      }
    }

    const handleBlur = (e: FocusEvent) => {
      // Don't hide if clicking toolbar
      if (e.relatedTarget && toolbarRef.current?.contains(e.relatedTarget as Node)) return
      blurTimeoutRef.current = setTimeout(() => setVisible(false), 150)
    }

    const handleDocumentSelection = () => {
      const selection = window.getSelection()
      if (!selection || selection.isCollapsed) {
        setVisible(false)
        return
      }
      if (document.activeElement === textarea) {
        requestAnimationFrame(updatePosition)
      }
    }

    // On iOS, hide toolbar on new touch to prevent stale positioning
    const handleTouchStart = isIOS() ? () => setVisible(false) : null

    textarea.addEventListener('select', handleSelect)
    textarea.addEventListener('mouseup', handleSelect)
    textarea.addEventListener('keyup', handleSelect)
    textarea.addEventListener('touchend', handleSelect)
    textarea.addEventListener('blur', handleBlur)
    document.addEventListener('selectionchange', handleDocumentSelection)
    if (handleTouchStart) textarea.addEventListener('touchstart', handleTouchStart)

    return () => {
      textarea.removeEventListener('select', handleSelect)
      textarea.removeEventListener('mouseup', handleSelect)
      textarea.removeEventListener('keyup', handleSelect)
      textarea.removeEventListener('touchend', handleSelect)
      textarea.removeEventListener('blur', handleBlur)
      document.removeEventListener('selectionchange', handleDocumentSelection)
      if (handleTouchStart) textarea.removeEventListener('touchstart', handleTouchStart)
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current)
      if (iosSelectTimeoutRef.current) clearTimeout(iosSelectTimeoutRef.current)
    }
  }, [textareaRef, updatePosition])

  if (!visible) return null

  const tools = [
    { icon: <Bold className="w-4 h-4" />, label: '굵게', action: () => onInsert('**', '**') },
    { icon: <Italic className="w-4 h-4" />, label: '기울임', action: () => onInsert('*', '*') },
    { icon: <Code className="w-4 h-4" />, label: '코드', action: () => onInsert('`', '`') },
    { icon: <Link2 className="w-4 h-4" />, label: '링크', action: () => onInsert('[', '](url)') },
  ]

  return createPortal(
    <div
      ref={toolbarRef}
      className="fixed z-[var(--z-modal)] flex items-center gap-0.5 rounded-xl bg-zinc-900 dark:bg-zinc-100 px-1 py-1 shadow-xl ring-1 ring-white/10 dark:ring-black/10 animate-in fade-in slide-in-from-bottom-1 duration-150 ease-enter"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        transform: 'translateX(-50%)',
      }}
    >
      {tools.map((tool) => (
        <button
          key={tool.label}
          onMouseDown={(e) => {
            e.preventDefault()
            tool.action()
          }}
          className="p-1.5 rounded-lg text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors active:scale-[0.94] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 dark:focus-visible:ring-primary-500"
          aria-label={tool.label}
        >
          {tool.icon}
        </button>
      ))}
      {/* 선택 영역을 가리키는 앵커 노치 */}
      <span
        aria-hidden="true"
        className="absolute left-1/2 top-full -ml-1 -mt-[3px] h-2 w-2 rotate-45 rounded-[1px] bg-zinc-900 dark:bg-zinc-100"
      />
    </div>,
    document.body
  )
}
