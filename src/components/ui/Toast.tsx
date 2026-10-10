/* 결과 알림: 키트의 Toast와 Snackbar로 그려요. 한 번에 하나만 보여요.
   글자만이면 Toast(3초), 행동이 붙으면 Snackbar(5초)예요. https://ux.moonwave.kr/components/toast */
import { useCallback } from 'react'
import { useToastStore, type Toast as ToastItem, type ToastType } from '@/stores/toastStore'
import { Toast } from '@/mw/Toast'
import { Snackbar, SnackbarTextButton } from '@/mw/Snackbar'
import { IcLineInfo, IcLineWarning, IcMwCheckCircle } from '@/mw/icons'

const ICON: Record<ToastType, React.ReactNode> = {
  success: <IcMwCheckCircle size={20} />,
  error: <IcLineWarning size={20} />,
  warning: <IcLineWarning size={20} />,
  info: <IcLineInfo size={20} />,
}

/** 성공과 안내는 status, 오류와 경고만 alert로 읽어요 */
function roleOf(type: ToastType): 'alert' | 'status' {
  return type === 'error' || type === 'warning' ? 'alert' : 'status'
}

function ToastView({ toast }: { toast: ToastItem }) {
  const removeToast = useToastStore((s) => s.removeToast)
  const onClose = useCallback(() => removeToast(toast.id), [removeToast, toast.id])

  if (toast.action) {
    const action = toast.action
    return (
      <Snackbar
        className="memo-toast"
        role={roleOf(toast.type)}
        icon="on"
        iconElement={ICON[toast.type]}
        message={toast.message}
        duration={Math.max(toast.duration, 5000)}
        onClose={onClose}
        actionElement={<SnackbarTextButton onClick={() => { action.onClick(); onClose() }}>{action.label}</SnackbarTextButton>}
      />
    )
  }
  return (
    <Toast className="memo-toast" role={roleOf(toast.type)} type="icon" icon={ICON[toast.type]} duration={toast.duration} onClose={onClose}>
      {toast.message}
    </Toast>
  )
}

export function ToastContainer() {
  // 가장 나중 것 하나만 그려요. 앞선 알림은 새 알림이 오면 자리를 내줘요.
  const latest = useToastStore((s) => s.toasts[s.toasts.length - 1])
  if (!latest) return null
  return <ToastView key={latest.id} toast={latest} />
}
