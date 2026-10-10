import { createContext, useContext, useState } from 'react'
import type { ChangeEvent, HTMLAttributes, InputHTMLAttributes, LabelHTMLAttributes, MouseEvent, ReactNode, Ref } from 'react'
import { cx } from './cx'

export type RadioButtonState = 'default' | 'hover' | 'disabled'

type RadioButtonGroupContextValue = {
  name?: string
  value?: string
  disabled?: boolean
  onChange?: (value: string) => void
}

/** RadioButtonList가 선택 값, 그룹 이름, 비활성 여부를 안쪽 항목에 내려 주는 통로예요. */
const RadioButtonGroupContext = createContext<RadioButtonGroupContextValue | null>(null)

export type RadioButtonProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value'> & {
  /** 라디오 버튼의 값이에요. RadioButtonList 안에서는 선택 값과 같으면 선택된 것으로 봐요. */
  value: string
  /** 모양 상태예요. 기본은 default예요. hover는 키트 CSS에 규칙이 없으니 쓰지 않아요. */
  state?: RadioButtonState
  /** 비활성 상태예요. 주지 않으면 RadioButtonList의 disabled를 따라요. */
  disabled?: boolean
  /** 그룹 이름이에요. 주지 않으면 RadioButtonList의 name을 따라요. */
  name?: string
  /** 선택이 바뀔 때 불러요. */
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void
  /** 바깥 label에 붙는 클래스예요. */
  className?: string
  /** input 요소를 가리키는 ref예요. */
  ref?: Ref<HTMLInputElement>
}

/** 여러 선택지 가운데 하나만 고르는 라디오 버튼이에요. 혼자 쓰거나 RadioButtonList 안에서 써요. */
export function RadioButton({ state = 'default', className, value, disabled, name, onChange, ref, ...props }: RadioButtonProps) {
  const group = useContext(RadioButtonGroupContext)
  const isChecked = group ? group.value === value : undefined
  const isDisabled = disabled ?? group?.disabled
  const radioName = name ?? group?.name

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange?.(event)
    group?.onChange?.(event.target.value)
  }

  return (
    <label className={cx('mw-radiobutton', `mw-radiobutton--${isDisabled ? 'disabled' : state}`, className)}>
      <input
        ref={ref}
        type="radio"
        className="mw-radiobutton__input"
        value={value}
        checked={isChecked}
        onChange={handleChange}
        disabled={isDisabled}
        name={radioName}
        {...props}
      />
      <span className="mw-radiobutton__circle">
        <span className="mw-radiobutton__icon" />
      </span>
    </label>
  )
}

export type RadioButtonGroupProps = Omit<LabelHTMLAttributes<HTMLLabelElement>, 'children'> & {
  /** RadioButton과 RadioButtonLabel을 넣어요. */
  children: ReactNode
  /** 이 줄에 든 라디오 버튼의 값이에요. */
  value: string
  /** label 요소를 가리키는 ref예요. */
  ref?: Ref<HTMLLabelElement>
}

/** 라디오 버튼과 레이블을 한 줄로 묶는 항목이에요. 높이 44px인 label이라 줄 전체가 눌려요. */
export function RadioButtonGroup({ children, value: _value, className, ref, ...props }: RadioButtonGroupProps) {
  return (
    <label ref={ref} className={cx('mw-radiobutton-item', className)} {...props}>
      {children}
    </label>
  )
}

export type RadioButtonLabelProps = Omit<LabelHTMLAttributes<HTMLLabelElement>, 'children'> & {
  /** 레이블 글자예요. */
  children: ReactNode
  /** 짝이 되는 라디오 버튼의 값이에요. 주면 선택됐을 때 굵어지고, 글자를 눌러도 선택돼요. */
  value?: string
  /** label 요소를 가리키는 ref예요. */
  ref?: Ref<HTMLLabelElement>
}

/** 라디오 버튼 옆에 붙는 레이블이에요. RadioButtonList의 상태에 맞춰 기본, 선택, 비활성 모양으로 바뀌어요. */
export function RadioButtonLabel({ children, value, className, onClick, ref, ...props }: RadioButtonLabelProps) {
  const group = useContext(RadioButtonGroupContext)
  const isSelected = value && group ? group.value === value : false
  const isDisabled = group?.disabled

  const handleClick = (event: MouseEvent<HTMLLabelElement>) => {
    if (!isDisabled && value && group) group.onChange?.(value)
    onClick?.(event)
  }

  return (
    <label
      ref={ref}
      className={cx(
        'mw-radiobutton-label',
        isDisabled ? 'mw-radiobutton-label--disabled' : isSelected ? 'mw-radiobutton-label--selected' : 'mw-radiobutton-label--default',
        className,
      )}
      onClick={handleClick}
      {...props}
    >
      {children}
    </label>
  )
}

export type RadioButtonListProps = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'defaultValue' | 'onChange'> & {
  /** 선택된 값이에요. 주면 바깥에서 상태를 관리해요. */
  value?: string
  /** 처음에 선택해 둘 값이에요. value 없이 쓸 때 줘요. */
  defaultValue?: string
  /** 선택이 바뀔 때 새 값을 넘겨 줘요. */
  onValueChange?: (value: string) => void
  /** 그룹 이름이에요. 안쪽 라디오 버튼의 name으로 쓰여요. */
  name: string
  /** 목록 전체를 비활성으로 만들어요. */
  disabled?: boolean
  /** RadioButtonGroup들을 넣어요. */
  children: ReactNode
  /** div 요소를 가리키는 ref예요. */
  ref?: Ref<HTMLDivElement>
}

/** RadioButtonGroup을 세로로 쌓고 선택 값 하나를 관리하는 목록이에요. */
export function RadioButtonList({ value, defaultValue, onValueChange, name, disabled, children, className, ref, ...props }: RadioButtonListProps) {
  const [internalValue, setInternalValue] = useState(defaultValue)
  const isControlled = value !== undefined
  const currentValue = isControlled ? value : internalValue

  const handleChange = (next: string) => {
    if (!isControlled) setInternalValue(next)
    onValueChange?.(next)
  }

  return (
    <RadioButtonGroupContext value={{ name, value: currentValue, disabled, onChange: handleChange }}>
      <div ref={ref} className={cx('mw-radiobutton-list', className)} {...props}>
        {children}
      </div>
    </RadioButtonGroupContext>
  )
}
