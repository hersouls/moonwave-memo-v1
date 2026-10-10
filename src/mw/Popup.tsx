/* Moonwave UX — Popup */
import { useEffect, useState } from 'react'
import type { HTMLAttributes, ReactNode, Ref } from 'react'
import { createPortal } from 'react-dom'
import { useCloseRequest } from './close'
import { cx } from './cx'

export type PopupType = 'center' | 'full'

type DivProps = HTMLAttributes<HTMLDivElement> & {
  /** 요소를 가리켜요. */
  ref?: Ref<HTMLDivElement>
}

export type PopupProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  /** 종류예요. center는 가운데 카드, full은 화면 전체를 덮어요. */
  type?: PopupType
  /** 팝업 안에 넣을 내용이에요. `PopupContent`와 `PopupFooter`를 넣어요. */
  children: ReactNode
  /** 열려 있는지 정해요. */
  open?: boolean
  /** 열림 상태를 바꿔야 할 때 불러요. Dim을 누르거나, Esc나 폰의 뒤로 가기를 누르면 `false`를 넘겨요. */
  onOpenChange?: (open: boolean) => void
  /** Dim을 눌렀을 때 닫을지 정해요. */
  closeOnOverlayClick?: boolean
  /** Esc 키와 폰의 뒤로 가기로 닫을지 정해요. */
  closeOnEscape?: boolean
  /** 팝업 컨테이너 요소를 가리켜요. */
  ref?: Ref<HTMLDivElement>
}

/** 닫히는 모션이 끝나기를 기다리는 시간(ms)이에요. */
const EXIT_MS = 200

/** 마운트된 뒤 `document.body`에 그려요. */
function Portal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])
  if (!mounted) return null
  return createPortal(children, document.body)
}

/**
 * 하던 일을 잠시 멈추고 결정을 받는 팝업이에요.
 * `document.body`에 그리고, 열려 있는 동안 배경 스크롤을 막아요.
 */
export function Popup({
  type = 'center',
  className,
  children,
  open = false,
  onOpenChange,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  ref,
  ...props
}: PopupProps) {
  const [isAnimating, setIsAnimating] = useState(false)
  const [shouldRender, setShouldRender] = useState(open)

  useEffect(() => {
    if (open) {
      setShouldRender(true)
      const frame = requestAnimationFrame(() => setIsAnimating(true))
      return () => cancelAnimationFrame(frame)
    }
    setIsAnimating(false)
    const timer = setTimeout(() => setShouldRender(false), EXIT_MS)
    return () => clearTimeout(timer)
  }, [open])

  // Esc와 폰의 뒤로 가기는 같은 닫기 요청이에요
  useCloseRequest(open && closeOnEscape, () => onOpenChange?.(false))

  useEffect(() => {
    if (!open) return
    // 인라인 값을 그대로 되돌려요. 계산된 값을 쓰면 닫힌 뒤에도 body에 인라인 스타일이 남아요.
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [open])

  if (!shouldRender) return null

  const dataState = isAnimating ? 'open' : 'closed'

  return (
    <Portal>
      <div
        className="mw-popup__dim"
        data-state={dataState}
        onClick={() => {
          if (closeOnOverlayClick) onOpenChange?.(false)
        }}
      />
      <div className="mw-popup__container">
        <div
          ref={ref}
          className={cx('mw-popup', `mw-popup--${type}`, className)}
          data-state={dataState}
          onClick={(event) => event.stopPropagation()}
          {...props}
        >
          {children}
        </div>
      </div>
    </Portal>
  )
}

export type PopupContentProps = DivProps
/** 제목과 본문, 자유 콘텐츠를 담는 영역이에요. */
export function PopupContent({ className, children, ref, ...props }: PopupContentProps) {
  return (
    <div ref={ref} className={cx('mw-popup__title-area mw-popup__contents', className)} {...props}>
      {children}
    </div>
  )
}

export type PopupHeaderProps = DivProps
/** 제목과 본문을 한 덩어리로 묶어요. Center 팝업에서 써요. */
export function PopupHeader({ className, children, ref, ...props }: PopupHeaderProps) {
  return (
    <div ref={ref} className={className || undefined} {...props}>
      {children}
    </div>
  )
}

export type PopupTitleProps = DivProps
/** 제목이에요. Center는 한 줄, Full은 두 줄까지 보여요. */
export function PopupTitle({ className, children, ref, ...props }: PopupTitleProps) {
  return (
    <div ref={ref} className={cx('mw-popup__title', className)} {...props}>
      {children}
    </div>
  )
}

export type PopupBodyProps = DivProps
/** 제목을 보충하는 본문이에요. Center 팝업에서 두 줄까지 보여요. */
export function PopupBody({ className, children, ref, ...props }: PopupBodyProps) {
  return (
    <div ref={ref} className={cx('mw-popup__body', className)} {...props}>
      {children}
    </div>
  )
}

export type PopupFooterProps = DivProps
/** 버튼 영역이에요. 안에 넣은 버튼은 같은 너비로 나눠져요. */
export function PopupFooter({ className, children, ref, ...props }: PopupFooterProps) {
  return (
    <div ref={ref} className={cx('mw-popup__button-group mw-popup__button-area', className)} {...props}>
      {children}
    </div>
  )
}
