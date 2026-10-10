import type { HTMLAttributes, KeyboardEvent, Ref } from 'react'
import { cx } from './cx'
import { IcLineChevronDown } from './icons'

export type DropdownState = 'default' | 'complete' | 'disabled'

export type DropdownProps = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onClick'> & {
  /** 레이블이에요. 값을 골라도 위에 작게 남아 늘 보여요. */
  label: string
  /** 고른 값이에요. 값이 있으면 Complete 상태로 보여 줘요. */
  value?: string
  /** 상태예요. 넘기지 않으면 value와 disabled를 보고 알아서 정해요. */
  state?: DropdownState
  /** 비활성 상태예요. 기본은 false예요. */
  disabled?: boolean
  /** 오류 상태예요. 기본은 false예요. */
  error?: boolean
  /** 누르거나 Enter, Space를 누르면 불러요. 여기서 선택 목록을 열어요. */
  onClick?: () => void
  /** div 요소를 가리키는 ref예요. */
  ref?: Ref<HTMLDivElement>
}

/**
 * 여러 항목 가운데 하나를 고르는 입력 칸이에요.
 * 목록은 직접 그리지 않아요. onClick에서 Bottom Sheet를 열고, 열려 있는 동안 aria-expanded를 true로 넘겨요.
 */
export function Dropdown({
  label,
  value,
  state,
  disabled = false,
  error = false,
  className,
  onClick,
  ref,
  ...props
}: DropdownProps) {
  const computedState: DropdownState = disabled ? 'disabled' : value ? 'complete' : state || 'default'

  const handleClick = () => {
    if (!disabled && onClick) onClick()
  }
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      if (onClick) onClick()
    }
  }

  return (
    <div
      ref={ref}
      role="combobox"
      aria-expanded={false}
      aria-haspopup="listbox"
      aria-disabled={disabled}
      aria-label={label}
      tabIndex={disabled ? -1 : 0}
      className={cx('mw-dropdown', `mw-dropdown--${computedState}`, error && 'mw-dropdown--error', className)}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      {...props}
    >
      <div className="mw-dropdown__input-area">
        <span className="mw-dropdown__label">{label}</span>
        {value && <span className="mw-dropdown__value">{value}</span>}
      </div>
      <div className="mw-dropdown__icon-container">
        <IcLineChevronDown className="mw-dropdown__icon" />
      </div>
    </div>
  )
}
