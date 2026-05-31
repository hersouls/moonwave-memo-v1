import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Search } from 'lucide-react'

export interface EditorCommand {
  id: string
  label: string
  icon: React.ReactNode
  group: string
  keywords?: string
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
        if (cmd) { onClose(); cmd.run() }
      } else if (e.key === 'Escape') {
        e.preventDefault(); e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const runCommand = (cmd: EditorCommand) => { onClose(); cmd.run() }

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]"
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="에디터 명령 팔레트"
    >
      <div className="fixed inset-0 bg-black/30" />
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900 animate-in fade-in slide-in-from-top-2 duration-150"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
          <Search className="h-4 w-4 shrink-0 text-zinc-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="명령 검색…"
            className="flex-1 bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100"
            aria-label="명령 검색"
          />
        </div>
        <div className="max-h-[50vh] overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-zinc-400">결과 없음</div>
          ) : (
            groups.map(([group, cmds]) => (
              <div key={group}>
                <div className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
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
                      {cmd.label}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
