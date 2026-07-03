import { useEffect, useState, useMemo, useCallback } from 'react'
import { X, CheckCircle, AlertTriangle, Info, AlertCircle } from 'lucide-react'
import clsx from 'clsx'
import { useToastStore, type Toast, type ToastType } from '@/stores/toastStore'
import { isIOS, isAndroid } from '@/utils/platform'
import { useEdgeLightingStore } from './EdgeLighting'

type NotificationStyle = 'android-hun' | 'ios-banner' | 'desktop'

/** 퇴장 애니메이션 길이 — foundation-dialog.css .toast--leaving(var(--duration-fast))과 동기화 */
const LEAVE_MS = 150

function detectStyle(): NotificationStyle {
  if (isAndroid()) return 'android-hun'
  if (isIOS()) return 'ios-banner'
  return 'desktop'
}

const iconMap: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="w-4 h-4" />,
  error: <AlertCircle className="w-4 h-4" />,
  warning: <AlertTriangle className="w-4 h-4" />,
  info: <Info className="w-4 h-4" />,
}

const toastClassMap: Record<ToastType, string> = {
  success: 'toast--success',
  error: 'toast--error',
  warning: 'toast--warning',
  info: 'toast--info',
}

/** HUN/iOS 배너용 아이콘 액센트 — 중립 표면 + 타입별 아이콘 색 */
const iconColorClassMap: Record<ToastType, string> = {
  success: 'text-[var(--toast-success-icon-color)]',
  error: 'text-[var(--toast-error-icon-color)]',
  warning: 'text-[var(--toast-warning-icon-color)]',
  info: 'text-[var(--toast-info-icon-color)]',
}

const edgeLightColorMap: Record<ToastType, 'green' | 'red' | 'amber' | 'blue'> = {
  success: 'green',
  error: 'red',
  warning: 'amber',
  info: 'blue',
}

/** 성공/정보는 polite(status), 오류/경고만 assertive(alert) */
function toastRole(type: ToastType): 'alert' | 'status' {
  return type === 'error' || type === 'warning' ? 'alert' : 'status'
}

// ─── Desktop Toast (neutral elevated pill) ────────
function DesktopToastItem({ toast }: { toast: Toast }) {
  const removeToast = useToastStore((s) => s.removeToast)
  const [isLeaving, setIsLeaving] = useState(false)

  const handleClose = useCallback(() => setIsLeaving(true), [])

  // 아이템이 자기 수명을 소유 — 자동 dismiss 후 퇴장 애니메이션을 재생하고 제거
  useEffect(() => {
    const timer = setTimeout(handleClose, toast.duration)
    return () => clearTimeout(timer)
  }, [toast.duration, handleClose])

  useEffect(() => {
    if (!isLeaving) return
    const timer = setTimeout(() => removeToast(toast.id), LEAVE_MS)
    return () => clearTimeout(timer)
  }, [isLeaving, removeToast, toast.id])

  return (
    <div
      className={clsx('toast', toastClassMap[toast.type], isLeaving && 'toast--leaving')}
      role={toastRole(toast.type)}
    >
      <span className="toast__icon">{iconMap[toast.type]}</span>
      <span className="toast__message">{toast.message}</span>
      {toast.action && (
        <button
          onClick={() => { toast.action!.onClick(); handleClose() }}
          className="shrink-0 text-xs font-semibold underline underline-offset-2 hover:opacity-80 transition-opacity"
        >
          {toast.action.label}
        </button>
      )}
      <button onClick={handleClose} className="toast__close" aria-label="닫기">
        <X />
      </button>
    </div>
  )
}

// ─── Android HUN (full-width top dark bar) ────────
function AndroidHUNToast({ toast }: { toast: Toast }) {
  const removeToast = useToastStore((s) => s.removeToast)
  const [isVisible, setIsVisible] = useState(false)

  const handleClose = useCallback(() => {
    setIsVisible(false)
    setTimeout(() => removeToast(toast.id), 200)
  }, [removeToast, toast.id])

  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true))
    const timer = setTimeout(handleClose, toast.duration)
    return () => clearTimeout(timer)
  }, [toast.duration, handleClose])

  return (
    <div
      className={clsx(
        'hun-toast transition-all duration-200',
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full'
      )}
      role={toastRole(toast.type)}
      onClick={handleClose}
    >
      <div className="flex items-center gap-2.5 px-4 py-3 min-h-[48px]" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}>
        <span className={clsx('shrink-0', iconColorClassMap[toast.type])}>{iconMap[toast.type]}</span>
        <span className="text-xs font-medium text-zinc-400 shrink-0">Memo</span>
        <span className="text-sm text-white truncate flex-1">{toast.message}</span>
        {toast.action && (
          <button
            onClick={(e) => { e.stopPropagation(); toast.action!.onClick(); handleClose() }}
            className="shrink-0 text-xs font-semibold text-primary-400 hover:text-primary-300"
          >
            {toast.action.label}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── iOS Banner (rounded card with blur) ──────────
function IOSBannerToast({ toast }: { toast: Toast }) {
  const removeToast = useToastStore((s) => s.removeToast)
  const [isVisible, setIsVisible] = useState(false)

  const handleClose = useCallback(() => {
    setIsVisible(false)
    setTimeout(() => removeToast(toast.id), 300)
  }, [removeToast, toast.id])

  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true))
    const timer = setTimeout(handleClose, toast.duration)
    return () => clearTimeout(timer)
  }, [toast.duration, handleClose])

  return (
    <div
      className={clsx(
        'ios-banner-toast transition-all duration-300',
        isVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-8 scale-95'
      )}
      role={toastRole(toast.type)}
      onClick={handleClose}
    >
      <div className="flex items-center gap-2.5 px-4 py-3">
        <span className={clsx('shrink-0', iconColorClassMap[toast.type])}>{iconMap[toast.type]}</span>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">Memo</p>
          <p className="text-sm text-zinc-900 dark:text-zinc-100 truncate">{toast.message}</p>
        </div>
        {toast.action && (
          <button
            onClick={(e) => { e.stopPropagation(); toast.action!.onClick(); handleClose() }}
            className="shrink-0 text-xs font-semibold text-primary-500"
          >
            {toast.action.label}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Container ────────────────────────────────────
export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts)
  const style = useMemo(() => detectStyle(), [])

  // Trigger edge lighting on Android
  useEffect(() => {
    if (toasts.length > 0 && style === 'android-hun') {
      const latest = toasts[toasts.length - 1]
      useEdgeLightingStore.getState().trigger(edgeLightColorMap[latest.type])
    }
  }, [toasts, style])

  if (toasts.length === 0) return null

  if (style === 'android-hun') {
    return (
      <div className="fixed top-0 left-0 right-0 z-[var(--z-toast)] flex flex-col pointer-events-none">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <AndroidHUNToast toast={toast} />
          </div>
        ))}
      </div>
    )
  }

  if (style === 'ios-banner') {
    return (
      <div className="fixed left-2 right-2 z-[var(--z-toast)] flex flex-col gap-2 pointer-events-none" style={{ top: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}>
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <IOSBannerToast toast={toast} />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <DesktopToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  )
}
