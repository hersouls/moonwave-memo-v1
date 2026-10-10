import { useState } from 'react'
import { useMemoStore } from '@/stores/memoStore'
import { useUndoStore } from '@/stores/undoStore'
import { useUIStore } from '@/stores/uiStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useNavigate } from 'react-router-dom'
import type { EditorMode } from '@/lib/types'
import { ShareCardModal } from './ShareCardModal'
import { ShareLinkModal } from './ShareLinkModal'
import { IcLineChevronLeft, IcLineClose, IcLineDownload, IcLineDuplicate, IcLineExpand, IcLineFolder, IcLineGallery, IcLineMore, IcLinePin, IcLineShare, IcLineTextAdjust, IcLineTrash, IcMwCode, IcMwColumns, IcMwHistory, IcMwList, IcMwStar } from '@/mw/icons'

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
}

export function EditorHeader({ isStarred, onBack, onToggleStar, onOpenVersionHistory, memoId, saveStatus, title, body, tags, isPinned }: EditorHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
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
  const isMdUp = isDesktop
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
    <div className="flex items-center justify-between px-4 py-2 bg-zinc-50 dark:bg-zinc-900 sticky top-0 z-10">
      <div className="flex items-center gap-2">
        {/* Mobile/tablet: back arrow. 조건부 렌더 — .f-icon-btn이 display를 강제해
            lg:hidden 유틸리티가 무력화되므로 CSS 대신 tier 플래그로 분기한다. */}
        {!isDesktop && (
          <button
            onClick={onBack}
            className="mw-icon-button -ml-2"
            aria-label="뒤로가기"
          >
            <IcLineChevronLeft size={20} />
          </button>
        )}

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
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">수정됨</span>
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
        {/* Desktop only: close button (modal). 조건부 렌더 — lg:inline-flex가
            .f-icon-btn 때문에 모바일에서도 새어 나와 뒤로가기와 중복되던 문제 수정. */}
        {isDesktop && (
          <button
            onClick={onBack}
            className="mw-icon-button"
            aria-label="닫기"
          >
            <IcLineClose size={20} />
          </button>
        )}

        {/* Editor mode toggle — tablet & desktop only (conditional render; CSS `hidden`
            is unreliable here because .f-icon-btn sets its own display). Tier-aware cycle. */}
        {isMdUp && (
          <button
            onClick={() => setEditorMode(nextEditorMode)}
            className="mw-icon-button"
            aria-label={`${editorModeLabel[nextEditorMode]}로 전환`}
            title={`${editorModeLabel[nextEditorMode]}로 전환`}
          >
            {displayEditorMode === 'tiptap' ? (
              <IcLineTextAdjust size={20} />
            ) : displayEditorMode === 'split' ? (
              <IcMwList size={20} />
            ) : (
              <IcMwColumns size={20} />
            )}
          </button>
        )}

        <button
          onClick={onToggleStar}
          className="mw-icon-button"
          aria-label={isStarred ? '중요 해제' : '중요 표시'}
        >
          <IcMwStar size={20}
            className={`  ${
              isStarred
                ? 'fill-primary-500 text-primary-500'
                : 'text-zinc-500 dark:text-zinc-400'
            }`}
          />
        </button>

        <div className="relative">
          {/* A11Y-06: aria-haspopup + aria-expanded */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="mw-icon-button"
            aria-label="더보기"
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
          >
            <IcLineMore size={20} className="text-zinc-700 dark:text-zinc-300" />
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
                  <IcLineExpand size={16} />
                  집중 모드
                </button>
                {/* UX-19: Pin/unpin toggle */}
                {memoId && (
                  <button
                    onClick={handleTogglePin}
                    className="ctx-menu__item w-full"
                    role="menuitem"
                  >
                    <IcLinePin size={16} />
                    {isPinned ? '고정 해제' : '상단 고정'}
                  </button>
                )}
                {memoId && onOpenVersionHistory && (
                  <button
                    onClick={() => { onOpenVersionHistory(); setIsMenuOpen(false) }}
                    className="ctx-menu__item w-full"
                    role="menuitem"
                  >
                    <IcMwHistory size={16} />
                    버전 기록
                  </button>
                )}
                <button
                  onClick={handleMove}
                  className="ctx-menu__item w-full"
                  role="menuitem"
                >
                  <IcLineFolder size={16} />
                  폴더 이동
                </button>
                <button
                  onClick={handleShare}
                  className="ctx-menu__item w-full"
                  role="menuitem"
                >
                  <IcLineShare size={16} />
                  공유
                </button>
                <button
                  onClick={() => { setShowShareCard(true); setIsMenuOpen(false) }}
                  className="ctx-menu__item w-full"
                  role="menuitem"
                >
                  <IcLineGallery size={16} />
                  카드로 공유
                </button>
                <button
                  onClick={() => { setShowShareLink(true); setIsMenuOpen(false) }}
                  className="ctx-menu__item w-full"
                  role="menuitem"
                >
                  <IcMwCode size={16} />
                  링크로 공유
                </button>
                <button
                  onClick={handleCopyText}
                  className="ctx-menu__item w-full"
                  role="menuitem"
                >
                  <IcLineDuplicate size={16} />
                  전체 텍스트 복사
                </button>
                <button
                  onClick={handleExportMarkdown}
                  className="ctx-menu__item w-full"
                  role="menuitem"
                >
                  <IcLineDownload size={16} />
                  마크다운 내보내기
                </button>
                <button
                  onClick={handleDelete}
                  className="ctx-menu__item ctx-menu__item--danger w-full"
                  role="menuitem"
                >
                  <IcLineTrash size={16} />
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
