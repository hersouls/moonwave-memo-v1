import { createContext, useContext, useState } from 'react'
import type { ButtonHTMLAttributes, HTMLAttributes, MouseEvent, ReactNode, Ref } from 'react'
import { cx } from './cx'

export type TabType = 'fixed' | 'scrollable'
export type TabState = 'default' | 'selected' | 'disabled'

type TabContextValue = {
  value: string
  disabled?: boolean
  type: TabType
  onChange: (value: string) => void
}

const TabContext = createContext<TabContextValue | null>(null)

export type TabProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'value' | 'children'> & {
  /** 탭을 가리키는 값이에요. TabGroup의 value와 같으면 선택돼요. */
  value: string
  /** 탭을 누를 수 없게 해요. 안 주면 TabGroup의 disabled를 따라요. */
  disabled?: boolean
  /** 탭 레이블이에요. */
  children: ReactNode
  /** 탭 유형이에요. 안 주면 TabGroup의 type을 따르고, 그것도 없으면 fixed예요. */
  type?: TabType
  /** TabGroup 없이 따로 쓸 때의 상태예요. 기본은 default예요. */
  state?: TabState
  /** button 요소를 가리키는 ref예요. */
  ref?: Ref<HTMLButtonElement>
}

/** 탭 하나예요. TabGroup 안에서 쓰면 선택과 유형을 그룹에서 받아요. */
export function Tab({ type, state, value, disabled, children, className, onClick, ref, ...props }: TabProps) {
  const tabContext = useContext(TabContext)
  const isSelected = tabContext ? tabContext.value === value : state === 'selected'
  const isDisabled = disabled ?? tabContext?.disabled
  const tabType = type ?? tabContext?.type ?? 'fixed'
  const tabState = isDisabled ? 'disabled' : isSelected ? 'selected' : (state ?? 'default')

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    onClick?.(event)
    if (!isDisabled && tabContext?.onChange) {
      tabContext.onChange(value)
    }
  }

  return (
    <button
      ref={ref}
      role="tab"
      aria-selected={isSelected}
      aria-disabled={isDisabled}
      className={cx('mw-tab', `mw-tab--${tabType}`, `mw-tab--${tabState}`, className)}
      disabled={isDisabled}
      onClick={handleClick}
      {...props}
    >
      {children}
    </button>
  )
}

export type TabGroupProps = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'defaultValue'> & {
  /** 선택된 탭의 값이에요. 주면 바깥에서 선택을 관리해요. */
  value?: string
  /** 처음 선택할 탭의 값이에요. value 없이 쓸 때만 써요. */
  defaultValue?: string
  /** 선택이 바뀔 때 새 값을 받아요. */
  onValueChange?: (value: string) => void
  /** 탭 유형이에요. fixed는 너비를 똑같이 나누고 scrollable은 가로로 스크롤돼요. 기본은 fixed예요. */
  type?: TabType
  /** 모든 탭을 누를 수 없게 해요. */
  disabled?: boolean
  /** Tab들을 넣어요. */
  children: ReactNode
  /** div 요소를 가리키는 ref예요. */
  ref?: Ref<HTMLDivElement>
}

/** Tab들을 감싸고 선택 상태를 나눠 주는 컨테이너예요. */
export function TabGroup({
  value,
  defaultValue,
  onValueChange,
  type = 'fixed',
  disabled,
  children,
  className,
  ref,
  ...props
}: TabGroupProps) {
  const [internalValue, setInternalValue] = useState(defaultValue || '')
  const isControlled = value !== undefined
  const currentValue = isControlled ? value : internalValue

  const handleChange = (newValue: string) => {
    if (!isControlled) {
      setInternalValue(newValue)
    }
    onValueChange?.(newValue)
  }

  return (
    <TabContext value={{ value: currentValue, disabled, type, onChange: handleChange }}>
      <div ref={ref} role="tablist" className={cx('mw-tab-group', `mw-tab-group--${type}`, className)} {...props}>
        {children}
      </div>
    </TabContext>
  )
}
