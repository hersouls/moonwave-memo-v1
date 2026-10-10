/* Moonwave UX — Snackbar */
import { useEffect, useState } from 'react'
import type { HTMLAttributes, ReactNode, Ref } from 'react'
import { cx } from './cx'
import { IcLineClose } from './icons'
import { TextButton } from './TextButton'

export type SnackbarType = 'action' | 'close'
export type SnackbarIcon = 'on' | 'off'

export type SnackbarProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  /** 오른쪽 끝에 둘 것을 골라요. `action`은 텍스트 버튼, `close`는 닫기 버튼이에요. */
  type?: SnackbarType
  /** 글자 앞 아이콘을 보일지 정해요. */
  icon?: SnackbarIcon
  /** 보여 줄 메시지예요. */
  message: string
  /** `icon="on"`일 때 보이는 20px 아이콘이에요. */
  iconElement?: ReactNode
  /** `type="action"`일 때 보이는 버튼이에요. `SnackbarTextButton`을 넣어요. */
  actionElement?: ReactNode
  /** 사라지는 모션이 끝난 뒤에 불러요. */
  onClose?: () => void
  /** 보일지 정해요. */
  open?: boolean
  /** 자동으로 사라질 때까지의 시간(ms)이에요. 0이면 사라지지 않아요. */
  duration?: number
  /** 컨테이너 요소를 가리켜요. */
  ref?: Ref<HTMLDivElement>
}

/** 사라지는 모션 길이(ms)예요. CSS의 transition 0.3s와 같아요. */
const EXIT_MS = 300

export function Snackbar({
  type = 'action',
  icon = 'off',
  message,
  iconElement,
  actionElement,
  onClose,
  className,
  open = true,
  duration = 4000,
  ref,
  ...props
}: SnackbarProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [shouldRender, setShouldRender] = useState(open)

  useEffect(() => {
    if (!open) {
      setIsVisible(false)
      return
    }
    setShouldRender(true)
    const frame = requestAnimationFrame(() => setIsVisible(true))
    const timer = duration > 0 ? setTimeout(() => setIsVisible(false), duration) : undefined
    return () => {
      cancelAnimationFrame(frame)
      if (timer !== undefined) clearTimeout(timer)
    }
  }, [open, duration])

  useEffect(() => {
    if (isVisible || !shouldRender) return
    const timer = setTimeout(() => {
      setShouldRender(false)
      onClose?.()
    }, EXIT_MS)
    return () => clearTimeout(timer)
  }, [isVisible, shouldRender, onClose])

  if (!shouldRender) return null

  return (
    <div
      ref={ref}
      className={cx(
        'mw-snackbar',
        type === 'close' ? 'mw-snackbar--close' : 'mw-snackbar--action',
        icon === 'on' ? 'mw-snackbar--with-icon' : 'mw-snackbar--no-icon',
        isVisible ? 'mw-snackbar--visible' : 'mw-snackbar--hidden',
        className,
      )}
      {...props}
    >
      {icon === 'on' && iconElement && <div className="mw-snackbar__icon">{iconElement}</div>}
      <span className="mw-snackbar__text">{message}</span>
      {type === 'action' && actionElement && <div className="mw-snackbar__action">{actionElement}</div>}
      {type === 'close' && (
        <button className="mw-snackbar__close" onClick={() => setIsVisible(false)} aria-label="닫기" type="button">
          <IcLineClose />
        </button>
      )}
    </div>
  )
}

export type SnackbarTextButtonProps = {
  /** 버튼 레이블이에요. `되돌리기`처럼 행동 하나를 짧게 써요. */
  children: ReactNode
  /** 버튼을 눌렀을 때 불러요. */
  onClick?: () => void
  /** 감싸는 요소를 가리켜요. */
  ref?: Ref<HTMLDivElement>
}

/** Snackbar 안에 넣는 밑줄 텍스트 버튼이에요. 어두운 배경에 맞게 `data-theme="dark"`로 그려요. */
export function SnackbarTextButton({ children, onClick, ref }: SnackbarTextButtonProps) {
  return (
    <div
      ref={ref}
      className="mw-snackbar-text-button"
      style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <TextButton type="button" size="small" variant="underline" density="compact" data-theme="dark" onClick={onClick}>
        {children}
      </TextButton>
    </div>
  )
}
