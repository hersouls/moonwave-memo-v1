import { Children, cloneElement, isValidElement, useEffect, useState } from 'react'
import type { HTMLAttributes, KeyboardEvent, ReactNode, Ref } from 'react'
import { cx } from './cx'

export type BottomNavigationProps = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onChange'> & {
  /** BottomNavigationItem들이에요. 3~5개를 넣어요. */
  children: ReactNode
  /** 선택된 항목의 값이에요. 주면 바깥에서 선택을 관리해요. */
  value?: string
  /** 선택이 바뀔 때 새 값을 받아요. */
  onChange?: (value: string) => void
  /** div 요소를 가리키는 ref예요. */
  ref?: Ref<HTMLDivElement>
}

/** 화면 아래에 두는 내비게이션이에요. 항목의 value로 선택을 관리해요. */
export function BottomNavigation({ children, value, onChange, className, ref, ...props }: BottomNavigationProps) {
  const [selectedValue, setSelectedValue] = useState(value)

  useEffect(() => {
    if (value !== undefined) {
      setSelectedValue(value)
    }
  }, [value])

  const handleItemClick = (itemValue: string | undefined) => {
    if (itemValue === undefined) return
    if (value !== undefined && onChange) {
      onChange(itemValue)
    } else {
      setSelectedValue(itemValue)
      if (onChange) {
        onChange(itemValue)
      }
    }
  }

  const enhancedChildren = Children.map(children, (child) => {
    if (isValidElement<BottomNavigationItemProps>(child)) {
      const itemValue = child.props.value
      const isSelected = itemValue !== undefined && itemValue === selectedValue
      return cloneElement(child, {
        selected: isSelected,
        onClick: () => {
          if (child.props.onClick) {
            child.props.onClick()
          }
          handleItemClick(itemValue)
        },
      })
    }
    return child
  })

  return (
    <div ref={ref} role="tablist" className={cx('mw-bottom-navigation', className)} {...props}>
      <div className="mw-bottom-navigation__items">{enhancedChildren}</div>
    </div>
  )
}

export type BottomNavigationItemState = 'default' | 'selected' | 'disabled'

export type BottomNavigationItemProps = Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onClick'> & {
  /** 항목 레이블이에요. 6자 안쪽으로 써요. */
  label: string
  /** 아이콘이에요. 선택된 항목에는 채움(Fill) 아이콘을 넘겨요. */
  icon?: ReactNode
  /** 선택된 상태예요. BottomNavigation 안에서는 value로 알아서 정해져요. 기본은 false예요. */
  selected?: boolean
  /** 누를 수 없는 상태예요. 기본은 false예요. */
  disabled?: boolean
  /** 항목을 눌렀을 때 불러요. */
  onClick?: () => void
  /** 항목을 가리키는 값이에요. 선택을 관리할 때 써요. */
  value?: string
  /** 상태를 직접 정할 때 써요. disabled와 selected가 먼저 적용돼요. */
  state?: BottomNavigationItemState
  /** div 요소를 가리키는 ref예요. */
  ref?: Ref<HTMLDivElement>
}

/** 하단 내비게이션의 항목 하나예요. 아이콘 위, 레이블 아래로 놓여요. */
export function BottomNavigationItem({
  label,
  icon,
  selected = false,
  disabled = false,
  state,
  className,
  onClick,
  value: _value,
  ref,
  ...props
}: BottomNavigationItemProps) {
  const computedState = disabled ? 'disabled' : selected ? 'selected' : state || 'default'

  const handleClick = () => {
    if (!disabled && onClick) {
      onClick()
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      if (onClick) {
        onClick()
      }
    }
  }

  return (
    <div
      ref={ref}
      role="tab"
      aria-selected={selected}
      aria-disabled={disabled}
      aria-label={label}
      tabIndex={disabled ? -1 : 0}
      className={cx('mw-bottom-navigation-item', `mw-bottom-navigation-item--${computedState}`, className)}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      {...props}
    >
      {icon && <div className="mw-bottom-navigation-item__icon">{icon}</div>}
      <span className="mw-bottom-navigation-item__label">{label}</span>
    </div>
  )
}
