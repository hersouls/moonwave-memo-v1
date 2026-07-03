import { useEffect, useState } from 'react'
import { useUndoStore, UNDO_TIMEOUT } from '@/stores/undoStore'
import { useUIStore } from '@/stores/uiStore'
import { X } from 'lucide-react'

/** 진행 바 카운트다운 길이 — 스토어의 자동 소멸 타이머와 단일 소스로 동기화 */
const UNDO_TIMEOUT_MS = UNDO_TIMEOUT
/** foundation-toast.css --snackbar-leave-duration(var(--duration-fast))과 동기화 */
const LEAVE_MS = 150

interface DisplayedEntry {
  count: number
  /** 새 삭제가 발생하면 timestamp가 바뀌어 진행 바 애니메이션이 재시작된다 */
  timestamp: number
}

export function UndoToast() {
  const { current, isVisible, undo, dismiss } = useUndoStore()
  const isKeyboardOpen = useUIStore((s) => s.isKeyboardOpen)

  // 스토어 상태가 꺼진 뒤에도 퇴장 애니메이션 동안 마지막 엔트리를 유지
  const [displayed, setDisplayed] = useState<DisplayedEntry | null>(null)
  const [isLeaving, setIsLeaving] = useState(false)

  useEffect(() => {
    if (isVisible && current) {
      setDisplayed({ count: current.memos.length, timestamp: current.timestamp })
      setIsLeaving(false)
      return
    }
    // 자동 만료/실행 취소/닫기 — 모두 같은 퇴장 애니메이션을 거친다
    setIsLeaving(true)
    const timer = setTimeout(() => {
      setDisplayed(null)
      setIsLeaving(false)
    }, LEAVE_MS)
    return () => clearTimeout(timer)
  }, [isVisible, current])

  if (!displayed) return null

  const message =
    displayed.count === 1 ? '메모가 삭제되었습니다' : `메모 ${displayed.count}개가 삭제되었습니다`

  return (
    <div
      className="snackbar-container md:!bottom-8"
      style={isKeyboardOpen ? { bottom: '1rem' } : undefined}
    >
      <div
        key={displayed.timestamp}
        className={`snackbar snackbar--with-action ${isLeaving ? 'snackbar--leaving' : 'snackbar--entering'}`}
        role="status"
        style={{ '--snackbar-auto-dismiss': `${UNDO_TIMEOUT_MS}ms` } as React.CSSProperties}
      >
        <span className="snackbar__text">{message}</span>

        <button onClick={undo} className="snackbar__action">
          실행 취소
        </button>

        <button
          onClick={dismiss}
          className="flex h-11 w-11 shrink-0 -my-3 items-center justify-center rounded-full opacity-60 transition-opacity hover:opacity-100"
          aria-label="닫기"
        >
          <X className="h-4 w-4" />
        </button>

        {/* 실행 취소 가능 시간 카운트다운 */}
        <div className="snackbar__progress" aria-hidden="true" />
      </div>
    </div>
  )
}
