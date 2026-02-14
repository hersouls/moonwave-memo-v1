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
  success: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 ring-emerald-200 dark:ring-emerald-800',
  error: 'bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-300 ring-red-200 dark:ring-red-800',
  warning: 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 ring-amber-200 dark:ring-amber-800',
  info: 'bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 ring-blue-200 dark:ring-blue-800',
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
        className="shrink-0 p-0.5 rounded hover:opacity-70 transition-opacity"
        aria-label="닫기"
      >
        <X className="w-3.5 h-3.5" />
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
