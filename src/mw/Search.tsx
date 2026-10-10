import { useImperativeHandle, useRef, useState } from 'react'
import type { ChangeEvent, FocusEvent, InputHTMLAttributes, KeyboardEvent, MouseEvent, Ref } from 'react'
import { cx } from './cx'
import { IcFillDelete, IcLineChevronLeft, IcLineSearch } from './icons'

export type SearchType = 'outline' | 'underline'
export type SearchState = 'default' | 'focused' | 'typing' | 'complete' | 'disabled'

export type SearchProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> & {
  /** 모양이에요. outline은 테두리, underline은 아래 선만 있어요. 기본은 outline이에요. */
  type?: SearchType
  /** 왼쪽에 뒤로 가기 버튼을 보일지 정해요. 기본은 false예요. */
  hasBackButton?: boolean
  /** 포커스도 값도 없을 때 쓸 상태예요. 넘기지 않으면 default예요. */
  state?: SearchState
  /** 검색어예요. 값을 밖에서 관리할 때 써요. */
  value?: string
  /** 검색어가 바뀌면 바뀐 글자로 불러요. */
  onChange?: (value: string) => void
  /** Enter를 누르거나 검색 버튼을 누르면 지금 검색어로 불러요. */
  onSearch?: (value: string) => void
  /** 뒤로 가기 버튼을 누르면 불러요. */
  onBack?: () => void
  /** 지우기 버튼을 누르면 불러요. */
  onClear?: () => void
  /** 가장 바깥 컨테이너에 붙일 클래스예요. */
  containerClassName?: string
  /** 입력하는 동안 지우기 버튼을 보일지 정해요. 기본은 true예요. */
  showClearButton?: boolean
  /** input 요소를 가리키는 ref예요. */
  ref?: Ref<HTMLInputElement>
}

/**
 * 검색어를 받는 입력 칸이에요.
 * 포커스와 값을 보고 default, focused, typing, complete 상태를 알아서 바꿔요.
 */
export function Search({
  type = 'outline',
  hasBackButton = false,
  state,
  value: controlledValue,
  onChange,
  onSearch,
  onBack,
  onClear,
  placeholder = '검색어를 입력하세요',
  className,
  containerClassName,
  disabled = false,
  showClearButton = true,
  onFocus,
  onBlur,
  onKeyDown,
  ref,
  ...props
}: SearchProps) {
  const [isFocused, setIsFocused] = useState(false)
  const [internalValue, setInternalValue] = useState(controlledValue || '')
  const inputRef = useRef<HTMLInputElement>(null)

  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement)

  const currentValue = controlledValue !== undefined ? controlledValue : internalValue
  const hasValue = currentValue.length > 0
  const isTyping = isFocused && hasValue
  const computedState: SearchState = disabled
    ? 'disabled'
    : isTyping
      ? 'typing'
      : isFocused
        ? 'focused'
        : hasValue
          ? 'complete'
          : state || 'default'

  const handleFocus = (e: FocusEvent<HTMLInputElement>) => {
    setIsFocused(true)
    onFocus?.(e)
  }
  const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
    setIsFocused(false)
    onBlur?.(e)
  }
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (controlledValue === undefined) setInternalValue(e.target.value)
    onChange?.(e.target.value)
  }
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') onSearch?.(currentValue)
    onKeyDown?.(e)
  }
  const handleClear = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    if (controlledValue === undefined) setInternalValue('')
    onClear?.()
    onChange?.('')
  }
  const handleSearchClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    onSearch?.(currentValue)
  }
  const handleBackClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    onBack?.()
  }

  const shouldShowClearButton = showClearButton && !disabled && hasValue && isFocused

  return (
    <div className={cx('mw-search-container', containerClassName)}>
      <div
        className={cx(
          'mw-search',
          `mw-search--${computedState}`,
          `mw-search--type-${type}`,
          hasBackButton && 'mw-search--back-button',
          className,
        )}
      >
        {hasBackButton && (
          <div className="mw-search__back-button-container">
            <button
              type="button"
              className="mw-search__back-button"
              onMouseDown={handleBackClick}
              disabled={disabled}
              tabIndex={-1}
              aria-label="뒤로 가기"
            >
              <IcLineChevronLeft />
            </button>
          </div>
        )}
        <div className="mw-search__input-area">
          <input
            ref={inputRef}
            type="text"
            className="mw-search__input"
            value={currentValue}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            {...props}
          />
        </div>
        <div className="mw-search__icons-container">
          {shouldShowClearButton && (
            <div className="mw-search__clear-button-container">
              <button
                type="button"
                className="mw-search__clear-button"
                onMouseDown={handleClear}
                tabIndex={-1}
                aria-label="검색어 지우기"
              >
                <IcFillDelete />
              </button>
            </div>
          )}
          <div className="mw-search__search-button-container">
            <button
              type="button"
              className="mw-search__search-button"
              onMouseDown={handleSearchClick}
              disabled={disabled}
              tabIndex={-1}
              aria-label="검색"
            >
              <IcLineSearch />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
