import { useEffect, useMemo, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Command } from 'cmdk'
import { FileText, Plus, Settings, Moon, Sun, Search, Star, FolderOpen, Sparkles, Loader2 } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'
import { useMemoStore } from '@/stores/memoStore'
import { useFolderStore } from '@/stores/folderStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { applyTheme } from '@/stores/settingsStore'
import { analyzeMemo, classifyMemo } from '@/services/aiFeatures'

export function CommandPalette() {
  const isOpen = useUIStore((s) => s.isCommandPaletteOpen)
  const close = useUIStore((s) => s.closeCommandPalette)
  const navigate = useNavigate()
  const memos = useMemoStore((s) => s.memos)
  const addMemo = useMemoStore((s) => s.addMemo)
  const folders = useFolderStore((s) => s.folders)
  const theme = useSettingsStore((s) => s.settings.theme)
  const setTheme = useSettingsStore((s) => s.setTheme)
  const openSettingsModal = useUIStore((s) => s.openSettingsModal)
  const [query, setQuery] = useState('')
  const [smartMode, setSmartMode] = useState(false)
  const [smartText, setSmartText] = useState('')
  const [isClassifying, setIsClassifying] = useState(false)
  const [classifyResult, setClassifyResult] = useState<{ folder: string | null; tags: string[]; title: string } | null>(null)

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSmartMode(false)
      setSmartText('')
      setClassifyResult(null)
    }
  }, [isOpen])

  const handleSmartSubmit = useCallback(async () => {
    if (!smartText.trim() || isClassifying) return
    setIsClassifying(true)
    setClassifyResult(null)

    const folderNames = folders.filter((f) => !f.isSystem).map((f) => f.name)

    // Try unified LangGraph analysis pipeline first, fallback to classifyMemo
    let result: { folder: string | null; tags: string[]; title: string; error?: string }

    const analysis = await analyzeMemo(smartText, folderNames)
    if (analysis.result) {
      result = {
        folder: analysis.result.classification.folder,
        tags: analysis.result.tags,
        title: analysis.result.classification.title,
      }
    } else {
      // Fallback to single classify call
      result = await classifyMemo(smartText, folderNames)
    }

    if (result.error || (!result.title && !result.folder)) {
      // Fallback: create memo with raw text as body
      const defaultFolder = folders.find((f) => f.isDefault)
      await addMemo({
        title: smartText.slice(0, 50),
        body: smartText,
        folderId: defaultFolder?.id ?? null,
      })
    } else {
      setClassifyResult(result)
      const targetFolder = result.folder
        ? folders.find((f) => f.name === result.folder)
        : folders.find((f) => f.isDefault)

      // Include AI-suggested tags as hashtags in the body so extractTags picks them up
      const tagSuffix = result.tags.length > 0
        ? '\n\n' + result.tags.map((t) => `#${t}`).join(' ')
        : ''

      await addMemo({
        title: result.title || smartText.slice(0, 50),
        body: smartText + tagSuffix,
        folderId: targetFolder?.id ?? null,
      })
    }

    setIsClassifying(false)
    close()
  }, [smartText, isClassifying, folders, addMemo, close])

  const activeMemos = useMemo(
    () => memos.filter((m) => !m.deletedAt).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [memos]
  )

  const recentMemos = activeMemos.slice(0, 5)

  const handleSelect = (action: string) => {
    close()
    switch (action) {
      case 'new-memo':
        navigate('/memo/new')
        break
      case 'settings':
        openSettingsModal()
        break
      case 'toggle-theme': {
        const next = theme === 'dark' ? 'light' : 'dark'
        setTheme(next)
        applyTheme(next)
        break
      }
      case 'dashboard':
        navigate('/')
        break
      case 'all-memos':
        navigate('/memos')
        break
      default:
        if (action.startsWith('memo:')) {
          navigate(`/memo/${action.split(':')[1]}`)
        }
    }
  }

  if (!isOpen) return null

  if (smartMode) {
    return (
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20dvh]">
        <div className="fixed inset-0 bg-black/50" onClick={close} />
        <div className="relative w-full max-w-lg rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
            <Sparkles className="h-4 w-4 shrink-0 text-amber-500" />
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">스마트 메모</span>
            <span className="text-xs text-zinc-400">AI가 폴더와 태그를 자동 분류합니다</span>
          </div>
          <div className="p-4">
            <textarea
              value={smartText}
              onChange={(e) => setSmartText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  handleSmartSubmit()
                }
                if (e.key === 'Escape') {
                  setSmartMode(false)
                }
              }}
              placeholder="떠오르는 생각을 자유롭게 입력하세요..."
              className="w-full h-24 resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              autoFocus
              disabled={isClassifying}
            />
            {classifyResult && (
              <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                폴더: {classifyResult.folder || '기본'} | 태그: {classifyResult.tags.join(', ') || '없음'}
              </div>
            )}
            <div className="mt-3 flex items-center justify-between">
              <button
                onClick={() => setSmartMode(false)}
                className="text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              >
                뒤로
              </button>
              <button
                onClick={handleSmartSubmit}
                disabled={!smartText.trim() || isClassifying}
                className="flex items-center gap-1.5 rounded-lg bg-primary-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isClassifying ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    분류 중...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    저장
                    <kbd className="ml-1 text-[10px] opacity-60">Ctrl+Enter</kbd>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20dvh]">
      <div className="fixed inset-0 bg-black/50" onClick={close} />
      <Command
        className="relative w-full max-w-lg rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900 overflow-hidden"
        label="커맨드 팔레트"
        shouldFilter={true}
      >
        <div className="flex items-center gap-2 border-b border-zinc-200 px-4 dark:border-zinc-700">
          <Search className="h-4 w-4 shrink-0 text-zinc-400" />
          <Command.Input
            value={query}
            onValueChange={setQuery}
            placeholder="메모 검색, 액션 실행..."
            className="flex-1 bg-transparent py-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100"
          />
          <kbd className="hidden sm:inline-flex shrink-0 items-center rounded border border-zinc-200 bg-zinc-100 px-1.5 text-[10px] font-medium text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
            ESC
          </kbd>
        </div>

        <Command.List className="max-h-80 overflow-y-auto p-2">
          <Command.Empty className="py-6 text-center text-sm text-zinc-400">
            결과를 찾을 수 없습니다
          </Command.Empty>

          {!query && (
            <Command.Group heading="최근 메모" className="mb-1">
              {recentMemos.map((memo) => (
                <Command.Item
                  key={memo.id}
                  value={`memo ${memo.title} ${memo.body?.slice(0, 50)}`}
                  onSelect={() => handleSelect(`memo:${memo.id}`)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-zinc-700 cursor-pointer data-[selected=true]:bg-primary-50 data-[selected=true]:text-primary-700 dark:text-zinc-300 dark:data-[selected=true]:bg-primary-900/20 dark:data-[selected=true]:text-primary-300"
                >
                  {memo.isStarred ? (
                    <Star className="h-4 w-4 shrink-0 fill-primary-500 text-primary-500" />
                  ) : (
                    <FileText className="h-4 w-4 shrink-0 text-zinc-400" />
                  )}
                  <span className="truncate">{memo.title || '제목 없음'}</span>
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {query && (
            <Command.Group heading="메모" className="mb-1">
              {activeMemos.map((memo) => (
                <Command.Item
                  key={memo.id}
                  value={`${memo.title} ${memo.body?.slice(0, 100)} ${memo.tags?.join(' ')}`}
                  onSelect={() => handleSelect(`memo:${memo.id}`)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-zinc-700 cursor-pointer data-[selected=true]:bg-primary-50 data-[selected=true]:text-primary-700 dark:text-zinc-300 dark:data-[selected=true]:bg-primary-900/20 dark:data-[selected=true]:text-primary-300"
                >
                  <FileText className="h-4 w-4 shrink-0 text-zinc-400" />
                  <span className="truncate">{memo.title || '제목 없음'}</span>
                </Command.Item>
              ))}
            </Command.Group>
          )}

          <Command.Group heading="액션">
            <Command.Item
              value="스마트 메모 AI 자동 분류"
              onSelect={() => setSmartMode(true)}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-zinc-700 cursor-pointer data-[selected=true]:bg-primary-50 data-[selected=true]:text-primary-700 dark:text-zinc-300 dark:data-[selected=true]:bg-primary-900/20 dark:data-[selected=true]:text-primary-300"
            >
              <Sparkles className="h-4 w-4 shrink-0 text-amber-500" />
              스마트 메모 (AI 자동 분류)
            </Command.Item>
            <Command.Item
              value="새 메모 작성"
              onSelect={() => handleSelect('new-memo')}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-zinc-700 cursor-pointer data-[selected=true]:bg-primary-50 data-[selected=true]:text-primary-700 dark:text-zinc-300 dark:data-[selected=true]:bg-primary-900/20 dark:data-[selected=true]:text-primary-300"
            >
              <Plus className="h-4 w-4 shrink-0 text-zinc-400" />
              새 메모 작성
            </Command.Item>
            <Command.Item
              value="전체 메모 보기"
              onSelect={() => handleSelect('all-memos')}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-zinc-700 cursor-pointer data-[selected=true]:bg-primary-50 data-[selected=true]:text-primary-700 dark:text-zinc-300 dark:data-[selected=true]:bg-primary-900/20 dark:data-[selected=true]:text-primary-300"
            >
              <FolderOpen className="h-4 w-4 shrink-0 text-zinc-400" />
              전체 메모 보기
            </Command.Item>
            <Command.Item
              value="설정"
              onSelect={() => handleSelect('settings')}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-zinc-700 cursor-pointer data-[selected=true]:bg-primary-50 data-[selected=true]:text-primary-700 dark:text-zinc-300 dark:data-[selected=true]:bg-primary-900/20 dark:data-[selected=true]:text-primary-300"
            >
              <Settings className="h-4 w-4 shrink-0 text-zinc-400" />
              설정
            </Command.Item>
            <Command.Item
              value="테마 전환 다크모드 라이트모드"
              onSelect={() => handleSelect('toggle-theme')}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-zinc-700 cursor-pointer data-[selected=true]:bg-primary-50 data-[selected=true]:text-primary-700 dark:text-zinc-300 dark:data-[selected=true]:bg-primary-900/20 dark:data-[selected=true]:text-primary-300"
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 shrink-0 text-zinc-400" />
              ) : (
                <Moon className="h-4 w-4 shrink-0 text-zinc-400" />
              )}
              테마 전환
            </Command.Item>
          </Command.Group>
        </Command.List>
      </Command>
    </div>
  )
}
