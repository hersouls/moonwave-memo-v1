import {
  Description,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
  Dialog as HeadlessDialog,
} from '@headlessui/react'
import { useDrag } from '@use-gesture/react'
import { clsx } from 'clsx'
import { X } from 'lucide-react'
import { useState, type ReactNode } from 'react'

interface DialogProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl'
  noPadding?: boolean
}

const sizeStyles = {
  xs: 'sm:max-w-xs',
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-xl',
  '2xl': 'sm:max-w-2xl',
  '3xl': 'sm:max-w-3xl',
  '4xl': 'sm:max-w-4xl',
  '5xl': 'sm:max-w-5xl',
}

export function Dialog({ open, onClose, children, size = 'lg', noPadding = false }: DialogProps) {
  const [dragY, setDragY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  const bind = useDrag(
    ({ active, movement: [, my], velocity: [, vy] }) => {
      if (my < 0) {
        setDragY(0)
        return
      }
      setIsDragging(active)
      if (active) {
        setDragY(Math.max(0, my))
      } else {
        if (my > 100 || vy > 0.5) {
          onClose()
        }
        setDragY(0)
      }
    },
    { axis: 'y', filterTaps: true, pointer: { touch: true } }
  )

  // Headless UI Dialog handles body scroll lock internally (including iOS)
  // Do NOT add useBodyScrollLock here — it would conflict with Headless UI's own scroll lock

  const progress = Math.min(dragY / 200, 1)

  return (
    <HeadlessDialog
      open={open}
      onClose={onClose}
      className="relative z-50"
      onTransitionEnd={() => { if (!open) { setDragY(0); setIsDragging(false) } }}
    >
      <DialogBackdrop
        transition
        className={clsx(
          'fixed inset-0',
          'transition data-[closed]:opacity-0 data-[enter]:duration-300 data-[leave]:duration-200 data-[enter]:ease-out data-[leave]:ease-in'
        )}
        style={{
          background: 'var(--dialog-overlay-bg)',
          opacity: dragY > 0 ? 1 - progress * 0.5 : undefined,
        }}
      />

      <div className="fixed inset-0 overflow-y-auto pt-6 sm:pt-0" style={{ overscrollBehavior: 'contain' }}>
        <div className="grid min-h-full grid-rows-[1fr_auto] justify-items-center sm:grid-rows-[1fr_auto_3fr] sm:p-4">
          <DialogPanel
            transition
            className={clsx(
              'row-start-2 w-full min-w-0 rounded-t-2xl',
              noPadding
                ? 'pb-[env(safe-area-inset-bottom,0px)]'
                : 'p-6 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] sm:p-8 sm:pb-8',
              'sm:mb-auto sm:rounded-xl',
              sizeStyles[size],
              'transition duration-300 data-[closed]:translate-y-12 data-[closed]:opacity-0 data-[enter]:ease-out data-[leave]:ease-in',
              'sm:data-[closed]:translate-y-0 sm:data-[closed]:scale-95 sm:data-[closed]:data-[enter]:duration-300 sm:data-[closed]:data-[leave]:duration-200'
            )}
            style={{
              background: 'var(--dialog-bg)',
              boxShadow: 'var(--dialog-shadow)',
              overscrollBehavior: 'contain',
              transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
              transition: isDragging ? 'none' : undefined,
            }}
          >
            {/* Mobile drag handle */}
            <div {...bind()} className="flex justify-center pt-2 pb-1 cursor-grab active:cursor-grabbing sm:hidden touch-none">
              <div className="w-9 h-1 rounded-full bg-zinc-300 dark:bg-zinc-600" />
            </div>
            {children}
          </DialogPanel>
        </div>
      </div>
    </HeadlessDialog>
  )
}

interface DialogHeaderProps {
  title: string
  description?: string
  onClose?: () => void
}

export function DialogHeader({ title, description, onClose }: DialogHeaderProps) {
  return (
    <div className="relative">
      <DialogTitle className="dialog__title text-balance sm:text-base/6">
        {title}
      </DialogTitle>
      {description && (
        <Description className="dialog__body mt-2 text-pretty text-sm/6 mb-0">
          {description}
        </Description>
      )}
      {onClose && (
        <div className="absolute right-0 top-0">
          <button
            onClick={onClose}
            className="p-3 rounded-lg text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  )
}

interface DialogBodyProps {
  children: ReactNode
  className?: string
}

export function DialogBody({ children, className }: DialogBodyProps) {
  return <div className={clsx('mt-6', className)}>{children}</div>
}

interface DialogFooterProps {
  children: ReactNode
  className?: string
}

export function DialogFooter({ children, className }: DialogFooterProps) {
  return (
    <div
      className={clsx(
        'mt-6 flex flex-col-reverse items-center justify-end gap-3 *:w-full sm:flex-row sm:*:w-auto',
        className
      )}
    >
      {children}
    </div>
  )
}
