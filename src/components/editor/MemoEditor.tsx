import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { EditorHeader } from './EditorHeader'
import { FolderSelector } from './FolderSelector'
import { EditorToolbar } from './EditorToolbar'
import { useMemoStore } from '@/stores/memoStore'
import { useFolderStore } from '@/stores/folderStore'
import { useSettingsStore } from '@/stores/settingsStore'

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
      await updateMemo(memoId, { title, body, folderId })
    } else if (!hasCreated.current && (title.trim() || body.trim())) {
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
      // Final save will be handled by the debounce
    }
  }, [])

  const handleTitleChange = (value: string) => {
    setTitle(value)
    scheduleAutoSave()
  }

  const handleBodyChange = (value: string) => {
    setBody(value)
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
    navigate(-1)
  }

  const currentFolder = folders.find((f) => f.id === folderId)

  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-4rem)]">
      <EditorHeader
        isStarred={isStarred}
        onBack={handleBack}
        onToggleStar={handleToggleStar}
        memoId={memoId}
      />

      <div className="flex-1 px-4 lg:px-8 max-w-4xl mx-auto w-full">
        <FolderSelector
          currentFolder={currentFolder}
          onFolderChange={handleFolderChange}
        />

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
          placeholder="메모를 입력하세요."
          className="w-full flex-1 min-h-[300px] text-zinc-700 dark:text-zinc-300 placeholder:text-zinc-300 dark:placeholder:text-zinc-600 bg-transparent border-none outline-none resize-none leading-relaxed"
        />
      </div>

      <EditorToolbar />
    </div>
  )
}
