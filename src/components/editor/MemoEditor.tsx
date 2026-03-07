import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { EditorHeader } from './EditorHeader'
import { FolderSelector } from './FolderSelector'
import { EditorToolbar } from './EditorToolbar'
import { MarkdownPreview } from './MarkdownPreview'
import { FloatingToolbar } from './FloatingToolbar'
import { SlashCommandMenu } from './SlashCommandMenu'
import { AISummaryPanel } from './AISummaryPanel'
import { BacklinksPanel } from './BacklinksPanel'
// P-05: Lazy load VersionHistory (includes diff library)
const VersionHistory = lazy(() => import('./VersionHistory').then((m) => ({ default: m.VersionHistory })))
import { TagInput } from './TagInput'
import { FeatureHint } from '@/components/ui/FeatureHint'
import { extractTags } from '@/lib/tagParser'
import { useAITagSuggestions } from '@/hooks/useAIFeatures'
import { useAIAutocomplete } from '@/hooks/useAIAutocomplete'
import { useMemoStore } from '@/stores/memoStore'
import { useFolderStore } from '@/stores/folderStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useUIStore } from '@/stores/uiStore'
import { FONT_FAMILIES } from '@/utils/constants'
import { setLastViewedMemo } from '@/components/ui/ContinueBanner'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'modified'
type EditorTab = 'edit' | 'preview'

export function MemoEditor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const memos = useMemoStore((s) => s.memos)
  const addMemo = useMemoStore((s) => s.addMemo)
  const updateMemo = useMemoStore((s) => s.updateMemo)
  const toggleStar = useMemoStore((s) => s.toggleStar)
  const defaultFolderId = useSettingsStore((s) => s.settings.memoSettings.defaultFolderId)
  const inputStartPosition = useSettingsStore((s) => s.settings.memoSettings.inputStartPosition)
  const editorMode = useSettingsStore((s) => s.settings.memoSettings.editorMode)
  const fontFamilyId = useSettingsStore((s) => s.settings.fontFamily)
  const folders = useFolderStore((s) => s.folders)
  const getDefaultFolder = useFolderStore((s) => s.getDefaultFolder)
  const isFocusMode = useUIStore((s) => s.isFocusMode)

  const isNew = !id || id === 'new'
  const memo = isNew ? null : memos.find((m) => m.id === Number(id))

  const [title, setTitle] = useState(memo?.title || '')
  const [body, setBody] = useState(memo?.body || '')
  const [folderId, setFolderId] = useState<number | null>(
    memo?.folderId ?? defaultFolderId ?? getDefaultFolder()?.id ?? null
  )
  const [isStarred, setIsStarred] = useState(memo?.isStarred || false)
  const [memoColor, setMemoColor] = useState<import('@/lib/types').MemoColor>(memo?.color || 'white')
  const [memoId, setMemoId] = useState<number | undefined>(memo?.id)
  const [activeTab, setActiveTab] = useState<EditorTab>('edit')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')

  // Slash command state
  const [slashOpen, setSlashOpen] = useState(false)
  const [slashQuery, setSlashQuery] = useState('')
  const [slashPos, setSlashPos] = useState({ top: 0, left: 0 })
  const slashStartRef = useRef<number | null>(null)

  // Version history
  const [showVersionHistory, setShowVersionHistory] = useState(false)

  // Split view
  const [isLg, setIsLg] = useState(false)
  const isSplit = editorMode === 'split' && isLg && !isFocusMode

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1024px)')
    setIsLg(mql.matches)
    const handler = (e: MediaQueryListEvent) => setIsLg(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  const titleRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasCreated = useRef(false)
  const latestDataRef = useRef({ memoId, title, body, folderId, color: memoColor })
  latestDataRef.current = { memoId, title, body, folderId, color: memoColor }

  // BUG-01: Refs for cleanup to avoid stale closures
  const addMemoRef = useRef(addMemo)
  addMemoRef.current = addMemo

  // TECH-01: Ref for handleBodyChange to avoid stale closure in insertMarkdown
  const handleBodyChangeRef = useRef<(value: string) => void>(() => {})

  // AI features
  const { tags: aiTags, isLoading: aiTagsLoading } = useAITagSuggestions(body)
  const { ghostText, acceptSuggestion, dismissSuggestion } = useAIAutocomplete(body, bodyRef)

  // UX-03: Compute font family from settings
  const fontDef = FONT_FAMILIES.find((f) => f.id === fontFamilyId)
  const editorFontFamily = fontDef?.fontFamily || "'Pretendard', sans-serif"

  // UX-06: Extract current tags from body
  const currentTags = extractTags(body)

  // Focus on mount + track last viewed memo
  useEffect(() => {
    if (isNew) {
      setTimeout(() => {
        if (inputStartPosition === 'title') {
          titleRef.current?.focus()
        } else {
          bodyRef.current?.focus()
        }
      }, 100)
    }
    if (memoId) {
      setLastViewedMemo(memoId)
    }
  }, [isNew, inputStartPosition, memoId])

  // Text undo/redo stack refs (logic defined after scheduleAutoSave)
  const undoStack = useRef<string[]>([])
  const redoStack = useRef<string[]>([])
  const lastSnapshotRef = useRef(body)

  // BUG-05: Prevent concurrent autoSave execution
  const savingRef = useRef(false)

  // Auto-save with debounce
  // BUG-02: Added navigate() after creating new memo
  const autoSave = useCallback(async () => {
    if (savingRef.current) return
    savingRef.current = true
    try {
      if (memoId) {
        setSaveStatus('saving')
        await updateMemo(memoId, { title, body, folderId })
        setSaveStatus('saved')
      } else if (!hasCreated.current && (title.trim() || body.trim())) {
        setSaveStatus('saving')
        hasCreated.current = true
        const newId = await addMemo({
          title,
          body,
          folderId,
          color: memoColor,
        })
        if (newId) {
          setMemoId(newId)
          navigate(`/memo/${newId}`, { replace: true })
        }
        setSaveStatus('saved')
      }
    } finally {
      savingRef.current = false
    }
  }, [memoId, title, body, folderId, memoColor, updateMemo, addMemo, navigate])

  // Auto-clear saved status after 2s
  useEffect(() => {
    if (saveStatus === 'saved') {
      const timer = setTimeout(() => setSaveStatus('idle'), 2000)
      return () => clearTimeout(timer)
    }
  }, [saveStatus])

  const scheduleAutoSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(autoSave, 500)
  }, [autoSave])

  // Text undo/redo actions
  const pushUndoSnapshot = useCallback((text: string) => {
    if (text === lastSnapshotRef.current) return
    undoStack.current.push(lastSnapshotRef.current)
    if (undoStack.current.length > 50) undoStack.current.shift()
    redoStack.current = []
    lastSnapshotRef.current = text
  }, [])

  const undoText = useCallback(() => {
    if (undoStack.current.length === 0) return
    const prev = undoStack.current.pop()!
    redoStack.current.push(body)
    setBody(prev)
    lastSnapshotRef.current = prev
    setSaveStatus('modified')
    scheduleAutoSave()
  }, [body, scheduleAutoSave])

  const redoText = useCallback(() => {
    if (redoStack.current.length === 0) return
    const next = redoStack.current.pop()!
    undoStack.current.push(body)
    setBody(next)
    lastSnapshotRef.current = next
    setSaveStatus('modified')
    scheduleAutoSave()
  }, [body, scheduleAutoSave])

  // BUG-01: Flush pending save on unmount — handles both existing and NEW memos
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
      const { memoId: id, title: t, body: b, folderId: f, color: c } = latestDataRef.current
      if (id && (t.trim() || b.trim())) {
        updateMemo(id, { title: t, body: b, folderId: f })
      } else if (!id && !hasCreated.current && (t.trim() || b.trim())) {
        addMemoRef.current({ title: t, body: b, folderId: f, color: c })
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleTitleChange = (value: string) => {
    setTitle(value)
    setSaveStatus('modified')
    scheduleAutoSave()
  }

  const handleBodyChange = useCallback((value: string) => {
    pushUndoSnapshot(value)
    setBody(value)
    setSaveStatus('modified')
    scheduleAutoSave()
    dismissSuggestion()
  }, [scheduleAutoSave, dismissSuggestion, pushUndoSnapshot])

  // TECH-01: Keep ref up to date
  handleBodyChangeRef.current = handleBodyChange

  // UX-12: handleFolderChange triggers save for new memos too
  const handleFolderChange = (newFolderId: number) => {
    setFolderId(newFolderId)
    if (memoId) {
      updateMemo(memoId, { folderId: newFolderId })
    } else {
      scheduleAutoSave()
    }
  }

  const handleToggleStar = () => {
    setIsStarred(!isStarred)
    if (memoId) {
      toggleStar(memoId)
    }
  }

  const handleBack = async () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    await autoSave()
    navigate('/memos')
  }

  // UX-06: Remove tag from body
  const handleRemoveTag = (tag: string) => {
    const newBody = body.replace(new RegExp(`#${tag}\\s?`, 'g'), '').trim()
    handleBodyChange(newBody)
  }

  // TECH-01: Markdown insertion helper — uses ref to avoid stale closure
  const insertMarkdown = useCallback((before: string, after: string = '') => {
    const textarea = bodyRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = textarea.value
    const selected = text.substring(start, end)

    const newText = text.substring(0, start) + before + selected + after + text.substring(end)
    handleBodyChangeRef.current(newText)

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
  }, [])

  // Slash command detection
  const handleBodyInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    handleBodyChange(value)

    const textarea = bodyRef.current
    if (!textarea) return

    const pos = textarea.selectionStart
    const textBefore = value.substring(0, pos)
    const lineStart = textBefore.lastIndexOf('\n') + 1
    const lineText = textBefore.substring(lineStart)

    if (lineText.startsWith('/')) {
      const query = lineText.substring(1)
      if (!slashOpen) {
        slashStartRef.current = lineStart
      }
      setSlashQuery(query)
      setSlashOpen(true)

      const rect = textarea.getBoundingClientRect()
      setSlashPos({
        top: rect.top + 24 + window.scrollY,
        left: rect.left + 16,
      })
    } else if (slashOpen) {
      setSlashOpen(false)
    }
  }

  const handleSlashSelect = (insert: string) => {
    const textarea = bodyRef.current
    if (!textarea || slashStartRef.current === null) return

    const text = textarea.value
    const pos = textarea.selectionStart
    const lineStart = slashStartRef.current
    const newText = text.substring(0, lineStart) + insert + text.substring(pos)
    handleBodyChange(newText)
    setSlashOpen(false)
    slashStartRef.current = null

    requestAnimationFrame(() => {
      textarea.focus()
      const cursorPos = lineStart + insert.length
      textarea.setSelectionRange(cursorPos, cursorPos)
    })
  }

  // Handle Tab key for AI autocomplete
  const handleBodyKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab' && ghostText) {
      e.preventDefault()
      const suggestion = acceptSuggestion()
      if (suggestion) {
        const textarea = bodyRef.current
        if (textarea) {
          const pos = textarea.selectionStart
          const newBody = body.slice(0, pos) + suggestion + body.slice(pos)
          handleBodyChange(newBody)
          requestAnimationFrame(() => {
            const newPos = pos + suggestion.length
            textarea.setSelectionRange(newPos, newPos)
          })
        }
      }
    }
  }

  // BUG-04: Keyboard shortcuts — check for open overlays before Escape navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (slashOpen) {
          setSlashOpen(false)
          return
        }
        if (ghostText) {
          dismissSuggestion()
          return
        }
        if (showVersionHistory) {
          setShowVersionHistory(false)
          return
        }
        // Check for any open overlay (headlessui dialogs, dropdown menus, etc.)
        if (document.querySelector('[data-headlessui-state="open"]') ||
            document.querySelector('.fixed.inset-0.z-20') ||
            document.querySelector('.fixed.inset-0.z-40')) {
          return // Let the overlay handle its own Escape
        }
        if (isFocusMode) return // handled by App.tsx
        e.preventDefault()
        handleBack()
        return
      }

      if (activeTab !== 'edit' && !isSplit) return
      const textarea = bodyRef.current
      if (!textarea || document.activeElement !== textarea) return

      if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
        if (e.key === 'b') {
          e.preventDefault()
          insertMarkdown('**', '**')
        }
        if (e.key === 'i') {
          e.preventDefault()
          insertMarkdown('*', '*')
        }
        if (e.key === 'k') {
          // Don't intercept Ctrl+K if it's for command palette
          return
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'c') {
        e.preventDefault()
        insertMarkdown('```\n', '\n```')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isSplit, slashOpen, isFocusMode, ghostText, showVersionHistory])

  // Version restore handler
  const handleVersionRestore = (restoredTitle: string, restoredBody: string) => {
    setTitle(restoredTitle)
    setBody(restoredBody)
    setSaveStatus('modified')
    scheduleAutoSave()
  }

  const currentFolder = folders.find((f) => f.id === folderId)

  // Focus mode: char count + reading time
  const charCount = body.length
  const readingTime = Math.max(1, Math.ceil(charCount / 400)) // Korean: ~400 chars/min

  // Handle AI tag click → insert as hashtag
  const handleAITagClick = (tag: string) => {
    const hashtag = `#${tag} `
    if (!body.includes(`#${tag}`)) {
      handleBodyChange(body + (body.endsWith('\n') || !body ? '' : '\n') + hashtag)
    }
  }

  const editContent = (
    <>
      {/* UX-18: maxLength={100} on title */}
      <input
        ref={titleRef}
        type="text"
        value={title}
        onChange={(e) => handleTitleChange(e.target.value)}
        placeholder="제목"
        maxLength={100}
        className="w-full text-2xl fold:text-lg font-bold text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-300 dark:placeholder:text-zinc-600 bg-transparent border-none outline-none mb-3"
        style={{ fontFamily: editorFontFamily }}
      />

      <div className="relative flex-1">
        {/* UX-03: Apply user font, UX-20: Responsive min-height */}
        <textarea
          ref={bodyRef}
          value={body}
          onChange={handleBodyInput}
          onKeyDown={handleBodyKeyDown}
          placeholder="메모를 입력하세요. '/' 명령어와 마크다운을 사용할 수 있습니다."
          className={clsx(
            'w-full flex-1 fold:min-h-[150px] min-h-[200px] sm:min-h-[300px] text-zinc-700 dark:text-zinc-300 placeholder:text-zinc-300 dark:placeholder:text-zinc-600 bg-transparent border-none outline-none resize-none leading-relaxed',
            isFocusMode && 'min-h-[60vh]'
          )}
          style={{ fontFamily: editorFontFamily }}
        />
        {/* AI Autocomplete ghost text */}
        {ghostText && (
          <div className="pointer-events-none absolute bottom-2 left-0 text-xs text-zinc-400 dark:text-zinc-600 italic truncate max-w-full px-1">
            Tab을 눌러 수락: <span className="text-zinc-500 dark:text-zinc-500">{ghostText.slice(0, 80)}{ghostText.length > 80 ? '...' : ''}</span>
          </div>
        )}
      </div>

      {/* Feature hint: slash commands */}
      {!isFocusMode && !body && (
        <FeatureHint
          id="slash-commands"
          message="'/' 키를 입력하면 슬래시 커맨드를 사용할 수 있습니다. 제목, 구분선, 코드 블록 등을 빠르게 삽입해보세요."
        />
      )}

      {/* UX-06: TagInput for current tags */}
      {!isFocusMode && currentTags.length > 0 && (
        <TagInput tags={currentTags} onRemoveTag={handleRemoveTag} />
      )}

      {/* AI Tag suggestions */}
      {aiTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">AI 태그</span>
          {aiTags.map((tag) => (
            <button
              key={tag}
              onClick={() => handleAITagClick(tag)}
              className="px-2 py-0.5 text-xs rounded-full bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors"
            >
              #{tag}
            </button>
          ))}
          {aiTagsLoading && (
            <span className="text-[10px] text-zinc-400 animate-pulse">분석 중...</span>
          )}
        </div>
      )}
    </>
  )

  const previewContent = (
    <div className="flex-1 min-h-[300px] pb-8">
      {title && (
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
          {title}
        </h1>
      )}
      <MarkdownPreview content={body} />
    </div>
  )

  return (
    <div className={clsx(
      'flex flex-col h-full min-h-[calc(100vh-4rem)] lg:min-h-0',
      isFocusMode && 'min-h-screen'
    )}>
      {!isFocusMode && (
        <EditorHeader
          isStarred={isStarred}
          onBack={handleBack}
          onToggleStar={handleToggleStar}
          onOpenVersionHistory={memoId ? () => setShowVersionHistory(true) : undefined}
          memoId={memoId}
          saveStatus={saveStatus}
          title={title}
          body={body}
          isPinned={memo?.isPinned ?? false}
          memoColor={memoColor}
          onColorChange={(color) => {
            setMemoColor(color)
            if (memoId) updateMemo(memoId, { color })
          }}
        />
      )}

      <div className={clsx(
        'flex-1',
        isFocusMode
          ? 'max-w-2xl mx-auto w-full px-6 pt-12'
          : 'px-4 lg:px-8 max-w-4xl mx-auto w-full'
      )}>
        {!isFocusMode && (
          <FolderSelector
            currentFolder={currentFolder}
            onFolderChange={handleFolderChange}
          />
        )}

        {isSplit ? (
          /* Split view: side-by-side edit + preview */
          <div className="flex gap-0 flex-1 min-h-[300px] border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden">
            <div className="flex-1 flex flex-col p-4 overflow-auto">
              {editContent}
            </div>
            <div className="w-px bg-zinc-200 dark:bg-zinc-700 shrink-0" />
            <div className="flex-1 p-4 overflow-auto">
              {previewContent}
            </div>
          </div>
        ) : (
          <>
            {/* A11Y-02: Tab bar with proper ARIA roles */}
            {!isFocusMode && (
              <div className="flex gap-1 mb-4 border-b border-zinc-200 dark:border-zinc-700" role="tablist" aria-label="편집기 모드">
                <button
                  role="tab"
                  aria-selected={activeTab === 'edit'}
                  id="tab-edit"
                  aria-controls="panel-edit"
                  onClick={() => setActiveTab('edit')}
                  className={clsx(
                    'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
                    activeTab === 'edit'
                      ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                      : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                  )}
                >
                  편집
                </button>
                <button
                  role="tab"
                  aria-selected={activeTab === 'preview'}
                  id="tab-preview"
                  aria-controls="panel-preview"
                  onClick={() => setActiveTab('preview')}
                  className={clsx(
                    'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
                    activeTab === 'preview'
                      ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                      : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                  )}
                >
                  미리보기
                </button>
              </div>
            )}

            <div
              role="tabpanel"
              id={activeTab === 'edit' ? 'panel-edit' : 'panel-preview'}
              aria-labelledby={activeTab === 'edit' ? 'tab-edit' : 'tab-preview'}
            >
              {(activeTab === 'edit' || isFocusMode) ? editContent : previewContent}
            </div>
          </>
        )}

        {/* AI Summary + Backlinks panels (below editor, not in focus mode) */}
        {!isFocusMode && memoId && (
          <div className="mt-4 space-y-3 pb-4">
            <AISummaryPanel content={body} />
            <BacklinksPanel memoId={memoId} title={title} />
          </div>
        )}
      </div>

      {/* Focus mode footer */}
      {isFocusMode && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 text-xs text-zinc-400 dark:text-zinc-500 bg-white/80 dark:bg-zinc-900/80 backdrop-blur px-4 py-2 rounded-full">
          <span>{charCount}자</span>
          <span>·</span>
          <span>읽기 약 {readingTime}분</span>
          <span>·</span>
          <span className="text-zinc-300 dark:text-zinc-600">ESC로 나가기</span>
        </div>
      )}

      {/* Save status indicator bar */}
      {saveStatus !== 'idle' && (
        <div className={clsx(
          'h-0.5 w-full transition-all duration-300',
          saveStatus === 'saving' && 'bg-primary-500 animate-pulse',
          saveStatus === 'saved' && 'bg-success-500 animate-save-fadeout',
          saveStatus === 'modified' && 'bg-zinc-300 dark:bg-zinc-600'
        )} />
      )}

      {/* Editor toolbar (not in focus/split mode) */}
      {(activeTab === 'edit' || isSplit) && !isFocusMode && (
        <EditorToolbar
          textareaRef={bodyRef}
          onContentChange={handleBodyChange}
          onUndo={undoText}
          onRedo={redoText}
          canUndo={undoStack.current.length > 0}
          canRedo={redoStack.current.length > 0}
        />
      )}

      {/* Floating toolbar for text selection */}
      {(activeTab === 'edit' || isSplit) && (
        <FloatingToolbar textareaRef={bodyRef} onInsert={insertMarkdown} />
      )}

      {/* Slash command menu */}
      {slashOpen && (
        <SlashCommandMenu
          query={slashQuery}
          position={slashPos}
          onSelect={handleSlashSelect}
          onClose={() => setSlashOpen(false)}
        />
      )}

      {/* Version history panel */}
      {showVersionHistory && memoId && (
        <Suspense fallback={<div className="flex items-center justify-center p-8"><div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>}>
          <VersionHistory
            memoId={memoId}
            currentTitle={title}
            currentBody={body}
            onRestore={handleVersionRestore}
            onClose={() => setShowVersionHistory(false)}
          />
        </Suspense>
      )}
    </div>
  )
}
