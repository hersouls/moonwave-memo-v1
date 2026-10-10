import { useUndoStore, UNDO_TIMEOUT } from '@/stores/undoStore'
import { Snackbar, SnackbarTextButton } from '@/mw/Snackbar'

/** 메모를 지운 뒤 되돌릴 수 있는 동안 보이는 알림이에요. 키트의 Snackbar로 그려요. */
export function UndoToast() {
  const { current, isVisible, undo, dismiss } = useUndoStore()
  if (!current) return null

  const count = current.memos.length
  const message = count === 1 ? '메모를 지웠어요' : `메모 ${count}개를 지웠어요`

  return (
    <Snackbar
      // 새로 지우면 timestamp가 바뀌어 시간이 처음부터 다시 흘러요
      key={current.timestamp}
      className="memo-toast"
      role="status"
      open={isVisible}
      message={message}
      duration={UNDO_TIMEOUT}
      onClose={dismiss}
      actionElement={<SnackbarTextButton onClick={undo}>되돌리기</SnackbarTextButton>}
    />
  )
}
