import { useEffect, useRef } from 'react'
import { useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import Link from '@tiptap/extension-link'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { common, createLowlight } from 'lowlight'
import { Markdown } from 'tiptap-markdown'

const lowlight = createLowlight(common)

interface UseTiptapEditorOptions {
  initialContent: string
  placeholder?: string
  onUpdate: (markdown: string) => void
  editable?: boolean
}

export function useTiptapEditor({
  initialContent,
  placeholder = '메모를 입력하세요...',
  onUpdate,
  editable = true,
}: UseTiptapEditorOptions) {
  const onUpdateRef = useRef(onUpdate)
  onUpdateRef.current = onUpdate

  const lastEmittedRef = useRef(initialContent)
  const isExternalUpdateRef = useRef(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        undoRedo: { depth: 50 },
        codeBlock: false, // Replaced by CodeBlockLowlight
      }),
      CodeBlockLowlight.configure({ lowlight }),
      // WYSIWYG 체크리스트 — tiptap-markdown이 GFM `- [ ]` 구문으로 직렬화/파싱
      TaskList,
      TaskItem.configure({ nested: true }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'tiptap-link' },
      }),
      Placeholder.configure({ placeholder }),
      CharacterCount,
      Markdown.configure({
        html: false,
        tightLists: true,
        tightListClass: 'tight',
        bulletListMarker: '-',
        linkify: false,
        breaks: true,
        transformPastedText: true,
        transformCopiedText: true,
      }),
    ],
    content: initialContent,
    editable,
    onUpdate: ({ editor }: { editor: any }) => {
      if (isExternalUpdateRef.current) return
      const markdown = (editor.storage as any)?.markdown?.getMarkdown() ?? ''
      lastEmittedRef.current = markdown
      onUpdateRef.current(markdown)
    },
  })

  // Sync external content changes (version restore, AI enhance) into the editor
  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    if (initialContent === lastEmittedRef.current) return

    isExternalUpdateRef.current = true
    editor.commands.setContent(initialContent)
    lastEmittedRef.current = initialContent
    isExternalUpdateRef.current = false
  }, [initialContent, editor])

  const characterCount = editor?.storage.characterCount?.characters() ?? 0

  return { editor, characterCount }
}
