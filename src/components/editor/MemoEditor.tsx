import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useViewTransition } from '@/hooks/useViewTransition'
import clsx from 'clsx'
import { EditorHeader } from './EditorHeader'
import { FolderSelector } from './FolderSelector'
import { EditorToolbar } from './EditorToolbar'
import { EditorCommandPalette, type EditorCommand } from './EditorCommandPalette'
import { MarkdownPreview } from './MarkdownPreview'
import { FloatingToolbar } from './FloatingToolbar'
import { SlashCommandMenu } from './SlashCommandMenu'
import { AISummaryPanel } from './AISummaryPanel'
import { BacklinksPanel } from './BacklinksPanel'
import { FocusTimer } from './FocusTimer'
// P-05: Lazy load VersionHistory (includes diff library)
const VersionHistory = lazy(() => import('./VersionHistory').then((m) => ({ default: m.VersionHistory })))
const RelatedMemosPanel = lazy(() => import('./RelatedMemosPanel').then((m) => ({ default: m.RelatedMemosPanel })))
import { TagInput } from './TagInput'
import { FeatureHint } from '@/components/ui/FeatureHint'
import { Spinner } from '@/components/ui/Spinner'
import { extractTags } from '@/lib/tagParser'
import { useAITagSuggestions } from '@/hooks/useAIFeatures'
import { useAIAutocomplete } from '@/hooks/useAIAutocomplete'
import { useVisualViewport } from '@/hooks/useVisualViewport'
import { useTypingSounds } from '@/hooks/useTypingSounds'
import { useBreathingTypography } from '@/hooks/useBreathingTypography'
import { useTimeMachine } from '@/hooks/useTimeMachine'
import { useOrganicAura } from '@/hooks/useOrganicAura'
import { useAmbientSoundscape } from '@/hooks/useAmbientSoundscape'
import { TiptapEditorContent } from './TiptapEditorContent'
import { useTiptapEditor } from '@/hooks/useTiptapEditor'
import { AlterEgoPanel } from './AlterEgoPanel'
import { EditorOutline } from './EditorOutline'
import { analyzeSentiment } from '@/services/sentimentAnalysis'
import { X, Heading2, List, CheckSquare, Code2, Quote, Minus, ListTree, Brain, Maximize2, MonitorPlay, History, Wand2, Download, Sparkles, Loader2 } from 'lucide-react'
import { TimeMachineBanner } from './TimeMachineBanner'
import { EphemeralBanner } from './EphemeralBanner'
import { useMemoStore } from '@/stores/memoStore'
import { useFolderStore } from '@/stores/folderStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useUIStore } from '@/stores/uiStore'
import { FONT_FAMILIES } from '@/utils/constants'
import { setLastViewedMemo } from '@/components/ui/ContinueBanner'
import { useToastStore } from '@/stores/toastStore'
import { toggleChecklistItem, getChecklistStats } from '@/utils/checklistParser'
import { getAllTemplates } from '@/utils/memoTemplates'
import { buildRuleTitle, composeTitle, getCategoryLabel, formatTitleDate } from '@/utils/memoTitle'
import { isAIAvailable, summarizeTitleKeyword } from '@/services/aiFeatures'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'modified' | 'error'
type EditorTab = 'edit' | 'preview'

export function MemoEditor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { navigateWithTransition } = useViewTransition()
  const [searchParams] = useSearchParams()
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
  const breathingTypographyEnabled = useSettingsStore((s) => s.settings.livingWorkspace.breathingTypographyEnabled)
  const ephemeralBrainDumpEnabled = useSettingsStore((s) => s.settings.livingWorkspace.ephemeralBrainDumpEnabled)
  const timeMachineEnabled = useSettingsStore((s) => s.settings.livingWorkspace.timeMachineEnabled)
  const organicAuraEnabled = useSettingsStore((s) => s.settings.livingWorkspace.organicAuraEnabled)
  const ambientSoundscapeEnabled = useSettingsStore((s) => s.settings.livingWorkspace.ambientSoundscapeEnabled)
  const alterEgoEnabled = useSettingsStore((s) => s.settings.livingWorkspace.alterEgoEnabled)
  const { keyboardHeight, isKeyboardOpen } = useVisualViewport()
  const { playKeySound } = useTypingSounds(isFocusMode)
  const { isBreathing, recordKeystroke } = useBreathingTypography(breathingTypographyEnabled)
  const saveEphemeral = useMemoStore((s) => s.saveEphemeral)
  const recordAccess = useMemoStore((s) => s.recordAccess)

  const isNew = !id || id === 'new'
  const memo = isNew ? null : memos.find((m) => m.id === Number(id))

  // Guard: redirect if memo is in trash (should not be edited)
  useEffect(() => {
    if (!isNew && memo?.deletedAt) {
      navigate('/memos', { replace: true })
    }
  }, [isNew, memo?.deletedAt, navigate])

  // Template pre-fill for new memos
  const templateId = isNew ? searchParams.get('template') : null
  const template = templateId ? getAllTemplates().find((t) => t.id === templateId) : null

  const initialFolderId = memo?.folderId ?? defaultFolderId ?? getDefaultFolder()?.id ?? null
  // YYMMDD 기준일: 기존 메모는 생성일, 신규는 세션 시작 시각(편집 중 자정 넘어가도 고정)
  const creationDateRef = useRef(memo?.createdAt ?? new Date().toISOString())

  const [title, setTitle] = useState(() => {
    if (memo?.title) return memo.title
    if (template?.title) return template.title
    // 신규 메모: 본문이 있으면 카테고리 규칙 제목([폴더]_요약_YYMMDD), 없으면 빈 제목
    const initBody = memo?.body ?? template?.body ?? ''
    if (!initBody.trim()) return ''
    return buildRuleTitle({ folderId: initialFolderId, createdAt: creationDateRef.current, body: initBody }, folders)
  })
  const [body, setBody] = useState(memo?.body || template?.body || '')
  const [folderId, setFolderId] = useState<number | null>(initialFolderId)
  const [isStarred, setIsStarred] = useState(memo?.isStarred || false)
  const [memoColor, setMemoColor] = useState<import('@/lib/types').MemoColor>(memo?.color || template?.color || 'white')
  const [memoId, setMemoId] = useState<number | undefined>(memo?.id)
  const [activeTab, setActiveTab] = useState<EditorTab>('edit')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')

  // Ephemeral brain-dump
  const isEphemeralParam = searchParams.get('ephemeral') === 'true'
  const [ephemeralExpiresAt, setEphemeralExpiresAt] = useState<string | undefined>(memo?.ephemeralExpiresAt)

  // Slash command state
  const [slashOpen, setSlashOpen] = useState(false)
  const [slashQuery, setSlashQuery] = useState('')
  const [slashPos, setSlashPos] = useState({ top: 0, left: 0 })
  const slashStartRef = useRef<number | null>(null)

  // Version history
  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)

  // Alter Ego panel
  const [showAlterEgo, setShowAlterEgo] = useState(false)

  // Outline panel (desktop only)
  const [showOutline, setShowOutline] = useState(false)

  // Split view
  const isLg = useUIStore((s) => s.isDesktop)
  const isTablet = useUIStore((s) => s.isTablet)
  // Tablet & desktop get the richer editor (outline, side panels, WYSIWYG).
  // Split view stays desktop-only (isLg) since it needs two readable columns.
  const isMdUp = isTablet || isLg
  const isTiptap = editorMode === 'tiptap'
  const isTiptapRef = useRef(isTiptap)
  isTiptapRef.current = isTiptap
  const isSplit = editorMode === 'split' && isLg && !isFocusMode

  const titleRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const splitPreviewRef = useRef<HTMLDivElement>(null)

  // Split view (desktop): proportionally mirror the edit textarea's scroll onto the preview pane.
  useEffect(() => {
    if (!isSplit) return
    const ta = bodyRef.current
    const preview = splitPreviewRef.current
    if (!ta || !preview) return
    const onScroll = () => {
      const denom = ta.scrollHeight - ta.clientHeight
      if (denom <= 0) return
      preview.scrollTop = (ta.scrollTop / denom) * (preview.scrollHeight - preview.clientHeight)
    }
    ta.addEventListener('scroll', onScroll, { passive: true })
    return () => ta.removeEventListener('scroll', onScroll)
  }, [isSplit])
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasCreated = useRef(false)
  // Auto-title: track whether title was set by user or auto-generated
  const isAutoTitle = useRef(!memo?.title && !template?.title)
  // 하이브리드 제목: AI 요약 다듬기 디바운스 타이머 + 마지막으로 요약한 본문(중복 호출 방지)
  const aiTitleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastAITitleBodyRef = useRef('')
  // 비동기 AI 호출이 언마운트 후 resolve될 때 setState/타이머 재예약을 막는 가드
  const isMountedRef = useRef(true)
  const latestDataRef = useRef({ memoId, title, body, folderId, color: memoColor })
  latestDataRef.current = { memoId, title, body, folderId, color: memoColor }

  // BUG-01: Refs for cleanup to avoid stale closures
  const addMemoRef = useRef(addMemo)
  addMemoRef.current = addMemo

  // TECH-01: Ref for handleBodyChange to avoid stale closure in insertMarkdown
  const handleBodyChangeRef = useRef<(value: string) => void>(() => {})

  // Outline: scroll to specific line in textarea (legacy mode)
  const handleOutlineScrollToLine = useCallback((line: number) => {
    const textarea = bodyRef.current
    if (!textarea) return
    const lines = textarea.value.split('\n')
    let charIndex = 0
    for (let i = 0; i < line && i < lines.length; i++) {
      charIndex += lines[i].length + 1
    }
    textarea.focus()
    textarea.setSelectionRange(charIndex, charIndex)
    const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 24
    textarea.scrollTop = Math.max(0, line * lineHeight - textarea.clientHeight / 3)
  }, [])

  // Outline: scroll to heading by sequential index (Tiptap mode)
  const handleOutlineScrollToHeadingIndex = useCallback((index: number) => {
    if (!tiptapEditorRef.current) return
    let headingCount = 0
    tiptapEditorRef.current.state.doc.descendants((node: any, pos: number) => {
      if (node.type.name === 'heading') {
        if (headingCount === index) {
          const dom = tiptapEditorRef.current?.view.nodeDOM(pos)
          ;(dom as HTMLElement)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          return false
        }
        headingCount++
      }
    })
  }, [])

  // AI features
  const { tags: aiTags, isLoading: aiTagsLoading } = useAITagSuggestions(body)
  const { ghostText, acceptSuggestion, dismissSuggestion } = useAIAutocomplete(body, bodyRef)

  // UX-03: Compute font family from settings
  const fontDef = FONT_FAMILIES.find((f) => f.id === fontFamilyId)
  const editorFontFamily = fontDef?.fontFamily || "'Pretendard', sans-serif"

  // UX-06: Extract current tags from body
  const currentTags = extractTags(body)

  // Beyond UX: Time Machine — replay context when opening old memos
  const { isActive: timeMachineActive, dismiss: dismissTimeMachine } = useTimeMachine(
    memo?.contextSnapshot,
    timeMachineEnabled && !isNew
  )

  // Beyond UX: Organic Aura — subtle color overlay based on sentiment
  useOrganicAura(body, organicAuraEnabled)

  // Beyond UX: Ambient Soundscape — generative audio while writing
  const sentimentForSound = useMemo(() => analyzeSentiment(body), [body])
  const { playNote: playAmbientNote } = useAmbientSoundscape({
    enabled: ambientSoundscapeEnabled,
    bodyLength: body.length,
    sentiment: sentimentForSound,
  })

  // Beyond UX: Record access for context-aware surfacing
  useEffect(() => {
    if (!isNew && memoId) {
      recordAccess(memoId)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memoId])

  // Capture stable viewport height to prevent iOS Safari dvh jumps
  useEffect(() => {
    document.documentElement.style.setProperty('--stable-vh', `${window.innerHeight}px`)
    return () => { document.documentElement.style.removeProperty('--stable-vh') }
  }, [])

  // Focus on mount + track last viewed memo (uses tiptapEditorRef to avoid ordering issues)
  const tiptapEditorRef = useRef<any>(null)
  useEffect(() => {
    if (isNew) {
      setTimeout(() => {
        if (inputStartPosition === 'title') {
          titleRef.current?.focus()
        } else if (editorMode === 'tiptap' && tiptapEditorRef.current) {
          tiptapEditorRef.current.commands.focus('end')
        } else {
          bodyRef.current?.focus()
        }
      }, 150) // Slightly longer delay to ensure Tiptap editor is initialized
    }
    if (memoId) {
      setLastViewedMemo(memoId)
    }
  }, [isNew, inputStartPosition, memoId, editorMode])

  // Text undo/redo stack refs (logic defined after scheduleAutoSave)
  const undoStack = useRef<string[]>([])
  const redoStack = useRef<string[]>([])
  const lastSnapshotRef = useRef(body)
  // State-based counters to trigger re-render for toolbar button disabled states
  const [undoCount, setUndoCount] = useState(0)
  const [redoCount, setRedoCount] = useState(0)

  // BUG-05: Prevent concurrent autoSave execution
  const savingRef = useRef(false)

  // Auto-save with debounce
  // BUG-02: Added navigate() after creating new memo
  const autoSave = useCallback(async () => {
    if (savingRef.current) return
    savingRef.current = true
    try {
      // 최신값은 latestDataRef에서 읽는다 — 디바운스 중 stale closure로 예전 title/body/folderId가
      // 저장되는 문제(폴더 이동 되돌림, AI 제목 유실 등) 방지
      const { memoId: id, title: t, body: b, folderId: f, color: c } = latestDataRef.current
      if (id) {
        setSaveStatus('saving')
        await updateMemo(id, { title: t, body: b, folderId: f })
        setSaveStatus('saved')
      } else if (!hasCreated.current && (t.trim() || b.trim())) {
        setSaveStatus('saving')
        const newId = await addMemo({
          title: t,
          body: b,
          folderId: f,
          color: c,
          ...(isEphemeralParam && ephemeralBrainDumpEnabled ? { ephemeral: true } : {}),
        })
        if (newId) {
          hasCreated.current = true
          setMemoId(newId)
          navigate(`/memo/${newId}`, { replace: true })
          // Set ephemeral expiry for display
          if (isEphemeralParam && ephemeralBrainDumpEnabled) {
            const createdMemo = useMemoStore.getState().memos.find((m) => m.id === newId)
            if (createdMemo?.ephemeralExpiresAt) {
              setEphemeralExpiresAt(createdMemo.ephemeralExpiresAt)
            }
          }
          setSaveStatus('saved')
        }
      }
    } catch (err) {
      console.error('AutoSave failed:', err)
      setSaveStatus('error')
      useToastStore.getState().showToast('메모 저장에 실패했습니다', 'error')
    } finally {
      savingRef.current = false
    }
  }, [updateMemo, addMemo, navigate, isEphemeralParam, ephemeralBrainDumpEnabled])

  // Auto-clear saved status after 2s
  useEffect(() => {
    if (saveStatus === 'saved') {
      const timer = setTimeout(() => setSaveStatus('idle'), 2000)
      return () => clearTimeout(timer)
    }
    if (saveStatus === 'error') {
      const timer = setTimeout(() => setSaveStatus('idle'), 4000)
      return () => clearTimeout(timer)
    }
  }, [saveStatus])

  const scheduleAutoSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(autoSave, 500)
  }, [autoSave])

  // 규칙 기반 제목 즉시 갱신([폴더]_본문요약_YYMMDD). 본문 비면 빈 제목(플레이스홀더 노출)
  const recomputeAutoTitle = useCallback((nextBody: string, nextFolderId: number | null) => {
    if (!isAutoTitle.current) return
    if (!nextBody.trim()) { setTitle(''); return }
    setTitle(buildRuleTitle(
      { folderId: nextFolderId, createdAt: creationDateRef.current, body: nextBody },
      useFolderStore.getState().folders,
    ))
  }, [])

  // 유휴 4초 후 AI로 요약을 다듬어 제목 교체(자동 제목 상태일 때만, AI 사용 가능 시).
  const scheduleAITitleRefine = useCallback(() => {
    if (aiTitleTimerRef.current) clearTimeout(aiTitleTimerRef.current)
    aiTitleTimerRef.current = setTimeout(async () => {
      if (!isAutoTitle.current) return
      const b = latestDataRef.current.body
      if (b.trim().length < 20 || b === lastAITitleBodyRef.current) return
      if (!isAIAvailable()) return
      lastAITitleBodyRef.current = b
      const { keyword, error } = await summarizeTitleKeyword(b)
      // 언마운트됐거나 그 사이 사용자가 제목을 직접 편집했으면 중단(stale write·타이머 누수 방지)
      if (!isMountedRef.current || error || !keyword || !isAutoTitle.current) return
      const label = getCategoryLabel(latestDataRef.current.folderId, useFolderStore.getState().folders)
      setTitle(composeTitle(label, keyword, formatTitleDate(creationDateRef.current)))
      setSaveStatus('modified')
      scheduleAutoSave()
    }, 4000)
  }, [scheduleAutoSave])

  // Text undo/redo actions
  const pushUndoSnapshot = useCallback((text: string) => {
    if (text === lastSnapshotRef.current) return
    undoStack.current.push(lastSnapshotRef.current)
    if (undoStack.current.length > 50) undoStack.current.shift()
    redoStack.current = []
    lastSnapshotRef.current = text
    setUndoCount(undoStack.current.length)
    setRedoCount(0)
  }, [])

  const undoText = useCallback(() => {
    if (undoStack.current.length === 0) return
    const prev = undoStack.current.pop()!
    redoStack.current.push(body)
    setBody(prev)
    lastSnapshotRef.current = prev
    setUndoCount(undoStack.current.length)
    setRedoCount(redoStack.current.length)
    setSaveStatus('modified')
    scheduleAutoSave()
  }, [body, scheduleAutoSave])

  const redoText = useCallback(() => {
    if (redoStack.current.length === 0) return
    const next = redoStack.current.pop()!
    undoStack.current.push(body)
    setBody(next)
    lastSnapshotRef.current = next
    setUndoCount(undoStack.current.length)
    setRedoCount(redoStack.current.length)
    setSaveStatus('modified')
    scheduleAutoSave()
  }, [body, scheduleAutoSave])

  // BUG-01: Flush pending save on unmount — handles both existing and NEW memos
  useEffect(() => {
    // StrictMode(dev)는 mount 시 setup→cleanup→setup을 실행하므로 setup마다 true로 되돌린다
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
      if (aiTitleTimerRef.current) {
        clearTimeout(aiTitleTimerRef.current)
        aiTitleTimerRef.current = null
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
    isAutoTitle.current = false
    setTitle(value)
    setSaveStatus('modified')
    scheduleAutoSave()
  }

  const handleBodyChange = useCallback((value: string) => {
    // Tiptap uses its own History extension — skip manual undo stack
    if (!isTiptapRef.current) pushUndoSnapshot(value)
    setBody(value)

    // 카테고리별 제목 규칙: 작성 중엔 규칙 기반 즉시 갱신, 유휴 시 AI로 요약 다듬기(하이브리드)
    if (isAutoTitle.current) {
      recomputeAutoTitle(value, latestDataRef.current.folderId)
      scheduleAITitleRefine()
    }

    setSaveStatus('modified')
    scheduleAutoSave()
    dismissSuggestion()
  }, [scheduleAutoSave, dismissSuggestion, pushUndoSnapshot, recomputeAutoTitle, scheduleAITitleRefine])

  // TECH-01: Keep ref up to date
  handleBodyChangeRef.current = handleBodyChange

  // Tiptap WYSIWYG editor (always initialized to satisfy hook rules)
  const handleTiptapUpdate = useCallback((markdown: string) => {
    handleBodyChange(markdown)
    playKeySound()
    recordKeystroke()
    // Ambient soundscape: generate note from last character
    if (markdown.length > 0) {
      const lastChar = markdown.charCodeAt(markdown.length - 1)
      playAmbientNote(lastChar)
    }
  }, [handleBodyChange, playKeySound, recordKeystroke, playAmbientNote])

  const { editor: tiptapEditor, characterCount: tiptapCharCount } = useTiptapEditor({
    initialContent: body,
    placeholder: '메모를 입력하세요. 마크다운을 사용할 수 있습니다.',
    onUpdate: handleTiptapUpdate,
  })
  tiptapEditorRef.current = tiptapEditor

  // UX-12: handleFolderChange triggers save for new memos too
  const handleFolderChange = (newFolderId: number) => {
    setFolderId(newFolderId)
    // 자동 제목이면 폴더(카테고리) 변경 시 제목의 [폴더] 부분도 함께 갱신
    let nextTitle: string | undefined
    if (isAutoTitle.current) {
      const b = latestDataRef.current.body
      nextTitle = b.trim()
        ? buildRuleTitle({ folderId: newFolderId, createdAt: creationDateRef.current, body: b }, useFolderStore.getState().folders)
        : ''
      setTitle(nextTitle)
      // 폴더(카테고리)가 바뀌면 [폴더] 라벨이 달라지므로 AI 요약도 새 라벨로 다시 다듬도록 재예약
      lastAITitleBodyRef.current = ''
      scheduleAITitleRefine()
    }
    if (memoId) {
      updateMemo(memoId, { folderId: newFolderId, ...(nextTitle !== undefined ? { title: nextTitle } : {}) })
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
    navigateWithTransition('/memos')
  }

  // UX-06: Remove tag from body
  const handleRemoveTag = (tag: string) => {
    const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const newBody = body.replace(new RegExp(`#${escaped}\\s?`, 'g'), '').trim()
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

      // Estimate cursor position based on line/column within textarea
      const rect = textarea.getBoundingClientRect()
      const lineHeight = parseInt(getComputedStyle(textarea).lineHeight) || 24
      const paddingTop = parseInt(getComputedStyle(textarea).paddingTop) || 0
      const paddingLeft = parseInt(getComputedStyle(textarea).paddingLeft) || 0
      const linesBeforeCursor = value.substring(0, pos).split('\n').length
      const cursorTop = rect.top + paddingTop + (linesBeforeCursor * lineHeight) - textarea.scrollTop
      setSlashPos({
        top: Math.min(cursorTop + lineHeight + window.scrollY, rect.bottom + window.scrollY - 10),
        left: rect.left + paddingLeft,
      })
    } else if (slashOpen) {
      setSlashOpen(false)
    }
    playKeySound()
    recordKeystroke()
    // Ambient soundscape: play note for last typed character
    if (value.length > 0) {
      const lastChar = value.charCodeAt(value.length - 1)
      playAmbientNote(lastChar)
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

  // Keyboard shortcuts — ref delegation to avoid stale closures
  const handleKeyDownRef = useRef<(e: KeyboardEvent) => void>(() => {})

  handleKeyDownRef.current = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (slashOpen) {
        setSlashOpen(false)
        return
      }
      if (ghostText) {
        dismissSuggestion()
        return
      }
      // 버전 기록/명령 팔레트는 Headless UI Dialog가 자체 Escape(+퇴장 애니메이션)를 처리
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

    // Tiptap handles its own formatting shortcuts (Ctrl+B/I/Z etc.)
    if (isTiptap) return

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
      if (e.key === 'e') {
        e.preventDefault()
        insertMarkdown('`', '`')
      }
      if (e.key === 'k') {
        e.preventDefault()
        insertMarkdown('[', '](url)')
      }
      if (e.key === 'z') {
        e.preventDefault()
        undoText()
        return
      }
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
      if (e.key.toLowerCase() === 'c') {
        e.preventDefault()
        insertMarkdown('```\n', '\n```')
      }
      if (e.key.toLowerCase() === 'z') {
        e.preventDefault()
        redoText()
        return
      }
    }
  }

  useEffect(() => {
    const listener = (e: KeyboardEvent) => handleKeyDownRef.current(e)
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [])

  // Version restore handler
  const handleVersionRestore = (restoredTitle: string, restoredBody: string) => {
    setTitle(restoredTitle)
    setBody(restoredBody)
    setSaveStatus('modified')
    scheduleAutoSave()
  }

  // 개별 편집기: 현재 메모 제목을 [폴더]_본문요약_YYMMDD 로 재생성(규칙 즉시 → AI 다듬기)
  const [isRegeneratingTitle, setIsRegeneratingTitle] = useState(false)
  const handleRegenerateTitle = useCallback(async () => {
    const b = latestDataRef.current.body
    if (!b.trim()) {
      useToastStore.getState().showToast('본문을 입력하면 제목을 생성할 수 있습니다', 'info')
      return
    }
    setIsRegeneratingTitle(true)
    try {
      const foldersNow = useFolderStore.getState().folders
      const fid = latestDataRef.current.folderId
      let newTitle = buildRuleTitle({ folderId: fid, createdAt: creationDateRef.current, body: b }, foldersNow)
      setTitle(newTitle)
      if (isAIAvailable()) {
        const { keyword } = await summarizeTitleKeyword(b)
        if (!isMountedRef.current) return
        if (keyword) {
          newTitle = composeTitle(getCategoryLabel(fid, foldersNow), keyword, formatTitleDate(creationDateRef.current))
          setTitle(newTitle)
          lastAITitleBodyRef.current = b // 자동 재요약 디바운스 중복 방지
        }
      }
      const mid = latestDataRef.current.memoId
      if (mid) {
        await updateMemo(mid, { title: newTitle })
        if (isMountedRef.current) setSaveStatus('saved')
      } else {
        setSaveStatus('modified')
        scheduleAutoSave()
      }
    } catch {
      if (isMountedRef.current) useToastStore.getState().showToast('제목 재생성에 실패했습니다', 'error')
    } finally {
      if (isMountedRef.current) setIsRegeneratingTitle(false)
    }
  }, [scheduleAutoSave, updateMemo])

  const currentFolder = folders.find((f) => f.id === folderId)

  // Stats: char count, reading time, checklist progress
  const charCount = isTiptap ? tiptapCharCount : body.length
  const readingTime = Math.max(1, Math.ceil(charCount / 400)) // Korean: ~400 chars/min
  const checklistStats = useMemo(() => getChecklistStats(body), [body])

  // Checkbox toggle handler for interactive checklist
  const handleCheckboxToggle = useCallback((lineIndex: number, _checked: boolean) => {
    const newBody = toggleChecklistItem(body, lineIndex)
    handleBodyChange(newBody)
  }, [body, handleBodyChange])

  // Handle AI enhance → replace body with enhanced version
  const handleAIEnhance = useCallback((enhanced: string) => {
    pushUndoSnapshot(enhanced)
    setBody(enhanced)
    setSaveStatus('modified')
    scheduleAutoSave()
    useToastStore.getState().showToast('AI 편집이 적용되었습니다. Ctrl+Z로 되돌릴 수 있습니다.', 'success')
  }, [pushUndoSnapshot, scheduleAutoSave])

  // Handle AI tag click → insert as hashtag
  const handleAITagClick = (tag: string) => {
    const hashtag = `#${tag} `
    if (!body.includes(`#${tag}`)) {
      handleBodyChange(body + (body.endsWith('\n') || !body ? '' : '\n') + hashtag)
    }
  }

  const handleSaveEphemeral = () => {
    if (memoId) {
      saveEphemeral(memoId)
      setEphemeralExpiresAt(undefined)
    }
  }

  // Tiptap body area (replaces textarea in editContent when isTiptap)
  const tiptapBodyContent = (
    <TiptapEditorContent
      editor={tiptapEditor}
      fontFamily={editorFontFamily}
      isBreathing={isBreathing}
    />
  )

  const editContent = (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Ephemeral brain-dump banner */}
      {ephemeralExpiresAt && !isKeyboardOpen && (
        <div className="mb-3">
          <EphemeralBanner expiresAt={ephemeralExpiresAt} onSave={handleSaveEphemeral} />
        </div>
      )}

      {/* UX-18: maxLength={100} on title + 제목 재생성 버튼([폴더]_요약_YYMMDD) */}
      <div className="flex items-start gap-2 mb-3">
        <input
          ref={titleRef}
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="제목"
          maxLength={100}
          className="w-full text-[1.75rem] lg:text-[2rem] fold:text-lg font-bold tracking-[-0.02em] leading-tight text-balance text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 caret-primary-500 bg-transparent border-none outline-none"
          style={{ fontFamily: editorFontFamily }}
        />
        <button
          type="button"
          onClick={handleRegenerateTitle}
          disabled={isRegeneratingTitle || !body.trim()}
          className="mt-1.5 shrink-0 flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-[var(--color-accent)] disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-zinc-400 dark:text-zinc-500 dark:hover:bg-zinc-800"
          aria-label="제목 재생성"
          title="제목 재생성 (본문 요약 + 날짜)"
        >
          {isRegeneratingTitle ? (
            <Loader2 className="h-[18px] w-[18px] animate-spin" />
          ) : (
            <Sparkles className="h-[18px] w-[18px]" />
          )}
        </button>
      </div>

      {isTiptap ? (
        tiptapBodyContent
      ) : (
        <>
          <div className={clsx('relative flex-1 flex flex-col min-h-0', isBreathing && 'breathing-active')}>
            {/* UX-03: Apply user font, UX-20: Fills remaining space */}
            <textarea
              ref={bodyRef}
              value={body}
              onChange={handleBodyInput}
              onKeyDown={handleBodyKeyDown}
              placeholder="메모를 입력하세요. '/' 명령어와 마크다운을 사용할 수 있습니다."
              className="w-full flex-1 min-h-0 pb-32 text-[1.0625rem] leading-[1.8] tracking-[-0.003em] text-zinc-700 dark:text-zinc-300 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 caret-primary-500 bg-transparent border-none outline-none resize-none"
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
        </>
      )}

      {/* UX-06: TagInput for current tags (hide when keyboard open to maximize edit area) */}
      {!isFocusMode && !isKeyboardOpen && currentTags.length > 0 && (
        <TagInput tags={currentTags} onRemoveTag={handleRemoveTag} />
      )}

      {/* AI Tag suggestions (hide when keyboard open to maximize edit area) */}
      {!isKeyboardOpen && aiTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
          <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">AI 태그</span>
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
    </div>
  )

  const previewContent = (
    <div className="flex-1 min-h-[300px] pb-8">
      {title && (
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
          {title}
        </h1>
      )}
      <MarkdownPreview content={body} onCheckboxToggle={handleCheckboxToggle} />
      {/* AI Summary + Backlinks — inside preview to avoid overlapping edit area */}
      {!isFocusMode && memoId && (
        <div className="mt-4 space-y-3">
          <AISummaryPanel content={body} />
          <BacklinksPanel memoId={memoId} title={title} />
          <Suspense fallback={null}>
            <RelatedMemosPanel memoId={memoId} tags={currentTags} body={body} />
          </Suspense>
        </div>
      )}
    </div>
  )

  // ── Command palette (complements the `/` slash menu with non-insert actions) ──
  const insertSnippet = (snippet: string) => {
    if (isTiptap && tiptapEditor) { tiptapEditor.chain().focus().insertContent(snippet).run(); return }
    const ta = bodyRef.current
    if (!ta) { handleBodyChange(body ? `${body}\n${snippet}` : snippet); return }
    const value = ta.value
    const start = ta.selectionStart
    const end = ta.selectionEnd
    handleBodyChange(value.substring(0, start) + snippet + value.substring(end))
    requestAnimationFrame(() => { ta.focus(); const p = start + snippet.length; ta.setSelectionRange(p, p) })
  }

  const runAIEnhanceFromPalette = async () => {
    if (!body || body.trim().length < 20) { useToastStore.getState().showToast('내용이 너무 짧습니다 (20자 이상 필요)', 'warning'); return }
    const { enhanceReadability } = await import('@/services/aiFeatures')
    const result = await enhanceReadability(body)
    if (result.error) { useToastStore.getState().showToast(`AI 편집 실패: ${result.error}`, 'error'); return }
    if (result.enhanced) handleAIEnhance(result.enhanced)
  }

  const exportMarkdownFromPalette = () => {
    const content = `# ${title || '제목 없음'}\n\n${body || ''}`
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title || 'memo'}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const paletteCommands: EditorCommand[] = [
    { id: 'heading', group: '삽입', label: '제목', icon: <Heading2 className="w-4 h-4" />, run: () => insertSnippet('## ') },
    { id: 'list', group: '삽입', label: '목록', icon: <List className="w-4 h-4" />, run: () => insertSnippet('- ') },
    { id: 'checklist', group: '삽입', label: '체크리스트', icon: <CheckSquare className="w-4 h-4" />, run: () => insertSnippet('- [ ] ') },
    { id: 'codeblock', group: '삽입', label: '코드 블록', icon: <Code2 className="w-4 h-4" />, run: () => insertSnippet('```\n\n```') },
    { id: 'quote', group: '삽입', label: '인용', icon: <Quote className="w-4 h-4" />, run: () => insertSnippet('> ') },
    { id: 'divider', group: '삽입', label: '구분선', icon: <Minus className="w-4 h-4" />, run: () => insertSnippet('\n---\n') },
    ...(isMdUp ? [{ id: 'outline', group: '보기 · 도구', label: '아웃라인 토글', icon: <ListTree className="w-4 h-4" />, run: () => setShowOutline((p) => !p) }] : []),
    ...(alterEgoEnabled ? [{ id: 'alterego', group: '보기 · 도구', label: '데미안(AI 대화) 토글', icon: <Brain className="w-4 h-4" />, run: () => setShowAlterEgo((p) => !p) }] : []),
    { id: 'focus', group: '보기 · 도구', label: '집중 모드', icon: <Maximize2 className="w-4 h-4" />, run: () => useUIStore.getState().toggleFocusMode() },
    ...(memoId ? [{ id: 'slide', group: '보기 · 도구', label: '슬라이드 보기', icon: <MonitorPlay className="w-4 h-4" />, shortcut: 'F5', run: () => useUIStore.getState().openSlideView(memoId) }] : []),
    ...(memoId ? [{ id: 'versions', group: '보기 · 도구', label: '버전 기록', icon: <History className="w-4 h-4" />, run: () => setShowVersionHistory(true) }] : []),
    { id: 'ai-enhance', group: 'AI · 내보내기', label: 'AI 가독성 편집', icon: <Wand2 className="w-4 h-4" />, run: runAIEnhanceFromPalette },
    { id: 'export-md', group: 'AI · 내보내기', label: '마크다운 내보내기', icon: <Download className="w-4 h-4" />, run: exportMarkdownFromPalette },
  ]

  return (
    <div
      className={clsx(
        // 에디터 화면에서는 글로벌 헤더가 숨겨지므로(Header.tsx) 헤더 몫 4rem을 빼지 않는다.
        // 하단 내비(5rem)만 확보 — 이전엔 사라진 헤더 자리만큼 하단에 빈 공간이 생겼다.
        'flex flex-col lg:h-full min-h-0',
        !isKeyboardOpen && 'h-[calc(var(--stable-vh,100svh)-5rem)]',
        isFocusMode && '!h-[var(--stable-vh,100svh)]'
      )}
      style={isKeyboardOpen && !isFocusMode ? { height: `calc(var(--stable-vh, 100svh) - ${Math.max(0, keyboardHeight || 0)}px)` } : undefined}
    >
      {!isFocusMode && !isKeyboardOpen && (
        <EditorHeader
          isStarred={isStarred}
          onBack={handleBack}
          onToggleStar={handleToggleStar}
          onOpenVersionHistory={memoId ? () => setShowVersionHistory(true) : undefined}
          memoId={memoId}
          saveStatus={saveStatus}
          title={title}
          body={body}
          tags={currentTags}
          isPinned={memo?.isPinned ?? false}
          memoColor={memoColor}
          onColorChange={(color) => {
            setMemoColor(color)
            if (memoId) updateMemo(memoId, { color })
          }}
        />
      )}

      {/* Time Machine banner */}
      {timeMachineActive && memo?.contextSnapshot && !isFocusMode && !isKeyboardOpen && (
        <TimeMachineBanner snapshot={memo.contextSnapshot} onDismiss={dismissTimeMachine} />
      )}

      {/* Editor toolbar (above content, hidden when keyboard open to maximize edit area) */}
      {(isTiptap || activeTab === 'edit' || isSplit) && !isFocusMode && !isKeyboardOpen && (
        <EditorToolbar
          textareaRef={bodyRef}
          tiptapEditor={isTiptap ? tiptapEditor : undefined}
          onContentChange={handleBodyChange}
          onUndo={isTiptap ? () => tiptapEditor?.commands.undo() : undoText}
          onRedo={isTiptap ? () => tiptapEditor?.commands.redo() : redoText}
          canUndo={isTiptap ? (tiptapEditor?.can().undo() ?? false) : undoCount > 0}
          canRedo={isTiptap ? (tiptapEditor?.can().redo() ?? false) : redoCount > 0}
          memoId={memoId}
          body={body}
          onAIEnhance={handleAIEnhance}
          onToggleAlterEgo={() => setShowAlterEgo((prev) => !prev)}
          alterEgoEnabled={alterEgoEnabled}
          onToggleOutline={isMdUp ? () => setShowOutline((prev) => !prev) : undefined}
          onSlideView={memoId ? () => useUIStore.getState().openSlideView(memoId) : undefined}
          onOpenCommandPalette={() => setShowCommandPalette(true)}
        />
      )}

      <div className="flex-1 flex min-h-0">
        <div className={clsx(
          'flex-1 flex flex-col min-h-0 overflow-y-auto',
          isFocusMode
            ? 'max-w-2xl mx-auto w-full px-6 pt-12'
            : 'px-4 lg:px-8 max-w-[var(--editor-measure)] mx-auto w-full'
        )}>
          {/* tiptap/split 모드: 폴더 선택기 단독 행. 탭 모드에서는 아래 탭과 한 행으로 병합한다. */}
          {!isFocusMode && !isKeyboardOpen && (isTiptap || isSplit) && (
            <FolderSelector
              currentFolder={currentFolder}
              onFolderChange={handleFolderChange}
            />
          )}

          {isTiptap ? (
            /* Tiptap WYSIWYG: single-pane editing IS the preview */
            <div className="flex-1 flex flex-col min-h-0">
              {editContent}
              {!isFocusMode && !isKeyboardOpen && memoId && (
                <div className="mt-4 space-y-3 pb-4 shrink-0">
                  <AISummaryPanel content={body} />
                  <BacklinksPanel memoId={memoId} title={title} />
                  <Suspense fallback={null}>
                    <RelatedMemosPanel memoId={memoId} tags={currentTags} body={body} />
                  </Suspense>
                </div>
              )}
            </div>
          ) : isSplit ? (
            /* Split view: side-by-side edit + preview */
            <div className="flex gap-0 flex-1 min-h-[300px] border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden">
              <div className="flex-1 flex flex-col p-4 overflow-auto">
                {editContent}
              </div>
              <div className="w-px bg-zinc-200 dark:bg-zinc-700 shrink-0" />
              <div ref={splitPreviewRef} className="flex-1 p-4 overflow-auto">
                {previewContent}
              </div>
            </div>
          ) : (
            <>
              {/* A11Y-02: Segmented control with proper ARIA roles.
                  폴더 선택기와 한 행으로 병합해 모바일 세로 공간을 절약한다. */}
              {!isFocusMode && !isKeyboardOpen && (
                <div className="mb-4 flex items-center justify-between gap-3">
                  <FolderSelector
                    currentFolder={currentFolder}
                    onFolderChange={handleFolderChange}
                    className=""
                  />
                  <div className="shrink-0" role="tablist" aria-label="편집기 모드">
                  <div className="inline-flex items-center gap-0.5 p-0.5 rounded-[10px] bg-zinc-100 dark:bg-zinc-800/80">
                    <button
                      role="tab"
                      aria-selected={activeTab === 'edit'}
                      id="tab-edit"
                      aria-controls="panel-edit"
                      onClick={() => setActiveTab('edit')}
                      className={clsx(
                        'px-3.5 py-1.5 text-sm font-medium rounded-[7px] transition-[background-color,color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50',
                        activeTab === 'edit'
                          ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50 shadow-sm'
                          : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
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
                        'px-3.5 py-1.5 text-sm font-medium rounded-[7px] transition-[background-color,color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50',
                        activeTab === 'preview'
                          ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50 shadow-sm'
                          : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                      )}
                    >
                      미리보기
                    </button>
                  </div>
                  </div>
                </div>
              )}

              <div
                role="tabpanel"
                id={activeTab === 'edit' ? 'panel-edit' : 'panel-preview'}
                aria-labelledby={activeTab === 'edit' ? 'tab-edit' : 'tab-preview'}
                className="flex-1 flex flex-col min-h-0"
              >
                <div key={activeTab} className="flex-1 flex flex-col min-h-0 animate-in fade-in duration-200">
                  {(activeTab === 'edit' || isFocusMode) ? editContent : previewContent}
                </div>
              </div>
            </>
          )}

          {/* AI Summary + Backlinks moved into previewContent and tiptap section above */}
        </div>

        {/* Outline panel — desktop only */}
        {showOutline && isMdUp && !isFocusMode && (
          <div className="hidden md:block w-52 shrink-0">
            <EditorOutline body={body} onScrollToLine={handleOutlineScrollToLine} onScrollToHeadingIndex={isTiptap ? handleOutlineScrollToHeadingIndex : undefined} onClose={() => setShowOutline(false)} />
          </div>
        )}

        {/* Alter Ego (데미안) side panel — desktop */}
        {showAlterEgo && alterEgoEnabled && !isFocusMode && (
          <div className="hidden md:flex w-80 shrink-0">
            <AlterEgoPanel body={body} onClose={() => setShowAlterEgo(false)} />
          </div>
        )}
      </div>

      {/* Alter Ego (데미안) bottom sheet — mobile only (<md) */}
      {showAlterEgo && alterEgoEnabled && !isFocusMode && (
        <>
          <div className="md:hidden fixed inset-0 z-30 bg-black/30" onClick={() => setShowAlterEgo(false)} />
          <div className="md:hidden fixed inset-x-0 bottom-0 z-30 h-[60dvh] bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-700 rounded-t-2xl shadow-2xl flex flex-col">
            <div className="w-10 h-1 bg-zinc-300 dark:bg-zinc-600 rounded-full mx-auto mt-2 mb-1 shrink-0" />
            <AlterEgoPanel body={body} onClose={() => setShowAlterEgo(false)} />
          </div>
        </>
      )}

      {/* Mobile/tablet keyboard accessory bar — keeps formatting reachable while typing.
          Pinned just above the soft keyboard; desktop is unaffected (keeps its own toolbar). */}
      {!isLg && isKeyboardOpen && !isFocusMode && (isTiptap || activeTab === 'edit') && (
        <div className="fixed inset-x-0 z-40" style={{ bottom: `${Math.max(0, keyboardHeight || 0)}px` }}>
          <EditorToolbar
            variant="keyboard"
            textareaRef={bodyRef}
            tiptapEditor={isTiptap ? tiptapEditor : undefined}
            onContentChange={handleBodyChange}
            onUndo={isTiptap ? () => tiptapEditor?.commands.undo() : undoText}
            onRedo={isTiptap ? () => tiptapEditor?.commands.redo() : redoText}
            canUndo={isTiptap ? (tiptapEditor?.can().undo() ?? false) : undoCount > 0}
            canRedo={isTiptap ? (tiptapEditor?.can().redo() ?? false) : redoCount > 0}
            onDismissKeyboard={() => { bodyRef.current?.blur(); tiptapEditor?.commands.blur() }}
          />
        </div>
      )}

      {/* Focus mode: semi-transparent close button for touch devices / PWA */}
      {isFocusMode && 'ontouchstart' in window && (
        <button
          onClick={() => useUIStore.getState().toggleFocusMode()}
          className="fixed top-4 right-4 z-50 p-2.5 rounded-full bg-zinc-900/30 dark:bg-zinc-100/30 text-zinc-600 dark:text-zinc-300 backdrop-blur-sm opacity-50 hover:opacity-90 active:opacity-100 transition-opacity"
          aria-label="포커스 모드 나가기"
        >
          <X className="w-5 h-5" />
        </button>
      )}

      {/* Editor stats footer */}
      {isFocusMode ? (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 text-xs tabular-nums text-zinc-500 dark:text-zinc-400 bg-white/80 dark:bg-zinc-900/80 backdrop-blur px-4 py-2 rounded-full">
          <FocusTimer />
          <span>·</span>
          <span>{charCount}자</span>
          <span>·</span>
          <span>읽기 약 {readingTime}분</span>
          <span>·</span>
          <button
            onClick={() => useUIStore.getState().toggleFocusMode()}
            className="text-zinc-300 dark:text-zinc-600 hover:text-zinc-500 dark:hover:text-zinc-400 transition-colors"
          >
            나가기
          </button>
        </div>
      ) : (isTiptap || activeTab === 'edit' || isSplit) && charCount > 0 && !isKeyboardOpen && (
        <div className="flex items-center gap-3 px-4 lg:px-8 max-w-[var(--editor-measure)] mx-auto w-full py-1.5 text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
          <span>{charCount.toLocaleString()}자</span>
          <span>·</span>
          <span>읽기 약 {readingTime}분</span>
          {checklistStats && (
            <>
              <span>·</span>
              <span className="flex items-center gap-1.5 tabular-nums">
                <span className="inline-block w-16 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
                  <span
                    className="block h-full rounded-full bg-primary-500 transition-all duration-300"
                    style={{ width: `${checklistStats.total > 0 ? (checklistStats.checked / checklistStats.total) * 100 : 0}%` }}
                  />
                </span>
                {checklistStats.checked}/{checklistStats.total}
              </span>
            </>
          )}
        </div>
      )}

      {/* Save status indicator bar — 고정 높이 트랙에 페인트 속성만 전환해
          autosave 사이클마다 레이아웃이 2px씩 출렁이지 않게 한다 */}
      <div className="h-0.5 w-full shrink-0" aria-hidden="true">
        <div
          className={clsx(
            'h-full w-full transition-[opacity,background-color] duration-300 ease-standard',
            saveStatus === 'idle' && 'opacity-0',
            saveStatus === 'saving' && 'bg-primary-500 animate-pulse',
            saveStatus === 'saved' && 'bg-success-500',
            saveStatus === 'modified' && 'bg-zinc-300 dark:bg-zinc-600',
            saveStatus === 'error' && 'bg-danger-500'
          )}
        />
      </div>

      {/* Floating toolbar for text selection (legacy mode only) */}
      {!isTiptap && (activeTab === 'edit' || isSplit) && (
        <FloatingToolbar textareaRef={bodyRef} onInsert={insertMarkdown} />
      )}

      {/* Slash command menu (legacy mode only) */}
      {!isTiptap && slashOpen && (
        <SlashCommandMenu
          query={slashQuery}
          position={slashPos}
          onSelect={handleSlashSelect}
          onClose={() => setSlashOpen(false)}
        />
      )}

      {/* Version history panel */}
      {showVersionHistory && memoId && (
        <Suspense fallback={<div className="flex items-center justify-center p-8"><Spinner size="md" className="text-primary-500" /></div>}>
          <VersionHistory
            memoId={memoId}
            currentTitle={title}
            currentBody={body}
            onRestore={handleVersionRestore}
            onClose={() => setShowVersionHistory(false)}
          />
        </Suspense>
      )}

      {/* Editor command palette */}
      {showCommandPalette && (
        <EditorCommandPalette commands={paletteCommands} onClose={() => setShowCommandPalette(false)} />
      )}
    </div>
  )
}
