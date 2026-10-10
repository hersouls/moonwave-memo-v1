/* Moonwave UX — Toast */
import { useEffect, useState } from 'react'
import type { HTMLAttributes, ReactNode, Ref } from 'react'
import { cx } from './cx'
import { IcLineClose } from './icons'

export type ToastType = 'basic' | 'icon'

export type ToastProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  /** 모양이에요. `icon`이면 글자 앞에 아이콘을 보여요. */
  type?: ToastType
  /** 보여 줄 메시지예요. 한 줄 20자, 최대 두 줄로 써요. */
  children: ReactNode
  /** `type="icon"`일 때 글자 앞에 놓는 20px 아이콘이에요. */
  icon?: ReactNode
  /** 닫기 버튼을 보여요. 켜면 자동으로 사라지지 않아요. */
  showClose?: boolean
  /** 보일지 정해요. */
  open?: boolean
  /** 자동으로 사라질 때까지의 시간(ms)이에요. 0이면 사라지지 않아요. */
  duration?: number
  /** 사라지는 모션이 끝난 뒤에 불러요. */
  onClose?: () => void
  /** 컨테이너 요소를 가리켜요. */
  ref?: Ref<HTMLDivElement>
}

/** 사라지는 모션 길이(ms)예요. CSS의 transition 0.3s와 같아요. */
const EXIT_MS = 300

export function Toast({
  type = 'basic',
  className,
  children,
  icon,
  showClose = false,
  open = true,
  duration = 3000,
  onClose,
  ref,
  ...props
}: ToastProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [shouldRender, setShouldRender] = useState(open)

  useEffect(() => {
    if (!open) {
      setIsVisible(false)
      return
    }
    setShouldRender(true)
    const frame = requestAnimationFrame(() => setIsVisible(true))
    const timer = duration > 0 && !showClose ? setTimeout(() => setIsVisible(false), duration) : undefined
    return () => {
      cancelAnimationFrame(frame)
      if (timer !== undefined) clearTimeout(timer)
    }
  }, [open, duration, showClose])

  useEffect(() => {
    if (isVisible || !shouldRender) return
    const timer = setTimeout(() => {
      setShouldRender(false)
      onClose?.()
    }, EXIT_MS)
    return () => clearTimeout(timer)
  }, [isVisible, shouldRender, onClose])

  if (!shouldRender) return null

  const closeButton = (
    <button className="mw-toast__close" onClick={() => setIsVisible(false)} aria-label="닫기" type="button">
      <IcLineClose />
    </button>
  )

  return (
    <div
      ref={ref}
      className={cx(
        'mw-toast',
        type === 'icon' ? 'mw-toast--icon' : 'mw-toast--basic',
        isVisible ? 'mw-toast--visible' : 'mw-toast--hidden',
        showClose && 'mw-toast--with-close',
        className,
      )}
      role="alert"
      {...props}
    >
      {type === 'icon' && showClose ? (
        <>
          <div className="mw-toast__content">
            {icon && <span className="mw-toast__icon">{icon}</span>}
            <span className="mw-toast__text">{children}</span>
          </div>
          {closeButton}
        </>
      ) : (
        <>
          {type === 'icon' && icon && <span className="mw-toast__icon">{icon}</span>}
          <span className="mw-toast__text">{children}</span>
          {showClose && closeButton}
        </>
      )}
    </div>
  )
}
