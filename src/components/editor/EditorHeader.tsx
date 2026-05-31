import { ArrowLeft, Star, MoreVertical, Trash2, Share2, FolderInput, Columns2, Rows2, Maximize2, History, Pin, X, Download, ImagePlus, FileCode2, Type, Copy } from 'lucide-react'
import { useState } from 'react'
import clsx from 'clsx'
import { useMemoStore } from '@/stores/memoStore'
import { useUndoStore } from '@/stores/undoStore'
import { useUIStore } from '@/stores/uiStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useNavigate } from 'react-router-dom'
import { MEMO_COLORS } from '@/utils/constants'
import type { MemoColor, EditorMode } from '@/lib/types'
import { ShareCardModal } from './ShareCardModal'
import { ShareLinkModal } from './ShareLinkModal'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'modified' | 'error'

interface EditorHeaderProps {
  isStarred: boolean
  onBack: () => void
  onToggleStar: () => void
  onOpenVersionHistory?: () => void
  memoId?: number
  saveStatus?: SaveStatus
  title?: string
  body?: string
  tags?: string[]
  isPinned?: boolean
  memoColor?: MemoColor
  onColorChange?: (color: MemoColor) => void
}

export function EditorHeader({ isStarred, onBack, onToggleStar, onOpenVersionHistory, memoId, saveStatus, title, body, tags, isPinned, memoColor, onColorChange }: EditorHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [showShareCard, setShowShareCard] = useState(false)
  const [showShareLink, setShowShareLink] = useState(false)
  const softDelete = useMemoStore((s) => s.softDelete)
  const pushUndo = useUndoStore((s) => s.pushUndo)
  const openFolderSelect = useUIStore((s) => s.openFolderSelect)
  const toggleFocusMode = useUIStore((s) => s.toggleFocusMode)
  const editorMode = useSettingsStore((s) => s.settings.memoSettings.editorMode)
  const setEditorMode = useSettingsStore((s) => s.setEditorMode)
  const navigate = useNavigate()
  const isDesktop = useUIStore((s) => s.isDesktop)
  const isTablet = useUIStore((s) => s.isTablet)
  const isMdUp = isTablet || isDesktop
  // Mode toggle is tier-aware: split needs desktop width, so tablet cycles tabs↔WYSIWYG only.
  const editorModeCycle: EditorMode[] = isDesktop ? ['tabs', 'split', 'tiptap'] : ['tabs', 'tiptap']
  const displayEditorMode: EditorMode = !isDesktop && editorMode === 'split' ? 'tabs' : editorMode
  const nextEditorMode = editorModeCycle[(Math.max(0, editorModeCycle.indexOf(displayEditorMode)) + 1) % editorModeCycle.length]
  const editorModeLabel: Record<EditorMode, string> = { tabs: '탭 모드', split: '분할 모드', tiptap: 'WYSIWYG 모드' }

  const handleDelete = async () => {
    if (!memoId) return
    const deleted = await softDelete(memoId)
    if (deleted) {
      pushUndo({ type: 'delete-memo', memos: [deleted], timestamp: Date.now() })
    }
    navigate('/memos')
  }

  const handleMove = () => {
    if (!memoId) return
    openFolderSelect(memoId)
    setIsMenuOpen(false)
  }

  // UX-19: pin/unpin
  const togglePin = useMemoStore((s) => s.togglePin)

  // UX-17: share with actual memo title/body
  const handleShare = async () => {
    const { shareMemo } = await import('@/utils/share')
    const result = await shareMemo({
      title: title || 'Memo',
      body: body || '',
      url: window.location.href,
    })
    if (result === 'copied') {
      const { useToastStore } = await import('@/stores/toastStore')
      useToastStore.getState().showToast('클립보드에 복사되었습니다', 'success')
    }
    setIsMenuOpen(false)
  }

  const handleTogglePin = () => {
    if (!memoId) return
    togglePin(memoId)
    setIsMenuOpen(false)
  }

  const handleCopyText = async () => {
    setIsMenuOpen(false)
    const parts: string[] = []
    if (title && title.trim()) parts.push(title.trim())
    if (body && body.length) parts.push(body)
    const fullText = parts.join('\n\n')

    const { useToastStore } = await import('@/stores/toastStore')
    if (!fullText) {
      useToastStore.getState().showToast('복사할 내용이 없습니다', 'info')
      return
    }
    const { copyTextToClipboard } = await import('@/utils/share')
    const ok = await copyTextToClipboard(fullText)
    useToastStore.getState().showToast(
      ok ? '전체 텍스트가 복사되었습니다' : '복사에 실패했습니다',
      ok ? 'success' : 'warning',
    )
  }

  const handleExportMarkdown = () => {
    if (!title && !body) return
    const content = `# ${title || '제목 없음'}\n\n${body || ''}`
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title || 'memo'}.md`
    a.click()
    URL.revokeObjectURL(url)
    setIsMenuOpen(false)
  }

  return (
    // UX-21: bg-zinc-50 matches app background
    <div className="flex items-center justify-between px-4 py-3 bg-zinc-50 dark:bg-zinc-900 sticky top-0 z-10">
      <div className="flex items-center gap-2">
        {/* Mobile: back arrow */}
        <button
          onClick={onBack}
          className="f-icon-btn lg:hidden -ml-2"
          aria-label="뒤로가기"
        >
          <ArrowLeft className="f-icon--default w-5 h-5" />
        </button>

        {saveStatus && saveStatus !== 'idle' && (
          <span className="flex items-center gap-1.5 transition-opacity duration-200" aria-live="polite" role="status">
            {saveStatus === 'saving' && (
              <>
                <svg className="h-4 w-4 animate-progress-spin text-primary-500" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" opacity="0.25" />
                  <path d="M14 8a6 6 0 0 0-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <span className="text-xs font-medium text-primary-500">저장 중</span>
              </>
            )}
            {saveStatus === 'saved' && (
              <span className="animate-save-fadeout flex items-center gap-1.5">
                <svg className="h-4 w-4 text-success-500" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M3 8.5l3.5 3.5L13 5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="24"
                    className="animate-draw-check"
                  />
                </svg>
                <span className="text-xs font-medium text-success-500">저장됨</span>
              </span>
            )}
            {saveStatus === 'modified' && (
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500 animate-pulse" />
                <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500">수정됨</span>
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-danger-500" />
                <span className="text-xs font-medium text-danger-500">저장 실패</span>
              </span>
            )}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1">
        {/* Desktop: close button (modal) */}
        <button
          onClick={onBack}
          className="f-icon-btn hidden lg:inline-flex"
          aria-label="닫기"
        >
          <X className="f-icon--muted w-5 h-5" />
        </button>

        {/* Editor mode toggle — tablet & desktop only (conditional render; CSS `hidden`
            is unreliable here because .f-icon-btn sets its own display). Tier-aware cycle. */}
        {isMdUp && (
          <button
            onClick={() => setEditorMode(nextEditorMode)}
            className="f-icon-btn"
            aria-label={`${editorModeLabel[nextEditorMode]}로 전환`}
            title={`${editorModeLabel[nextEditorMode]}로 전환`}
          >
            {displayEditorMode === 'tiptap' ? (
              <Type className="f-icon--muted w-5 h-5" />
            ) : displayEditorMode === 'split' ? (
              <Rows2 className="f-icon--muted w-5 h-5" />
            ) : (
              <Columns2 className="f-icon--muted w-5 h-5" />
            )}
          </button>
        )}

        {/* Memo color selector */}
        {onColorChange && (
          <div className="relative">
            <button
              onClick={() => setShowColorPicker(!showColorPicker)}
              className="f-icon-btn"
              aria-label="메모 색상 변경"
            >
              <span
                className="block w-4 h-4 rounded-full ring-1 ring-zinc-300 dark:ring-zinc-600"
                style={{ backgroundColor: MEMO_COLORS[memoColor || 'white'] }}
              />
            </button>
            {showColorPicker && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setShowColorPicker(false)} />
                <div className="ctx-menu absolute right-0 top-full mt-1 flex gap-1.5 z-30">
                  {(Object.keys(MEMO_COLORS) as MemoColor[]).map((c) => (
                    <button
                      key={c}
                      onClick={() => { onColorChange(c); setShowColorPicker(false) }}
                      className={clsx(
                        'w-6 h-6 rounded-full transition-all',
                        memoColor === c ? 'ring-2 ring-primary-500 scale-110' : 'ring-1 ring-zinc-200 dark:ring-zinc-600 hover:scale-105'
                      )}
                      style={{ backgroundColor: MEMO_COLORS[c] }}
                      aria-label={`${c} 색상`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        <button
          onClick={onToggleStar}
          className="f-icon-btn"
          aria-label={isStarred ? '중요 해제' : '중요 표시'}
        >
          <Star
            className={`w-5 h-5 ${
              isStarred
                ? 'fill-primary-500 text-primary-500'
                : 'text-zinc-400 dark:text-zinc-500'
            }`}
          />
        </button>

        <div className="relative">
          {/* A11Y-06: aria-haspopup + aria-expanded */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="f-icon-btn"
            aria-label="더보기"
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
          >
            <MoreVertical className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
          </button>

          {isMenuOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setIsMenuOpen(false)} />
              {/* A11Y-06: role="menu" + role="menuitem" */}
              <div className="ctx-menu absolute right-0 top-full mt-1 z-30 min-w-[170px]" role="menu">
                <button
                  onClick={() => { toggleFocusMode(); setIsMenuOpen(false) }}
                  className="ctx-menu__item w-full"
                  role="menuitem"
                >
                  <Maximize2 className="w-4 h-4" />
                  집중 모드
                </button>
                {/* UX-19: Pin/unpin toggle */}
                {memoId && (
                  <button
                    onClick={handleTogglePin}
                    className="ctx-menu__item w-full"
                    role="menuitem"
                  >
                    <Pin className="w-4 h-4" />
                    {isPinned ? '고정 해제' : '상단 고정'}
                  </button>
                )}
                {memoId && onOpenVersionHistory && (
                  <button
                    onClick={() => { onOpenVersionHistory(); setIsMenuOpen(false) }}
                    className="ctx-menu__item w-full"
                    role="menuitem"
                  >
                    <History className="w-4 h-4" />
                    버전 기록
                  </button>
                )}
                <button
                  onClick={handleMove}
                  className="ctx-menu__item w-full"
                  role="menuitem"
                >
                  <FolderInput className="w-4 h-4" />
                  폴더 이동
                </button>
                <button
                  onClick={handleShare}
                  className="ctx-menu__item w-full"
                  role="menuitem"
                >
                  <Share2 className="w-4 h-4" />
                  공유
                </button>
                <button
                  onClick={() => { setShowShareCard(true); setIsMenuOpen(false) }}
                  className="ctx-menu__item w-full"
                  role="menuitem"
                >
                  <ImagePlus className="w-4 h-4" />
                  카드로 공유
                </button>
                <button
                  onClick={() => { setShowShareLink(true); setIsMenuOpen(false) }}
                  className="ctx-menu__item w-full"
                  role="menuitem"
                >
                  <FileCode2 className="w-4 h-4" />
                  링크로 공유
                </button>
                <button
                  onClick={handleCopyText}
                  className="ctx-menu__item w-full"
                  role="menuitem"
                >
                  <Copy className="w-4 h-4" />
                  전체 텍스트 복사
                </button>
                <button
                  onClick={handleExportMarkdown}
                  className="ctx-menu__item w-full"
                  role="menuitem"
                >
                  <Download className="w-4 h-4" />
                  마크다운 내보내기
                </button>
                <button
                  onClick={handleDelete}
                  className="ctx-menu__item ctx-menu__item--danger w-full"
                  role="menuitem"
                >
                  <Trash2 className="w-4 h-4" />
                  삭제
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      {showShareCard && (
        <ShareCardModal
          isOpen={showShareCard}
          onClose={() => setShowShareCard(false)}
          title={title || ''}
          body={body || ''}
          tags={tags || []}
          color={memoColor || 'white'}
          date={new Date().toISOString()}
        />
      )}
      {showShareLink && (
        <ShareLinkModal
          isOpen={showShareLink}
          onClose={() => setShowShareLink(false)}
          title={title || ''}
          body={body || ''}
          tags={tags || []}
        />
      )}
    </div>
  )
}
