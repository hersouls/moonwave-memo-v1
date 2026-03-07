import { useState, useEffect, useCallback, useRef, type MutableRefObject } from 'react'
import { createPortal } from 'react-dom'
import { Bold, Italic, Code, Link2 } from 'lucide-react'

interface FloatingToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  onInsert: (before: string, after?: string) => void
}

export function FloatingToolbar({ textareaRef, onInsert }: FloatingToolbarProps) {
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const toolbarRef = useRef<HTMLDivElement>(null)
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null) as MutableRefObject<ReturnType<typeof setTimeout> | null>

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
    // Approximate position: center of textarea horizontally, above it
    const top = rect.top - 44 + window.scrollY
    const left = rect.left + rect.width / 2

    setPosition({ top: Math.max(8, top), left })
    setVisible(true)
  }, [textareaRef])

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    const handleSelect = () => {
      requestAnimationFrame(updatePosition)
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

    textarea.addEventListener('select', handleSelect)
    textarea.addEventListener('mouseup', handleSelect)
    textarea.addEventListener('keyup', handleSelect)
    textarea.addEventListener('touchend', handleSelect)
    textarea.addEventListener('blur', handleBlur)
    document.addEventListener('selectionchange', handleDocumentSelection)

    return () => {
      textarea.removeEventListener('select', handleSelect)
      textarea.removeEventListener('mouseup', handleSelect)
      textarea.removeEventListener('keyup', handleSelect)
      textarea.removeEventListener('touchend', handleSelect)
      textarea.removeEventListener('blur', handleBlur)
      document.removeEventListener('selectionchange', handleDocumentSelection)
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current)
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
      className="fixed z-50 flex items-center gap-0.5 rounded-xl bg-zinc-900 dark:bg-zinc-100 px-1 py-1 shadow-xl animate-in fade-in slide-in-from-bottom duration-150"
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
          className="p-1.5 rounded-lg text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
          title={tool.label}
          aria-label={tool.label}
        >
          {tool.icon}
        </button>
      ))}
    </div>,
    document.body
  )
}
