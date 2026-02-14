import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Command } from 'cmdk'
import { FileText, Plus, Settings, Moon, Sun, Search, Star, FolderOpen } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'
import { useMemoStore } from '@/stores/memoStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { applyTheme } from '@/stores/settingsStore'

export function CommandPalette() {
  const isOpen = useUIStore((s) => s.isCommandPaletteOpen)
  const close = useUIStore((s) => s.closeCommandPalette)
  const navigate = useNavigate()
  const memos = useMemoStore((s) => s.memos)
  const theme = useSettingsStore((s) => s.settings.theme)
  const setTheme = useSettingsStore((s) => s.setTheme)
  const openSettingsModal = useUIStore((s) => s.openSettingsModal)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (isOpen) setQuery('')
  }, [isOpen])

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

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
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
