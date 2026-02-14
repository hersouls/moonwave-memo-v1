import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { EditorHeader } from './EditorHeader'
import { FolderSelector } from './FolderSelector'
import { EditorToolbar } from './EditorToolbar'
import { MarkdownPreview } from './MarkdownPreview'
import { useMemoStore } from '@/stores/memoStore'
import { useFolderStore } from '@/stores/folderStore'
import { useSettingsStore } from '@/stores/settingsStore'

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
  const defaultColor = useSettingsStore((s) => s.settings.memoSettings.defaultColor)
  const inputStartPosition = useSettingsStore((s) => s.settings.memoSettings.inputStartPosition)
  const folders = useFolderStore((s) => s.folders)
  const getDefaultFolder = useFolderStore((s) => s.getDefaultFolder)

  const isNew = !id || id === 'new'
  const memo = isNew ? null : memos.find((m) => m.id === Number(id))

  const [title, setTitle] = useState(memo?.title || '')
  const [body, setBody] = useState(memo?.body || '')
  const [folderId, setFolderId] = useState<number | null>(
    memo?.folderId ?? defaultFolderId ?? getDefaultFolder()?.id ?? null
  )
  const [isStarred, setIsStarred] = useState(memo?.isStarred || false)
  const [memoId, setMemoId] = useState<number | undefined>(memo?.id)
  const [activeTab, setActiveTab] = useState<EditorTab>('edit')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')

  const titleRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasCreated = useRef(false)

  // Focus on mount
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
  }, [isNew, inputStartPosition])

  // Auto-save with debounce
  const autoSave = useCallback(async () => {
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
        color: defaultColor,
      })
      if (newId) {
        setMemoId(newId)
      }
      setSaveStatus('saved')
    }
  }, [memoId, title, body, folderId, updateMemo, addMemo, defaultColor])

  const scheduleAutoSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(autoSave, 500)
  }, [autoSave])

  // Save on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  const handleTitleChange = (value: string) => {
    setTitle(value)
    setSaveStatus('modified')
    scheduleAutoSave()
  }

  const handleBodyChange = (value: string) => {
    setBody(value)
    setSaveStatus('modified')
    scheduleAutoSave()
  }

  const handleFolderChange = (newFolderId: number) => {
    setFolderId(newFolderId)
    if (memoId) {
      updateMemo(memoId, { folderId: newFolderId })
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

  // Markdown insertion helper (shared with EditorToolbar)
  const insertMarkdown = useCallback((before: string, after: string = '') => {
    const textarea = bodyRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = textarea.value
    const selected = text.substring(start, end)

    const newText = text.substring(0, start) + before + selected + after + text.substring(end)
    handleBodyChange(newText)

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape: go back
      if (e.key === 'Escape') {
        e.preventDefault()
        handleBack()
        return
      }

      // Only handle editor shortcuts in edit tab when textarea is focused
      if (activeTab !== 'edit') return
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
          e.preventDefault()
          insertMarkdown('[', '](url)')
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
  }, [activeTab])

  const currentFolder = folders.find((f) => f.id === folderId)

  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-4rem)] lg:min-h-0">
      <EditorHeader
        isStarred={isStarred}
        onBack={handleBack}
        onToggleStar={handleToggleStar}
        memoId={memoId}
        saveStatus={saveStatus}
      />

      <div className="flex-1 px-4 lg:px-8 max-w-4xl mx-auto w-full">
        <FolderSelector
          currentFolder={currentFolder}
          onFolderChange={handleFolderChange}
        />

        {/* Tab bar */}
        <div className="flex gap-1 mb-4 border-b border-zinc-200 dark:border-zinc-700">
          <button
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

        {activeTab === 'edit' ? (
          <>
            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="제목"
              className="w-full text-2xl font-bold text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-300 dark:placeholder:text-zinc-600 bg-transparent border-none outline-none mb-3"
            />

            <textarea
              ref={bodyRef}
              value={body}
              onChange={(e) => handleBodyChange(e.target.value)}
              placeholder="메모를 입력하세요. 마크다운 문법을 사용할 수 있습니다."
              className="w-full flex-1 min-h-[300px] text-zinc-700 dark:text-zinc-300 placeholder:text-zinc-300 dark:placeholder:text-zinc-600 bg-transparent border-none outline-none resize-none leading-relaxed"
            />
          </>
        ) : (
          <div className="flex-1 min-h-[300px] pb-8">
            {title && (
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
                {title}
              </h1>
            )}
            <MarkdownPreview content={body} />
          </div>
        )}
      </div>

      {activeTab === 'edit' && (
        <EditorToolbar textareaRef={bodyRef} onContentChange={handleBodyChange} />
      )}
    </div>
  )
}
