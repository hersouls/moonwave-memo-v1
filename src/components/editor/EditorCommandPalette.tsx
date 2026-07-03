import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { DialogBackdrop, DialogPanel, Dialog as HeadlessDialog } from '@headlessui/react'
import { Search } from 'lucide-react'
import { Kbd } from '@/components/ui/Kbd'

export interface EditorCommand {
  id: string
  label: string
  icon: React.ReactNode
  group: string
  keywords?: string
  /** 우측 정렬 단축키 칩 (예: 'F5') */
  shortcut?: string
  run: () => void
}

interface EditorCommandPaletteProps {
  commands: EditorCommand[]
  onClose: () => void
}

// Complementary editor command palette: searchable, keyboard-navigable access to
// editor actions (insert + view/tools + AI/export). Complements the `/` slash menu
// by adding non-insert actions and a global (button) trigger.
export function EditorCommandPalette({ commands, onClose }: EditorCommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  // 조건부 마운트 환경에서 퇴장 애니메이션을 재생하기 위한 내부 open 상태
  const [open, setOpen] = useState(true)

  const requestClose = useCallback(() => {
    setOpen(false)
    window.setTimeout(onClose, 150)
  }, [onClose])

  // 커맨드 실행은 팔레트 언마운트(+ Headless UI 포커스 복원) 이후로 미뤄
  // insertSnippet 등의 에디터 포커스가 포커스 복원에 덮어써지지 않게 한다
  const runCommand = useCallback(
    (cmd: EditorCommand) => {
      setOpen(false)
      window.setTimeout(() => {
        onClose()
        requestAnimationFrame(() => cmd.run())
      }, 150)
    },
    [onClose]
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        (c.keywords?.toLowerCase().includes(q) ?? false)
    )
  }, [commands, query])

  const groups = useMemo(() => {
    const map = new Map<string, EditorCommand[]>()
    for (const c of filtered) {
      const arr = map.get(c.group)
      if (arr) arr.push(c)
      else map.set(c.group, [c])
    }
    return [...map.entries()]
  }, [filtered])

  useEffect(() => setSelected(0), [query])
  useEffect(() => inputRef.current?.focus(), [])

  // Window-capture keydown (like SlashCommandMenu) so navigation keys don't leak to
  // global shortcuts (e.g. App's Escape → focus mode).
  const filteredRef = useRef(filtered)
  filteredRef.current = filtered
  const selectedRef = useRef(selected)
  selectedRef.current = selected
  const runCommandRef = useRef(runCommand)
  runCommandRef.current = runCommand
  const requestCloseRef = useRef(requestClose)
  requestCloseRef.current = requestClose
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const list = filteredRef.current
      if (e.key === 'ArrowDown') {
        e.preventDefault(); e.stopPropagation()
        setSelected((i) => (i + 1) % (list.length || 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault(); e.stopPropagation()
        setSelected((i) => (i - 1 + list.length) % (list.length || 1))
      } else if (e.key === 'Enter') {
        e.preventDefault(); e.stopPropagation()
        const cmd = list[selectedRef.current]
        if (cmd) runCommandRef.current(cmd)
      } else if (e.key === 'Escape') {
        e.preventDefault(); e.stopPropagation()
        requestCloseRef.current()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  return (
    <HeadlessDialog
      open={open}
      onClose={requestClose}
      className="relative z-[var(--z-modal)]"
      aria-label="에디터 명령 팔레트"
    >
      <DialogBackdrop
        transition
        className="fixed inset-0 transition data-[closed]:opacity-0 data-[enter]:duration-200 data-[leave]:duration-150 data-[enter]:ease-out data-[leave]:ease-in"
        style={{ background: 'var(--overlay-bg)' }}
      />
      <div className="fixed inset-0 flex items-start justify-center px-4 pt-[12vh]">
        <DialogPanel
          transition
          className="w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900 transition duration-200 data-[closed]:-translate-y-2 data-[closed]:scale-[0.98] data-[closed]:opacity-0 data-[enter]:ease-out data-[leave]:duration-150 data-[leave]:ease-in"
        >
          <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
            <Search className="h-4 w-4 shrink-0 text-zinc-400" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="명령 검색…"
              className="flex-1 bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100 dark:placeholder:text-zinc-500"
              aria-label="명령 검색"
            />
          </div>
          <div className="max-h-[50vh] overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">결과 없음</div>
            ) : (
              groups.map(([group, cmds]) => (
                <div key={group}>
                  <div className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    {group}
                  </div>
                  {cmds.map((cmd) => {
                    const idx = filtered.indexOf(cmd)
                    return (
                      <button
                        key={cmd.id}
                        role="option"
                        aria-selected={idx === selected}
                        onMouseEnter={() => setSelected(idx)}
                        onClick={() => runCommand(cmd)}
                        className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors ${
                          idx === selected
                            ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300'
                            : 'text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800'
                        }`}
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                          {cmd.icon}
                        </span>
                        <span className="flex-1 truncate">{cmd.label}</span>
                        {cmd.shortcut && <Kbd>{cmd.shortcut}</Kbd>}
                      </button>
                    )
                  })}
                </div>
              ))
            )}
          </div>
          {/* 키보드 힌트 푸터 */}
          <div className="flex items-center gap-3 border-t border-zinc-100 px-4 py-2 text-[11px] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            <span className="flex items-center gap-1">
              <Kbd>↑↓</Kbd> 이동
            </span>
            <span className="flex items-center gap-1">
              <Kbd>↵</Kbd> 실행
            </span>
            <span className="flex items-center gap-1">
              <Kbd>esc</Kbd> 닫기
            </span>
          </div>
        </DialogPanel>
      </div>
    </HeadlessDialog>
  )
}
