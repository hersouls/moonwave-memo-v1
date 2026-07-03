import { useEffect, useRef, useState, useCallback } from 'react'
import { EditorContent, type Editor } from '@tiptap/react'
import { BubbleMenuPlugin } from '@tiptap/extension-bubble-menu'
import { Bold, Italic, Code, Strikethrough, Link2 } from 'lucide-react'
import clsx from 'clsx'
import { LinkPopover } from './LinkPopover'
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
  // 링크 팝오버 — 선택 영역 좌표에 앵커 (prompt() 대체)
  const [linkState, setLinkState] = useState<{ top: number; left: number; url: string; isActive: boolean } | null>(null)

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

  // 버블 메뉴 등장 모션 — 플러그인이 inline visibility만 토글하므로,
  // hidden → visible 전환 시점에 enter 키프레임(bubbleIn)을 재생한다
  useEffect(() => {
    const el = menuRef.current
    if (!el) return
    let wasVisible = el.style.visibility !== 'hidden'
    const observer = new MutationObserver(() => {
      const isVisible = el.style.visibility !== 'hidden'
      if (isVisible && !wasVisible) {
        el.style.animation = 'none'
        void el.offsetWidth // reflow로 키프레임 재시작
        el.style.animation = ''
      }
      wasVisible = isVisible
    })
    observer.observe(el, { attributes: true, attributeFilter: ['style'] })
    return () => observer.disconnect()
  }, [])

  const handleLinkClick = () => {
    const coords = editor.view.coordsAtPos(editor.state.selection.from)
    setLinkState({
      top: coords.bottom + 8,
      left: coords.left,
      url: (editor.getAttributes('link').href as string) || '',
      isActive: editor.isActive('link'),
    })
  }

  const tools = [
    { icon: <Bold className="w-4 h-4" />, label: '굵게', action: () => editor.chain().focus().toggleBold().run(), active: editor.isActive('bold') },
    { icon: <Italic className="w-4 h-4" />, label: '기울임', action: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive('italic') },
    { icon: <Strikethrough className="w-4 h-4" />, label: '취소선', action: () => editor.chain().focus().toggleStrike().run(), active: editor.isActive('strike') },
    { icon: <Code className="w-4 h-4" />, label: '코드', action: () => editor.chain().focus().toggleCode().run(), active: editor.isActive('code') },
    { icon: <Link2 className="w-4 h-4" />, label: '링크', action: handleLinkClick, active: editor.isActive('link') },
  ]

  return (
    <>
      <div
        ref={menuRef}
        className="bubble-menu-enter flex items-center gap-0.5 rounded-xl bg-zinc-900 dark:bg-zinc-100 px-1 py-1 shadow-xl ring-1 ring-white/10 dark:ring-black/10"
        style={{ visibility: 'hidden', position: 'absolute', zIndex: 'var(--z-modal)' }}
      >
        {tools.map((tool) => (
          <button
            key={tool.label}
            onMouseDown={(e) => { e.preventDefault(); tool.action() }}
            className={clsx(
              'p-1.5 rounded-lg transition-colors active:scale-[0.94] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 dark:focus-visible:ring-primary-500',
              tool.active
                ? 'bg-zinc-700 text-white dark:bg-zinc-300 dark:text-zinc-900'
                : 'text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300'
            )}
            aria-label={tool.label}
          >
            {tool.icon}
          </button>
        ))}
      </div>
      {linkState && (
        <LinkPopover
          position={linkState}
          initialUrl={linkState.url}
          onSubmit={(href) => {
            editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
            setLinkState(null)
          }}
          onUnlink={
            linkState.isActive
              ? () => {
                  editor.chain().focus().extendMarkRange('link').unsetLink().run()
                  setLinkState(null)
                }
              : undefined
          }
          onClose={() => {
            setLinkState(null)
            editor.commands.focus()
          }}
        />
      )}
    </>
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
