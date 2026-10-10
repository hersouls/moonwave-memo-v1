import { useState } from 'react'
import type { ButtonHTMLAttributes, KeyboardEvent, Ref } from 'react'
import { cx } from './cx'

export type SwitchSize = 'small' | 'medium'

export type SwitchProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'onChange' | 'value' | 'defaultChecked'> & {
  /** 스위치 크기예요. medium은 48 × 28px, small은 40 × 24px이에요. 기본은 medium이에요. */
  size?: SwitchSize
  /** 켜짐 여부예요. 주면 바깥에서 상태를 관리해요. */
  checked?: boolean
  /** 처음 켜짐 여부예요. checked 없이 쓸 때 줘요. 기본은 false예요. */
  defaultChecked?: boolean
  /** 켜짐 여부가 바뀔 때 새 값을 넘겨 줘요. */
  onChange?: (checked: boolean) => void
  /** 비활성 상태예요. 기본은 false예요. */
  disabled?: boolean
  /** 폼으로 보낼 이름이에요. 주면 숨은 체크박스가 함께 그려져요. */
  name?: string
  /** 폼으로 보낼 값이에요. */
  value?: string
  /** button 요소를 가리키는 ref예요. */
  ref?: Ref<HTMLButtonElement>
}

/** 설정 하나를 누르는 즉시 켜고 끄는 스위치예요. 이름은 aria-label이나 감싸는 label로 줘요. */
export function Switch({
  size = 'medium',
  checked: controlledChecked,
  defaultChecked = false,
  onChange,
  disabled = false,
  className,
  name,
  value,
  ref,
  ...props
}: SwitchProps) {
  const [internalChecked, setInternalChecked] = useState(defaultChecked)
  const isControlled = controlledChecked !== undefined
  const checked = isControlled ? controlledChecked : internalChecked

  const handleClick = () => {
    if (disabled) return
    const next = !checked
    if (!isControlled) setInternalChecked(next)
    onChange?.(next)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault()
      handleClick()
    }
  }

  return (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={cx('mw-switch', `mw-switch--${size}`, checked && 'mw-switch--checked', className)}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      {...props}
    >
      <div className="mw-switch__container">
        <div className="mw-switch__handle" />
      </div>
      {name && (
        <input
          type="checkbox"
          name={name}
          value={value}
          checked={checked}
          onChange={() => {}}
          className="mw-switch__input"
          tabIndex={-1}
          aria-hidden="true"
        />
      )}
    </button>
  )
}
