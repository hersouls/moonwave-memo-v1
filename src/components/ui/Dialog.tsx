import { Description, DialogBackdrop, DialogPanel, DialogTitle, Dialog as HeadlessDialog } from '@headlessui/react'
import { useLayoutEffect } from 'react'
import type { HTMLAttributes, ReactNode } from 'react'
import { IcLineClose } from '@/mw/icons'

interface DialogProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl'
  noPadding?: boolean
  /** 탭과 긴 내용이 든 대화상자예요. 폰(600px 이하)에서는 화면 전체를 써요 (키트 Popup의 Full Screen). */
  full?: boolean
}

// 내용이 많은 대화상자는 넓게 열어요. 600px 이하에서는 키트가 화면 아래에 붙여요.
const WIDTH = { xs: 'memo-dialog--sm', sm: 'memo-dialog--sm', md: 'memo-dialog--md', lg: 'memo-dialog--md', xl: 'memo-dialog--lg', '2xl': 'memo-dialog--lg', '3xl': 'memo-dialog--xl', '4xl': 'memo-dialog--xl', '5xl': 'memo-dialog--xl' } as const

// 대화상자가 열려 있는 동안 뒤의 화면(앱 뼈대)은 누를 수도, 화면 낭독기로 읽을 수도 없어요.
// Headless UI는 대화상자를 그린 자리의 뿌리만 막아서 뼈대가 그대로 남아 있었어요. 닫힐 때는 포커스가 돌아가기 전에 먼저 풀어요.
let openDialogs = 0
function useInertBackground(open: boolean) {
  useLayoutEffect(() => {
    if (!open) return
    const app = document.querySelector<HTMLElement>('.mw-app')
    if (!app) return
    openDialogs += 1
    app.inert = true
    return () => {
      openDialogs -= 1
      if (openDialogs === 0) app.inert = false
    }
  }, [open])
}

/**
 * 대화상자예요. 모양은 키트의 Popup(가림막 mw-popup__dim, 자리 mw-popup__container, 카드 mw-popup--center)이고,
 * 포커스를 안에 가두고 Esc와 바깥 누르기로 닫는 일은 Headless UI가 맡아요.
 */
export function Dialog({ open, onClose, children, size = 'lg', noPadding = false, full = false }: DialogProps) {
  useInertBackground(open)
  return (
    <HeadlessDialog open={open} onClose={onClose} className="mw-popup__container">
      <DialogBackdrop className="mw-popup__dim" data-state="open" />
      <DialogPanel className={['mw-popup mw-popup--center memo-dialog', WIDTH[size], noPadding && 'memo-dialog--flush', full && 'memo-dialog--full'].filter(Boolean).join(' ')} data-state="open">
        {children}
      </DialogPanel>
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
    <div className="memo-dialog__head">
      <div className="min-w-0 flex-1">
        <DialogTitle className="mw-popup__title">{title}</DialogTitle>
        {description && <Description className="mw-popup__body">{description}</Description>}
      </div>
      {onClose && (
        <button type="button" onClick={onClose} className="mw-icon-button" aria-label="닫기">
          <IcLineClose size={20} />
        </button>
      )}
    </div>
  )
}

interface DialogBodyProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  className?: string
}

export function DialogBody({ children, className, ...props }: DialogBodyProps) {
  return <div className={['memo-dialog__body', className].filter(Boolean).join(' ')} {...props}>{children}</div>
}

interface DialogFooterProps {
  children: ReactNode
  className?: string
}

export function DialogFooter({ children, className }: DialogFooterProps) {
  return <div className={['mw-popup__button-group', className].filter(Boolean).join(' ')}>{children}</div>
}
