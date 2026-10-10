import { createContext, useContext, useState } from 'react'
import type { ChangeEvent, HTMLAttributes, InputHTMLAttributes, LabelHTMLAttributes, MouseEvent, ReactNode, Ref } from 'react'
import { cx } from './cx'
import { IcLineCheck } from './icons'

export type CheckboxState = 'default' | 'hover' | 'disabled'

type CheckboxGroupContextValue = {
  name?: string
  value?: string[]
  disabled?: boolean
  onChange?: (values: string[]) => void
}

/** CheckboxList가 선택 값 배열과 비활성 여부를 안쪽 항목에 내려 주는 통로예요. */
const CheckboxGroupContext = createContext<CheckboxGroupContextValue | null>(null)

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value'> & {
  /** 체크박스의 값이에요. CheckboxList 안에서는 이 값이 배열에 있으면 선택된 것으로 봐요. */
  value: string
  /** 모양 상태예요. 기본은 default예요. hover는 키트 CSS에 규칙이 없으니 쓰지 않아요. */
  state?: CheckboxState
  /** 비활성 상태예요. 주지 않으면 CheckboxList의 disabled를 따라요. */
  disabled?: boolean
  /** 선택 여부예요. CheckboxList 밖에서 혼자 쓸 때 줘요. */
  checked?: boolean
  /** 선택이 바뀔 때 불러요. */
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void
  /** 바깥 label에 붙는 클래스예요. */
  className?: string
  /** input 요소를 가리키는 ref예요. */
  ref?: Ref<HTMLInputElement>
}

/** 여러 항목 가운데 하나 이상을 고르는 체크박스예요. 혼자 쓰거나 CheckboxList 안에서 써요. */
export function Checkbox({ state = 'default', className, value, disabled, checked, name, onChange, ref, ...props }: CheckboxProps) {
  const group = useContext(CheckboxGroupContext)
  const isChecked = group ? (group.value?.includes(value) ?? false) : checked
  const isDisabled = disabled ?? group?.disabled

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange?.(event)
    if (group) {
      const current = group.value ?? []
      const next = event.target.checked ? [...current, value] : current.filter((v) => v !== value)
      group.onChange?.(next)
    }
  }

  return (
    <label className={cx('mw-checkbox', `mw-checkbox--${isDisabled ? 'disabled' : state}`, className)}>
      <input
        ref={ref}
        type="checkbox"
        className="mw-checkbox__input"
        value={value}
        checked={isChecked}
        onChange={handleChange}
        disabled={isDisabled}
        name={name ?? group?.name}
        {...props}
      />
      <span className="mw-checkbox__box">
        <span className="mw-checkbox__icon">
          <IcLineCheck size={16} />
        </span>
      </span>
    </label>
  )
}

export type CheckboxGroupProps = Omit<LabelHTMLAttributes<HTMLLabelElement>, 'children'> & {
  /** Checkbox와 CheckboxLabel을 넣어요. */
  children: ReactNode
  /** 이 줄에 든 체크박스의 값이에요. */
  value: string
  /** label 요소를 가리키는 ref예요. */
  ref?: Ref<HTMLLabelElement>
}

/** 체크박스와 레이블을 한 줄로 묶는 항목이에요. 높이 44px인 label이라 줄 전체가 눌려요. */
export function CheckboxGroup({ children, value: _value, className, ref, ...props }: CheckboxGroupProps) {
  return (
    <label ref={ref} className={cx('mw-checkbox-item', className)} {...props}>
      {children}
    </label>
  )
}

export type CheckboxLabelProps = Omit<LabelHTMLAttributes<HTMLLabelElement>, 'children'> & {
  /** 레이블 글자예요. */
  children: ReactNode
  /** 짝이 되는 체크박스의 값이에요. 주면 선택됐을 때 굵어지고, 글자를 눌러도 선택이 바뀌어요. */
  value?: string
  /** label 요소를 가리키는 ref예요. */
  ref?: Ref<HTMLLabelElement>
}

/** 체크박스 옆에 붙는 레이블이에요. CheckboxList의 상태에 맞춰 기본, 선택, 비활성 모양으로 바뀌어요. */
export function CheckboxLabel({ children, value, className, onClick, ref, ...props }: CheckboxLabelProps) {
  const group = useContext(CheckboxGroupContext)
  const isSelected = value && group ? (group.value?.includes(value) ?? false) : false
  const isDisabled = group?.disabled

  const handleClick = (event: MouseEvent<HTMLLabelElement>) => {
    if (!isDisabled && value && group) {
      const current = group.value ?? []
      const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
      group.onChange?.(next)
    }
    onClick?.(event)
  }

  return (
    <label
      ref={ref}
      className={cx(
        'mw-checkbox-label',
        isDisabled ? 'mw-checkbox-label--disabled' : isSelected ? 'mw-checkbox-label--selected' : 'mw-checkbox-label--default',
        className,
      )}
      onClick={handleClick}
      {...props}
    >
      {children}
    </label>
  )
}

export type CheckboxListProps = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'defaultValue' | 'onChange'> & {
  /** 선택된 값들이에요. 주면 바깥에서 상태를 관리해요. */
  value?: string[]
  /** 처음에 선택해 둘 값들이에요. value 없이 쓸 때 줘요. */
  defaultValue?: string[]
  /** 선택이 바뀔 때 새 값 배열을 넘겨 줘요. */
  onValueChange?: (values: string[]) => void
  /** 그룹 이름이에요. 안쪽 체크박스의 name으로 쓰여요. */
  name: string
  /** 목록 전체를 비활성으로 만들어요. */
  disabled?: boolean
  /** CheckboxGroup들을 넣어요. */
  children: ReactNode
  /** div 요소를 가리키는 ref예요. */
  ref?: Ref<HTMLDivElement>
}

/** CheckboxGroup을 세로로 쌓고 선택 값 배열을 관리하는 목록이에요. */
export function CheckboxList({ value, defaultValue, onValueChange, name, disabled, children, className, ref, ...props }: CheckboxListProps) {
  const [internalValue, setInternalValue] = useState<string[]>(defaultValue ?? [])
  const isControlled = value !== undefined
  const currentValue = isControlled ? value : internalValue

  const handleChange = (values: string[]) => {
    if (!isControlled) setInternalValue(values)
    onValueChange?.(values)
  }

  return (
    <CheckboxGroupContext value={{ name, value: currentValue, disabled, onChange: handleChange }}>
      <div ref={ref} className={cx('mw-checkbox-list', className)} {...props}>
        {children}
      </div>
    </CheckboxGroupContext>
  )
}

export type CheckboxSelectProps = Omit<LabelHTMLAttributes<HTMLLabelElement>, 'children' | 'onChange' | 'defaultChecked'> & {
  /** 체크박스의 값이에요. */
  value: string
  /** 선택 여부예요. 주면 바깥에서 상태를 관리해요. */
  checked?: boolean
  /** 처음 선택 여부예요. checked 없이 쓸 때 줘요. */
  defaultChecked?: boolean
  /** 비활성 상태예요. */
  disabled?: boolean
  /** 선택이 바뀔 때 새 선택 여부를 넘겨 줘요. */
  onChange?: (checked: boolean) => void
  /** 레이블 글자예요. */
  children: ReactNode
  /** label 요소를 가리키는 ref예요. */
  ref?: Ref<HTMLLabelElement>
}

/** 테두리가 있는 카드형 체크박스예요. 선택되면 테두리가 굵어지고 그림자가 생겨요. */
export function CheckboxSelect({ value, checked, defaultChecked, disabled, onChange, children, className, ref, ...props }: CheckboxSelectProps) {
  const [internalChecked, setInternalChecked] = useState(defaultChecked ?? false)
  const isControlled = checked !== undefined
  const isChecked = isControlled ? checked : internalChecked

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.checked
    if (!isControlled) setInternalChecked(next)
    onChange?.(next)
  }

  return (
    <label
      ref={ref}
      className={cx(
        'mw-checkbox-select',
        !isChecked && !disabled && 'mw-checkbox-select--default',
        isChecked && !disabled && 'mw-checkbox-select--selected',
        disabled && 'mw-checkbox-select--disabled',
        className,
      )}
      {...props}
    >
      <input type="checkbox" className="mw-checkbox-select__input" value={value} checked={isChecked} onChange={handleChange} disabled={disabled} />
      <span className="mw-checkbox-select__checkbox">
        <CheckboxGroupContext value={null}>
          <Checkbox value={value} checked={isChecked} disabled={disabled} onChange={handleChange} />
        </CheckboxGroupContext>
      </span>
      <span className="mw-checkbox-select__label">{children}</span>
    </label>
  )
}
