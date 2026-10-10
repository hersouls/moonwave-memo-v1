import { Description, DialogBackdrop, DialogPanel, DialogTitle, Dialog as HeadlessDialog } from '@headlessui/react'
import type { HTMLAttributes, ReactNode } from 'react'
import { IcLineClose } from '@/mw/icons'

interface DialogProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl'
  noPadding?: boolean
}

// 내용이 많은 대화상자는 넓게 열어요. 600px 이하에서는 키트가 화면 아래에 붙여요.
const WIDTH = { xs: 'memo-dialog--sm', sm: 'memo-dialog--sm', md: 'memo-dialog--md', lg: 'memo-dialog--md', xl: 'memo-dialog--lg', '2xl': 'memo-dialog--lg', '3xl': 'memo-dialog--xl', '4xl': 'memo-dialog--xl', '5xl': 'memo-dialog--xl' } as const

/**
 * 대화상자예요. 모양은 키트의 Popup(가림막 mw-popup__dim, 자리 mw-popup__container, 카드 mw-popup--center)이고,
 * 포커스를 안에 가두고 Esc와 바깥 누르기로 닫는 일은 Headless UI가 맡아요.
 */
export function Dialog({ open, onClose, children, size = 'lg', noPadding = false }: DialogProps) {
  return (
    <HeadlessDialog open={open} onClose={onClose} className="mw-popup__container">
      <DialogBackdrop className="mw-popup__dim" data-state="open" />
      <DialogPanel className={['mw-popup mw-popup--center memo-dialog', WIDTH[size], noPadding && 'memo-dialog--flush'].filter(Boolean).join(' ')} data-state="open">
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
