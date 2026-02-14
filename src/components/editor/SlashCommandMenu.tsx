import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Heading2, List, CheckSquare, Code2, Quote, Minus, Mic, Camera } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'

interface SlashCommand {
  id: string
  label: string
  icon: React.ReactNode
  insert?: string
  action?: () => void
}

interface SlashCommandMenuProps {
  query: string
  position: { top: number; left: number }
  onSelect: (insert: string) => void
  onClose: () => void
}

const commands: SlashCommand[] = [
  { id: 'heading', label: '제목', icon: <Heading2 className="w-4 h-4" />, insert: '## ' },
  { id: 'list', label: '목록', icon: <List className="w-4 h-4" />, insert: '- ' },
  { id: 'checklist', label: '체크리스트', icon: <CheckSquare className="w-4 h-4" />, insert: '- [ ] ' },
  { id: 'code', label: '코드 블록', icon: <Code2 className="w-4 h-4" />, insert: '```\n\n```' },
  { id: 'quote', label: '인용', icon: <Quote className="w-4 h-4" />, insert: '> ' },
  { id: 'divider', label: '구분선', icon: <Minus className="w-4 h-4" />, insert: '\n---\n' },
  { id: 'voice', label: '음성 입력', icon: <Mic className="w-4 h-4" /> },
  { id: 'image', label: '이미지 OCR', icon: <Camera className="w-4 h-4" /> },
]

export function SlashCommandMenu({ query, position, onSelect, onClose }: SlashCommandMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)

  const filtered = commands.filter((cmd) =>
    cmd.label.toLowerCase().includes(query.toLowerCase()) ||
    cmd.id.toLowerCase().includes(query.toLowerCase())
  )

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((i) => (i + 1) % filtered.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const cmd = filtered[selectedIndex]
        if (cmd) handleSelect(cmd)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex, filtered.length])

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

  if (filtered.length === 0) return null

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-50 w-56 rounded-xl border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900 animate-in fade-in slide-in-from-bottom duration-150"
      style={{ top: `${position.top}px`, left: `${position.left}px` }}
    >
      {filtered.map((cmd, index) => (
        <button
          key={cmd.id}
          onClick={() => handleSelect(cmd)}
          className={`flex w-full items-center gap-3 px-3 py-2 text-sm transition-colors ${
            index === selectedIndex
              ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300'
              : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
          }`}
        >
          <span className="text-zinc-400">{cmd.icon}</span>
          {cmd.label}
        </button>
      ))}
    </div>,
    document.body
  )
}
