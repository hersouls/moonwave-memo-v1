import { useState, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Heading2, List, CheckSquare, Code2, Quote, Minus, Mic, Camera } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'

type CommandCategory = 'format' | 'insert' | 'ai'

interface SlashCommand {
  id: string
  label: string
  icon: React.ReactNode
  category: CommandCategory
  insert?: string
  action?: () => void
}

interface SlashCommandMenuProps {
  query: string
  position: { top: number; left: number }
  onSelect: (insert: string) => void
  onClose: () => void
}

const CATEGORY_LABELS: Record<CommandCategory, string> = {
  format: '서식',
  insert: '삽입',
  ai: 'AI',
}

const commands: SlashCommand[] = [
  { id: 'heading', label: '제목', icon: <Heading2 className="w-4 h-4" />, category: 'format', insert: '## ' },
  { id: 'list', label: '목록', icon: <List className="w-4 h-4" />, category: 'format', insert: '- ' },
  { id: 'checklist', label: '체크리스트', icon: <CheckSquare className="w-4 h-4" />, category: 'format', insert: '- [ ] ' },
  { id: 'code', label: '코드 블록', icon: <Code2 className="w-4 h-4" />, category: 'insert', insert: '```\n\n```' },
  { id: 'quote', label: '인용', icon: <Quote className="w-4 h-4" />, category: 'insert', insert: '> ' },
  { id: 'divider', label: '구분선', icon: <Minus className="w-4 h-4" />, category: 'insert', insert: '\n---\n' },
  { id: 'voice', label: '음성 입력', icon: <Mic className="w-4 h-4" />, category: 'ai' },
  { id: 'image', label: '이미지 OCR', icon: <Camera className="w-4 h-4" />, category: 'ai' },
]

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const group = key(item)
    ;(acc[group] ??= []).push(item)
    return acc
  }, {} as Record<string, T[]>)
}

export function SlashCommandMenu({ query, position, onSelect, onClose }: SlashCommandMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)

  const filtered = commands.filter((cmd) =>
    cmd.label.toLowerCase().includes(query.toLowerCase()) ||
    cmd.id.toLowerCase().includes(query.toLowerCase())
  )

  const grouped = useMemo(() => {
    const groups = groupBy(filtered, (cmd) => cmd.category)
    return Object.entries(groups) as [CommandCategory, SlashCommand[]][]
  }, [filtered])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  // Flat index for keyboard navigation across groups
  const flatIndex = (categoryIdx: number, itemIdx: number) => {
    let idx = 0
    for (let i = 0; i < categoryIdx; i++) {
      idx += (grouped[i]?.[1]?.length ?? 0)
    }
    return idx + itemIdx
  }

  // Use refs to avoid stale closures in keydown handler
  const filteredRef = useRef(filtered)
  filteredRef.current = filtered

  const handleSelect = (cmd: SlashCommand) => {
    if (cmd.insert) {
      onSelect(cmd.insert)
    } else if (cmd.id === 'voice') {
      useUIStore.getState().openVoiceModal()
      onClose()
    } else if (cmd.id === 'image') {
      useUIStore.getState().openImageOCRModal()
      onClose()
    }
  }

  const handleSelectRef = useRef(handleSelect)
  handleSelectRef.current = handleSelect

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((i) => (i + 1) % (filteredRef.current.length || 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((i) => (i - 1 + filteredRef.current.length) % (filteredRef.current.length || 1))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const cmd = filteredRef.current[selectedIndex]
        if (cmd) handleSelectRef.current(cmd)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [selectedIndex, onClose])

  if (filtered.length === 0) return null

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      className="fixed z-50 w-60 rounded-xl border border-zinc-200 bg-white py-1.5 shadow-lg dark:border-zinc-700 dark:bg-zinc-900 animate-in fade-in slide-in-from-bottom duration-150"
      style={{ top: `${position.top}px`, left: `${position.left}px` }}
    >
      {grouped.map(([category, cmds], catIdx) => (
        <div key={category}>
          <div className="px-3 pt-2 pb-1 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
            {CATEGORY_LABELS[category]}
          </div>
          {cmds.map((cmd, itemIdx) => {
            const idx = flatIndex(catIdx, itemIdx)
            return (
              <button
                key={cmd.id}
                role="menuitem"
                onClick={() => handleSelect(cmd)}
                className={`flex w-full items-center gap-3 px-3 py-2 text-sm transition-colors ${
                  idx === selectedIndex
                    ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300'
                    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                }`}
              >
                <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                  {cmd.icon}
                </span>
                {cmd.label}
              </button>
            )
          })}
        </div>
      ))}
    </div>,
    document.body
  )
}
