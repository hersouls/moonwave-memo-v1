import { X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useUIStore } from '@/stores/uiStore'

const SHORTCUT_GROUPS = [
  {
    title: '일반',
    shortcuts: [
      { keys: ['Ctrl', 'N'], desc: '새 메모' },
      { keys: ['Ctrl', 'K'], desc: '명령 팔레트' },
      { keys: ['Ctrl', 'Z'], desc: '실행 취소' },
      { keys: ['Ctrl', '/'], desc: '단축키 안내' },
      { keys: ['Esc'], desc: '뒤로 / 닫기' },
    ],
  },
  {
    title: '편집',
    shortcuts: [
      { keys: ['Ctrl', 'B'], desc: '굵게' },
      { keys: ['Ctrl', 'I'], desc: '기울임' },
      { keys: ['Ctrl', 'Shift', 'C'], desc: '코드 블록' },
      { keys: ['/'], desc: '슬래시 명령' },
      { keys: ['Tab'], desc: 'AI 자동완성 수락' },
    ],
  },
]

export function KeyboardShortcutsModal() {
  const isOpen = useUIStore((s) => s.isKeyboardShortcutsOpen)
  const close = useUIStore((s) => s.closeKeyboardShortcuts)

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="keyboard-shortcuts-title">
      <div className="absolute inset-0 bg-black/50" onClick={close} />
      <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-700">
          <h2 id="keyboard-shortcuts-title" className="text-lg font-bold text-zinc-900 dark:text-zinc-100">키보드 단축키</h2>
          <button
            onClick={close}
            className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="h-5 w-5 text-zinc-500" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5 max-h-[60vh] fold:max-h-[50vh] overflow-y-auto">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-2">
                {group.title}
              </h3>
              <div className="space-y-1.5">
                {group.shortcuts.map((shortcut) => (
                  <div key={shortcut.desc} className="flex items-center justify-between py-1">
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">{shortcut.desc}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key) => (
                        <kbd
                          key={key}
                          className="px-2 py-0.5 text-xs font-mono rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700"
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  )
}
