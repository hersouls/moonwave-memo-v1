import { ArrowLeft, Star, MoreVertical, Trash2, Share2, FolderInput, Columns2, Rows2, Maximize2, History } from 'lucide-react'
import { useState } from 'react'
import { useMemoStore } from '@/stores/memoStore'
import { useUndoStore } from '@/stores/undoStore'
import { useUIStore } from '@/stores/uiStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useNavigate } from 'react-router-dom'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'modified'

interface EditorHeaderProps {
  isStarred: boolean
  onBack: () => void
  onToggleStar: () => void
  onOpenVersionHistory?: () => void
  memoId?: number
  saveStatus?: SaveStatus
}

export function EditorHeader({ isStarred, onBack, onToggleStar, onOpenVersionHistory, memoId, saveStatus }: EditorHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const softDelete = useMemoStore((s) => s.softDelete)
  const pushUndo = useUndoStore((s) => s.pushUndo)
  const openFolderSelect = useUIStore((s) => s.openFolderSelect)
  const toggleFocusMode = useUIStore((s) => s.toggleFocusMode)
  const editorMode = useSettingsStore((s) => s.settings.memoSettings.editorMode)
  const setEditorMode = useSettingsStore((s) => s.setEditorMode)
  const navigate = useNavigate()

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

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Memo', text: 'Check this memo' })
      } catch { /* user cancelled */ }
    }
    setIsMenuOpen(false)
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-zinc-900 sticky top-0 z-10">
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="p-2 -ml-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          aria-label="뒤로가기"
        >
          <ArrowLeft className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
        </button>

        {saveStatus && saveStatus !== 'idle' && (
          <span className="flex items-center gap-1.5 transition-opacity duration-200">
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
              <>
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
              </>
            )}
            {saveStatus === 'modified' && (
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500 animate-pulse" />
                <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500">수정됨</span>
              </span>
            )}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1">
        {/* Split/Tab toggle — desktop only */}
        <button
          onClick={() => setEditorMode(editorMode === 'split' ? 'tabs' : 'split')}
          className="hidden lg:block p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          aria-label={editorMode === 'split' ? '탭 모드' : '분할 모드'}
          title={editorMode === 'split' ? '탭 모드' : '분할 모드'}
        >
          {editorMode === 'split' ? (
            <Rows2 className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
          ) : (
            <Columns2 className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
          )}
        </button>

        <button
          onClick={onToggleStar}
          className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
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
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="더보기"
          >
            <MoreVertical className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
          </button>

          {isMenuOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setIsMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1 bg-white dark:bg-zinc-800 rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-700 py-1 z-30 min-w-[160px]">
                <button
                  onClick={() => { toggleFocusMode(); setIsMenuOpen(false) }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700"
                >
                  <Maximize2 className="w-4 h-4" />
                  집중 모드
                </button>
                {memoId && onOpenVersionHistory && (
                  <button
                    onClick={() => { onOpenVersionHistory(); setIsMenuOpen(false) }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700"
                  >
                    <History className="w-4 h-4" />
                    버전 기록
                  </button>
                )}
                <button
                  onClick={handleMove}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700"
                >
                  <FolderInput className="w-4 h-4" />
                  폴더 이동
                </button>
                <button
                  onClick={handleShare}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700"
                >
                  <Share2 className="w-4 h-4" />
                  공유
                </button>
                <button
                  onClick={handleDelete}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-danger-500 hover:bg-danger-50 dark:hover:bg-zinc-700"
                >
                  <Trash2 className="w-4 h-4" />
                  삭제
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
