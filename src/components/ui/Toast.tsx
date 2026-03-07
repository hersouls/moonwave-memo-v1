import { useEffect, useState } from 'react'
import { X, CheckCircle, AlertTriangle, Info, AlertCircle } from 'lucide-react'
import clsx from 'clsx'
import { useToastStore, type Toast, type ToastType } from '@/stores/toastStore'

const iconMap: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle />,
  error: <AlertCircle />,
  warning: <AlertTriangle />,
  info: <Info />,
}

const toastClassMap: Record<ToastType, string> = {
  success: 'toast--success',
  error: 'toast--error',
  warning: 'toast--warning',
  info: 'toast--info',
}

function ToastItem({ toast }: { toast: Toast }) {
  const removeToast = useToastStore((s) => s.removeToast)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true))
  }, [])

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(() => removeToast(toast.id), 200)
  }

  return (
    <div
      className={clsx(
        'toast transition-all duration-200',
        toastClassMap[toast.type],
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      )}
      role="alert"
    >
      <span className="toast__icon">{iconMap[toast.type]}</span>
      <span className="toast__message">{toast.message}</span>
      {toast.action && (
        <button
          onClick={() => {
            toast.action!.onClick()
            handleClose()
          }}
          className="shrink-0 text-xs font-semibold underline underline-offset-2 hover:opacity-80 transition-opacity"
        >
          {toast.action.label}
        </button>
      )}
      <button
        onClick={handleClose}
        className="toast__close"
        aria-label="닫기"
      >
        <X />
      </button>
    </div>
  )
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts)

  if (toasts.length === 0) return null

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  )
}
