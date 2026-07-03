import { useUIStore } from '@/stores/uiStore'
import { Dialog, DialogBody, DialogHeader } from './Dialog'
import { Kbd } from './Kbd'

const SHORTCUT_GROUPS = [
  {
    title: '일반',
    shortcuts: [
      { keys: ['Alt', 'N'], desc: '새 메모' },
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
      { keys: ['F5'], desc: '슬라이드 보기' },
      { keys: ['Ctrl', 'Shift', 'P'], desc: '슬라이드 보기' },
    ],
  },
]

export function KeyboardShortcutsModal() {
  const isOpen = useUIStore((s) => s.isKeyboardShortcutsOpen)
  const close = useUIStore((s) => s.closeKeyboardShortcuts)

  return (
    <Dialog open={isOpen} onClose={close} size="md">
      <DialogHeader title="키보드 단축키" onClose={close} />
      <DialogBody>
        <div className="space-y-5 max-h-[60dvh] fold:max-h-[50dvh] overflow-y-auto">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2">
                {group.title}
              </h3>
              <div className="space-y-1.5">
                {group.shortcuts.map((shortcut) => (
                  <div key={`${shortcut.desc}-${shortcut.keys.join('+')}`} className="flex items-center justify-between py-1">
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">{shortcut.desc}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key) => (
                        <Kbd key={key}>{key}</Kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogBody>
    </Dialog>
  )
}
