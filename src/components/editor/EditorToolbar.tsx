import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import clsx from 'clsx'
import { useUIStore } from '@/stores/uiStore'
import { useToastStore } from '@/stores/toastStore'
import { Tooltip } from '@/components/ui/Tooltip'
import { Kbd } from '@/components/ui/Kbd'
import { ImageInsertButton } from './ImageInsertButton'
import { LinkPopover } from './LinkPopover'
import { enhanceReadability } from '@/services/aiFeatures'
import type { Editor } from '@tiptap/react'
import { IcFillPlay, IcLineCamera, IcLineChevronDown, IcLineLoading, IcLineMic, IcLineRedo, IcLineRewrite, IcLineUndo, IcMwCode, IcMwLink, IcMwList, IcMwSpark } from '@/mw/icons'
import { FormatGlyph } from '@/components/editor/FormatGlyph'

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
  onOpenCommandPalette?: () => void
  // 'keyboard' = compact, focus-preserving bar pinned above the soft keyboard (mobile/tablet)
  variant?: 'default' | 'keyboard'
  onDismissKeyboard?: () => void
}

// 도구 막대의 버튼은 키트의 아이콘 버튼이에요. 켜진 서식(굵게 등)은 aria-pressed와 memo-tool--on으로 알려요.
const toolBtnBase = 'mw-icon-button'
const toolBtnDefault = ''
const toolBtnActive = 'memo-tool--on'
const toolBtnAccent = 'memo-tool--accent'
const toolSep = 'h-5 w-px bg-zinc-200/70 dark:bg-zinc-700/70 mx-1 shrink-0'
const toolIcon = undefined

// 툴팁 내용: 라벨 + (있으면) 단축키 칩 — 네이티브 title 대체
const tip = (label: string, kbd?: string): ReactNode =>
  kbd ? (
    <span className="flex items-center gap-1.5">
      {label}
      <Kbd>{kbd}</Kbd>
    </span>
  ) : (
    label
  )

// 가로 스크롤 툴바의 가장자리 페이드 — 숨긴 스크롤바 대신
// 넘친 방향에만 마스크를 걸어 화면 밖 도구의 존재를 드러낸다
function useEdgeFade<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [fade, setFade] = useState({ left: false, right: false })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      const left = el.scrollLeft > 4
      const right = el.scrollLeft < el.scrollWidth - el.clientWidth - 4
      setFade((prev) => (prev.left === left && prev.right === right ? prev : { left, right }))
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => {
      el.removeEventListener('scroll', update)
      observer.disconnect()
    }
  }, [])

  const mask =
    fade.left || fade.right
      ? `linear-gradient(to right, ${fade.left ? 'transparent, black 24px' : 'black'}, ${
          fade.right ? 'black calc(100% - 24px), transparent' : 'black'
        })`
      : undefined

  return {
    ref,
    style: mask ? ({ maskImage: mask, WebkitMaskImage: mask } as React.CSSProperties) : undefined,
  }
}

export function EditorToolbar({ textareaRef, onContentChange, tiptapEditor, onUndo, onRedo, canUndo, canRedo, memoId, body, onAIEnhance, onToggleAlterEgo, alterEgoEnabled, onToggleOutline, onSlideView, onOpenCommandPalette, variant = 'default', onDismissKeyboard }: EditorToolbarProps) {
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set())
  const [isEnhancing, setIsEnhancing] = useState(false)
  // 링크 팝오버 — 선택 영역 좌표에 앵커 (Tiptap 모드 전용, prompt() 대체)
  const [linkState, setLinkState] = useState<{ top: number; left: number; url: string; isActive: boolean } | null>(null)
  const edgeFade = useEdgeFade<HTMLDivElement>()

  const handleAIEnhanceClick = async () => {
    if (!body || body.trim().length < 20) {
      useToastStore.getState().showToast('내용이 너무 짧아요. 20자 이상 적어 주세요', 'warning')
      return
    }
    if (isEnhancing) return
    setIsEnhancing(true)
    const result = await enhanceReadability(body)
    setIsEnhancing(false)
    if (result.error) {
      // 하루 한도에 걸렸을 때는 한도 알림이 이미 떴어요. 안쪽 코드 이름을 다시 보여 주지 않아요
      if (result.error !== 'daily_limit_exceeded') useToastStore.getState().showToast(`AI 편집을 하지 못했어요. ${result.error}`, 'error')
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

  // UX-02: shortcut hints in tooltips (kbd)
  const e = tiptapEditor
  const tools = [
    { icon: <FormatGlyph kind="bold" />, label: '굵게', kbd: 'Ctrl+B', formatKey: 'bold', action: () => e ? e.chain().focus().toggleBold().run() : insertAtCursor('**', '**') },
    { icon: <FormatGlyph kind="italic" />, label: '기울임', kbd: 'Ctrl+I', formatKey: 'italic', action: () => e ? e.chain().focus().toggleItalic().run() : insertAtCursor('*', '*') },
    { icon: <IcMwCode className={toolIcon} />, label: '인라인 코드', kbd: 'Ctrl+E', formatKey: 'code', action: () => e ? e.chain().focus().toggleCode().run() : insertAtCursor('`', '`') },
    { icon: <IcMwLink className={toolIcon} />, label: '링크', kbd: 'Ctrl+K', formatKey: 'link', action: () => {
      if (e) {
        // 선택 영역(버블 메뉴 위치)에 앵커드 팝오버 — 기존 링크면 href 프리필 + 해제 행
        const coords = e.view.coordsAtPos(e.state.selection.from)
        setLinkState({
          top: coords.bottom + 8,
          left: coords.left,
          url: (e.getAttributes('link').href as string) || '',
          isActive: e.isActive('link'),
        })
      } else {
        insertAtCursor('[', '](url)')
      }
    } },
    { icon: <IcMwList className={toolIcon} />, label: '목록', kbd: undefined, formatKey: 'list', action: () => e ? e.chain().focus().toggleBulletList().run() : insertAtCursor('- ') },
    { icon: <FormatGlyph kind="heading" />, label: '제목', kbd: undefined, formatKey: 'heading', action: () => e ? e.chain().focus().toggleHeading({ level: 2 }).run() : insertAtCursor('## ') },
  ]

  const linkPopoverEl = linkState && e && (
    <LinkPopover
      position={linkState}
      initialUrl={linkState.url}
      onSubmit={(href) => {
        e.chain().focus().extendMarkRange('link').setLink({ href }).run()
        setLinkState(null)
      }}
      onUnlink={
        linkState.isActive
          ? () => {
              e.chain().focus().extendMarkRange('link').unsetLink().run()
              setLinkState(null)
            }
          : undefined
      }
      onClose={() => {
        setLinkState(null)
        e.commands.focus()
      }}
    />
  )

  // Compact accessory bar pinned above the soft keyboard. Container-level
  // onMouseDown preventDefault keeps the editor focused (keyboard stays open) when
  // tapping format buttons; the dismiss button explicitly blurs to close the keyboard.
  if (variant === 'keyboard') {
    return (
      <div
        ref={edgeFade.ref}
        style={edgeFade.style}
        className="flex items-center gap-0.5 px-4 py-1 bg-zinc-50/95 dark:bg-zinc-900/95 backdrop-blur-md border-t border-zinc-200 dark:border-zinc-800 overflow-x-auto scrollbar-none pb-[env(safe-area-inset-bottom,0px)]"
        onMouseDown={(ev) => ev.preventDefault()}
      >
        {onUndo && (
          <>
            <button onClick={onUndo} disabled={!canUndo} className={clsx(toolBtnBase, toolBtnDefault)} aria-label="실행 취소"><IcLineUndo className={toolIcon} /></button>
            <button onClick={onRedo} disabled={!canRedo} className={clsx(toolBtnBase, toolBtnDefault)} aria-label="다시 실행"><IcLineRedo className={toolIcon} /></button>
            <div className={toolSep} />
          </>
        )}
        {tools.map((tool) => {
          const active = activeFormats.has(tool.formatKey)
          return (
            <button
              key={tool.label}
              onClick={tool.action}
              aria-pressed={active}
              className={clsx(toolBtnBase, active ? toolBtnActive : toolBtnDefault)}
              aria-label={tool.label}
            >
              {tool.icon}
            </button>
          )
        })}
        <div className="flex-1" />
        {onDismissKeyboard && (
          <button
            onClick={onDismissKeyboard}
            className={clsx(toolBtnBase, toolBtnDefault)}
            aria-label="키보드 닫기"
          >
            <IcLineChevronDown className={toolIcon} />
          </button>
        )}
        {linkPopoverEl}
      </div>
    )
  }

  return (
    <div
      ref={edgeFade.ref}
      style={edgeFade.style}
      className="bg-zinc-50/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200/60 dark:border-zinc-800 shrink-0 overflow-x-auto scrollbar-none"
    >
      <div className="flex items-center justify-center gap-0.5 px-4 py-1.5 w-max min-w-full mx-auto">
        {/* Group: history */}
        {onUndo && (
          <>
            <Tooltip content={tip('실행 취소', 'Ctrl+Z')}>
              <button
                onClick={onUndo}
                disabled={!canUndo}
                className={clsx(toolBtnBase, toolBtnDefault)}
                aria-label="실행 취소"
              >
                <IcLineUndo className={toolIcon} />
              </button>
            </Tooltip>
            <Tooltip content={tip('다시 실행', 'Ctrl+Shift+Z')}>
              <button
                onClick={onRedo}
                disabled={!canRedo}
                className={clsx(toolBtnBase, toolBtnDefault)}
                aria-label="다시 실행"
              >
                <IcLineRedo className={toolIcon} />
              </button>
            </Tooltip>
            <div className={toolSep} />
          </>
        )}

        {/* Group: formatting */}
        {tools.map((tool) => {
          const active = activeFormats.has(tool.formatKey)
          return (
            <Tooltip key={tool.label} content={tip(tool.label, tool.kbd)}>
              <button
                onClick={tool.action}
                aria-pressed={active}
                className={clsx(toolBtnBase, active ? toolBtnActive : toolBtnDefault)}
                aria-label={tool.label}
              >
                {tool.icon}
              </button>
            </Tooltip>
          )
        })}

        {/* Group: insert */}
        <div className={toolSep} />
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

        {/* Group: AI — accent-tinted (server proxy or user key) */}
        <div className={toolSep} />
        <Tooltip content="AI 가독성 편집">
          <button
            onClick={handleAIEnhanceClick}
            disabled={isEnhancing}
            className={clsx(toolBtnBase, toolBtnAccent)}
            aria-label="AI 가독성 편집"
          >
            {isEnhancing ? (
              <IcLineLoading className={clsx(toolIcon, 'animate-spin')} />
            ) : (
              <IcLineRewrite className={toolIcon} />
            )}
          </button>
        </Tooltip>
        <Tooltip content="음성 입력">
          <button
            onClick={handleMicClick}
            className={clsx(toolBtnBase, toolBtnAccent)}
            aria-label="음성 입력"
          >
            <IcLineMic className={toolIcon} />
          </button>
        </Tooltip>
        <Tooltip content="이미지 OCR">
          <button
            onClick={handleCameraClick}
            className={clsx(toolBtnBase, toolBtnAccent)}
            aria-label="이미지 OCR"
          >
            <IcLineCamera className={toolIcon} />
          </button>
        </Tooltip>

        {/* Group: view */}
        {(onOpenCommandPalette || onSlideView || onToggleOutline || (alterEgoEnabled && onToggleAlterEgo)) && <div className={toolSep} />}
        {onOpenCommandPalette && (
          <Tooltip content="명령 팔레트">
            <button
              onClick={onOpenCommandPalette}
              className={clsx(toolBtnBase, toolBtnDefault)}
              aria-label="명령 팔레트"
            >
              <span className="memo-glyph" aria-hidden="true">⌘</span>
            </button>
          </Tooltip>
        )}
        {onSlideView && (
          <Tooltip content={tip('슬라이드 보기', 'F5')}>
            <button
              onClick={onSlideView}
              className={clsx(toolBtnBase, toolBtnDefault)}
              aria-label="슬라이드 보기"
            >
              <IcFillPlay className={toolIcon} />
            </button>
          </Tooltip>
        )}
        {onToggleOutline && (
          <Tooltip content="목차">
            <button
              onClick={onToggleOutline}
              className={clsx(toolBtnBase, toolBtnDefault)}
              aria-label="목차"
            >
              <IcMwList className={toolIcon} />
            </button>
          </Tooltip>
        )}
        {alterEgoEnabled && onToggleAlterEgo && (
          <Tooltip content="데미안 (AI 대화)">
            <button
              onClick={onToggleAlterEgo}
              className={clsx(toolBtnBase, 'text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-500/10 dark:text-purple-400')}
              aria-label="데미안"
            >
              <IcMwSpark className={toolIcon} />
            </button>
          </Tooltip>
        )}
      </div>
      {linkPopoverEl}
    </div>
  )
}
