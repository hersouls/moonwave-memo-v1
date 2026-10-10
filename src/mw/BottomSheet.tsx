/* Moonwave UX — Bottom Sheet */
import { useCallback, useEffect, useState } from 'react'
import type { ButtonHTMLAttributes, HTMLAttributes, ImgHTMLAttributes, MouseEvent, ReactNode, Ref } from 'react'
import { createPortal } from 'react-dom'
import { useCloseRequest } from './close'
import { cx } from './cx'

export type BottomSheetProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  /** 시트 안에 넣을 내용이에요. Header · Content · Footer 순서로 넣어요. */
  children: ReactNode
  /** 열려 있는지 정해요. */
  open?: boolean
  /** 열림 상태를 바꿔야 할 때 불러요. Dim을 누르거나, Esc나 폰의 뒤로 가기를 누르면 `false`를 넘겨요. */
  onOpenChange?: (open: boolean) => void
  /** Dim을 눌렀을 때 닫을지 정해요. */
  closeOnOverlayClick?: boolean
  /** Esc 키와 폰의 뒤로 가기로 닫을지 정해요. */
  closeOnEscape?: boolean
  /** 시트 컨테이너 요소를 가리켜요. */
  ref?: Ref<HTMLDivElement>
}

/** 열림 모션을 시작하기 전에 한 박자 쉬는 시간(ms)이에요. */
const ENTER_DELAY_MS = 10
/** 닫히는 모션이 끝나기를 기다리는 시간(ms)이에요. CSS의 slide-out 350ms와 같아요. */
const EXIT_MS = 350

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
 * 화면 아래에서 올라오는 시트예요. 지금 화면을 유지한 채 고르거나 보조 작업을 하게 해요.
 * `document.body`에 그리고, 열려 있는 동안 배경 스크롤을 막아요.
 */
export function BottomSheet({
  className,
  children,
  open = false,
  onOpenChange,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  ref,
  ...props
}: BottomSheetProps) {
  const [isAnimating, setIsAnimating] = useState(false)
  const [shouldRender, setShouldRender] = useState(open)

  useEffect(() => {
    if (open) {
      setShouldRender(true)
      const timer = setTimeout(() => setIsAnimating(true), ENTER_DELAY_MS)
      return () => clearTimeout(timer)
    }
    setIsAnimating(false)
    const timer = setTimeout(() => setShouldRender(false), EXIT_MS)
    return () => clearTimeout(timer)
  }, [open])

  useEffect(() => {
    if (!open) return
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [open])

  // Esc와 폰의 뒤로 가기는 같은 닫기 요청이에요
  useCloseRequest(open && closeOnEscape, () => onOpenChange?.(false))

  const handleOverlayClick = useCallback(() => {
    if (closeOnOverlayClick) onOpenChange?.(false)
  }, [closeOnOverlayClick, onOpenChange])

  const handleContentClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation()
  }, [])

  if (!shouldRender) return null

  const dataState = isAnimating ? 'open' : 'closed'

  return (
    <Portal>
      <div className="mw-bottom-sheet-overlay" data-state={dataState} onClick={handleOverlayClick} aria-hidden="true" />
      <div className="mw-bottom-sheet-container">
        <div
          ref={ref}
          className={cx('mw-bottom-sheet', className)}
          data-state={dataState}
          role="dialog"
          aria-modal="true"
          onClick={handleContentClick}
          {...props}
        >
          {children}
        </div>
      </div>
    </Portal>
  )
}

type DivProps = HTMLAttributes<HTMLDivElement> & {
  /** 요소를 가리켜요. */
  ref?: Ref<HTMLDivElement>
}

export type BottomSheetHeaderProps = DivProps
/** 헤더 영역이에요. 제목 영역과 닫기 버튼을 한 줄에 놓아요. */
export function BottomSheetHeader({ className, children, ref, ...props }: BottomSheetHeaderProps) {
  return (
    <div ref={ref} className={cx('mw-bottom-sheet-header', className)} {...props}>
      {children}
    </div>
  )
}

export type BottomSheetHeaderTitleAreaProps = DivProps
/** 헤더 안에서 제목과 보조 문구를 묶어요. */
export function BottomSheetHeaderTitleArea({ className, children, ref, ...props }: BottomSheetHeaderTitleAreaProps) {
  return (
    <div ref={ref} className={cx('mw-bottom-sheet-header__title-area', className)} {...props}>
      {children}
    </div>
  )
}

export type BottomSheetTitleProps = HTMLAttributes<HTMLHeadingElement> & {
  /** 제목 요소를 가리켜요. */
  ref?: Ref<HTMLHeadingElement>
}
/** 헤더 제목이에요. 최대 두 줄로 써요. */
export function BottomSheetTitle({ className, children, ref, ...props }: BottomSheetTitleProps) {
  return (
    <h2 ref={ref} className={cx('mw-bottom-sheet-title', className)} {...props}>
      {children}
    </h2>
  )
}

export type BottomSheetBodyProps = HTMLAttributes<HTMLParagraphElement> & {
  /** 문단 요소를 가리켜요. */
  ref?: Ref<HTMLParagraphElement>
}
/** 제목 아래 보조 문구예요. */
export function BottomSheetBody({ className, children, ref, ...props }: BottomSheetBodyProps) {
  return (
    <p ref={ref} className={cx('mw-bottom-sheet-body', className)} {...props}>
      {children}
    </p>
  )
}

export type BottomSheetContentProps = DivProps
/** 본문 영역이에요. 내용이 길면 이 영역만 스크롤해요. */
export function BottomSheetContent({ className, children, ref, ...props }: BottomSheetContentProps) {
  return (
    <div ref={ref} className={cx('mw-bottom-sheet-content', className)} {...props}>
      {children}
    </div>
  )
}

export type BottomSheetCloseButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** 버튼 요소를 가리켜요. */
  ref?: Ref<HTMLButtonElement>
}
/** 헤더 오른쪽 닫기 버튼이에요. 안에 24px 닫기 아이콘을 넣어요. */
export function BottomSheetCloseButton({ className, children, ref, ...props }: BottomSheetCloseButtonProps) {
  return (
    <button ref={ref} type="button" className={cx('mw-bottom-sheet-close-button', className)} aria-label="닫기" {...props}>
      {children}
    </button>
  )
}

export type BottomSheetFooterProps = DivProps
/** 아래 버튼 영역이에요. 안에 넣은 버튼은 같은 너비로 나눠져요. */
export function BottomSheetFooter({ className, children, ref, ...props }: BottomSheetFooterProps) {
  return (
    <div ref={ref} className={cx('mw-bottom-sheet-footer', className)} {...props}>
      {children}
    </div>
  )
}

export type BottomSheetFullImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'> & {
  /** 이미지 주소예요. */
  src: string
  /** 이미지를 설명하는 대체 글이에요. */
  alt: string
  /** 이미지 요소를 가리켜요. */
  ref?: Ref<HTMLImageElement>
}
/** 시트를 가득 채우는 이미지예요. Promotion 시트에서 써요. */
export function BottomSheetFullImage({ className, src, alt, ref, ...props }: BottomSheetFullImageProps) {
  return <img ref={ref} src={src} alt={alt} className={cx('mw-bottom-sheet-full-image', className)} {...props} />
}
