import { useEffect, useRef, useState, useCallback } from 'react'
import { EditorContent, type Editor } from '@tiptap/react'
import { BubbleMenuPlugin } from '@tiptap/extension-bubble-menu'
import { Bold, Italic, Code, Strikethrough, Link2 } from 'lucide-react'
import clsx from 'clsx'
import '@/styles/tiptap-editor.css'

interface TiptapEditorContentProps {
  editor: Editor | null
  fontFamily: string
  isBreathing: boolean
  className?: string
}

function TiptapBubbleMenu({ editor }: { editor: Editor }) {
  const menuRef = useRef<HTMLDivElement>(null)
  // Force re-render on selection/transaction changes so active states stay current
  const [, setTick] = useState(0)
  const forceUpdate = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    if (!menuRef.current) return
    const plugin = BubbleMenuPlugin({
      pluginKey: 'bubbleMenu',
      editor,
      element: menuRef.current,
    })
    editor.registerPlugin(plugin)
    return () => {
      editor.unregisterPlugin('bubbleMenu')
    }
  }, [editor])

  // Listen to editor events to keep active states in sync
  useEffect(() => {
    editor.on('selectionUpdate', forceUpdate)
    editor.on('transaction', forceUpdate)
    return () => {
      editor.off('selectionUpdate', forceUpdate)
      editor.off('transaction', forceUpdate)
    }
  }, [editor, forceUpdate])

  const handleLinkClick = () => {
    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run()
      return
    }
    const url = prompt('URL을 입력하세요:')
    if (url) {
      editor.chain().focus().setLink({ href: url }).run()
    }
  }

  const tools = [
    { icon: <Bold className="w-4 h-4" />, label: '굵게', action: () => editor.chain().focus().toggleBold().run(), active: editor.isActive('bold') },
    { icon: <Italic className="w-4 h-4" />, label: '기울임', action: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive('italic') },
    { icon: <Strikethrough className="w-4 h-4" />, label: '취소선', action: () => editor.chain().focus().toggleStrike().run(), active: editor.isActive('strike') },
    { icon: <Code className="w-4 h-4" />, label: '코드', action: () => editor.chain().focus().toggleCode().run(), active: editor.isActive('code') },
    { icon: <Link2 className="w-4 h-4" />, label: '링크', action: handleLinkClick, active: editor.isActive('link') },
  ]

  return (
    <div
      ref={menuRef}
      className="flex items-center gap-0.5 rounded-xl bg-zinc-900 dark:bg-zinc-100 px-1 py-1 shadow-xl"
      style={{ visibility: 'hidden', position: 'absolute', zIndex: 50 }}
    >
      {tools.map((tool) => (
        <button
          key={tool.label}
          onMouseDown={(e) => { e.preventDefault(); tool.action() }}
          className={clsx(
            'p-1.5 rounded-lg transition-colors',
            tool.active
              ? 'bg-zinc-700 text-white dark:bg-zinc-300 dark:text-zinc-900'
              : 'text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300'
          )}
          title={tool.label}
          aria-label={tool.label}
        >
          {tool.icon}
        </button>
      ))}
    </div>
  )
}

export function TiptapEditorContent({
  editor,
  fontFamily,
  isBreathing,
  className,
}: TiptapEditorContentProps) {
  if (!editor) return null

  return (
    <div className={clsx('relative flex-1 flex flex-col min-h-0', isBreathing && 'breathing-active')}>
      <TiptapBubbleMenu editor={editor} />
      <EditorContent
        editor={editor}
        className={clsx(
          'tiptap-editor memo-markdown-preview flex-1 min-h-0 overflow-y-auto',
          className
        )}
        style={{ fontFamily }}
      />
    </div>
  )
}
