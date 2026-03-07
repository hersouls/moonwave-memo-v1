import { useEffect, useState } from 'react'
import { X, CheckCircle, AlertTriangle, Info, AlertCircle } from 'lucide-react'
import clsx from 'clsx'
import { useToastStore, type Toast, type ToastType } from '@/stores/toastStore'

const iconMap: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="w-4 h-4" />,
  error: <AlertCircle className="w-4 h-4" />,
  warning: <AlertTriangle className="w-4 h-4" />,
  info: <Info className="w-4 h-4" />,
}

const colorMap: Record<ToastType, string> = {
  success: 'bg-success-50 text-success-800 dark:bg-success-900/30 dark:text-success-300 ring-success-200 dark:ring-success-800',
  error: 'bg-danger-50 text-danger-800 dark:bg-danger-900/30 dark:text-danger-300 ring-danger-200 dark:ring-danger-800',
  warning: 'bg-warning-50 text-warning-800 dark:bg-warning-900/30 dark:text-warning-300 ring-warning-200 dark:ring-warning-800',
  info: 'bg-primary-50 text-primary-800 dark:bg-primary-900/30 dark:text-primary-300 ring-primary-200 dark:ring-primary-800',
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
        'flex items-center gap-2.5 px-4 py-3 rounded-lg shadow-lg ring-1 min-w-[280px] max-w-sm transition-all duration-200',
        colorMap[toast.type],
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      )}
      role="alert"
    >
      <span className="shrink-0">{iconMap[toast.type]}</span>
      <span className="flex-1 text-sm font-medium">{toast.message}</span>
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
        className="shrink-0 -m-2 p-2 rounded-lg hover:opacity-70 transition-opacity min-w-[44px] min-h-[44px] flex items-center justify-center"
        aria-label="닫기"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts)

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[55] flex flex-col-reverse gap-2 md:bottom-8">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  )
}
