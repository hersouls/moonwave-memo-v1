import { Fragment, useEffect, useId, useImperativeHandle, useRef, useState } from 'react'
import type {
  ChangeEvent,
  CompositionEvent,
  FocusEvent,
  FormEvent,
  InputHTMLAttributes,
  KeyboardEvent,
  MouseEvent,
  ReactNode,
  Ref,
} from 'react'
import { Button } from './Button'
import type { ButtonProps } from './Button'
import { cx } from './cx'
import { HelperText } from './HelperText'
import { IcFillDelete, IcLineEye, IcLineEyeHidden } from './icons'

export type TextFieldState = 'default' | 'focused' | 'typing' | 'complete' | 'error' | 'disabled' | 'read-only'

export type TextFieldInputType =
  | 'text'
  | 'password'
  | 'email'
  | 'number'
  | 'tel'
  | 'url'
  | 'search'
  | 'default'
  | 'id'
  | 'certification'
  | 'national-id'

export type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'children'> & {
  /** 입력 칸의 레이블이에요. 비어 있을 때는 플레이스홀더 자리에 보이고, 입력하면 위로 올라가요. */
  label: string
  /** 입력 칸 아래에 보이는 안내문이에요. error가 true면 오류 색으로 바뀌어요. */
  helperText?: string
  /** 포커스도 값도 없을 때 쓸 상태예요. 넘기지 않으면 default예요. */
  state?: TextFieldState
  /** 오류 상태예요. 기본은 false예요. */
  error?: boolean
  /** 입력 종류예요. password는 보기 버튼을 붙이고, number는 숫자만 받아요. 기본은 default예요. */
  inputType?: TextFieldInputType
  /** 가장 바깥 컨테이너에 붙일 클래스예요. */
  containerClassName?: string
  /** 입력 칸 왼쪽에 놓을 아이콘이에요. */
  leftIcon?: ReactNode
  /** 입력하는 동안 지우기 버튼을 보일지 정해요. 기본은 true예요. */
  showClearButton?: boolean
  /** 지우기 버튼을 누르면 불러요. */
  onClear?: () => void
  /** 입력 칸 오른쪽에 놓을 내용이에요. TextFieldButton이나 TextFieldTimer를 넣어요. */
  children?: ReactNode
  /** input 요소를 가리키는 ref예요. */
  ref?: Ref<HTMLInputElement>
}

const NATIVE_INPUT_TYPES: readonly string[] = ['text', 'email', 'tel', 'url', 'search']
const NUMBER_CONTROL_KEYS: readonly string[] = [
  'Backspace',
  'Delete',
  'Tab',
  'Enter',
  'Escape',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
]
const NUMBER_SHORTCUT_KEYS: readonly string[] = ['a', 'c', 'v', 'x', 'z']

function digitsOnly(value: string, maxLength?: number): string {
  const digits = value.replace(/[^0-9]/g, '')
  return maxLength && digits.length > maxLength ? digits.slice(0, maxLength) : digits
}

/**
 * 글자나 숫자를 한 줄로 받는 입력 칸이에요.
 * 포커스와 값을 보고 default, focused, typing, complete 상태를 알아서 바꿔요.
 */
export function TextField({
  label,
  helperText,
  state,
  error = false,
  inputType = 'default',
  disabled = false,
  readOnly = false,
  className,
  containerClassName,
  leftIcon,
  showClearButton = true,
  onClear,
  value,
  onChange,
  onFocus,
  onBlur,
  children,
  maxLength,
  id,
  ref,
  ...props
}: TextFieldProps) {
  const [isFocused, setIsFocused] = useState(false)
  const [internalValue, setInternalValue] = useState<NonNullable<TextFieldProps['value']>>(value || '')
  const [showPassword, setShowPassword] = useState(false)
  const [isComposing, setIsComposing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const autoId = useId()
  const inputId = id ?? autoId

  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement)

  const isNumber = inputType === 'number'
  const currentValue = value !== undefined ? value : internalValue
  const hasValue = String(currentValue).length > 0
  const isTyping = isFocused && hasValue
  const computedState: TextFieldState = disabled
    ? 'disabled'
    : isTyping
      ? 'typing'
      : isFocused
        ? 'focused'
        : hasValue
          ? 'complete'
          : state || 'default'

  const handleFocus = (e: FocusEvent<HTMLInputElement>) => {
    if (!readOnly) setIsFocused(true)
    onFocus?.(e)
  }
  const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
    if (!readOnly) setIsFocused(false)
    onBlur?.(e)
  }
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    let newValue = e.target.value
    if (isNumber && !isComposing) {
      newValue = digitsOnly(newValue, maxLength)
      if (newValue !== e.target.value) e.target.value = newValue
    }
    if (value === undefined) setInternalValue(newValue)
    onChange?.(e)
  }
  const handleInput = (e: FormEvent<HTMLInputElement>) => {
    if (!isNumber) return
    const input = e.currentTarget
    const limited = digitsOnly(input.value, maxLength)
    if (input.value !== limited) {
      input.value = limited
      if (value === undefined) setInternalValue(limited)
    }
  }
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!isNumber) return
    const isNumberKey = /^[0-9]$/.test(e.key)
    const isControlKey = NUMBER_CONTROL_KEYS.includes(e.key)
    const isShortcut = (e.ctrlKey || e.metaKey) && NUMBER_SHORTCUT_KEYS.includes(e.key.toLowerCase())
    if (!isNumberKey && !isControlKey && !isShortcut) {
      e.preventDefault()
      return
    }
    if (isNumberKey && maxLength && e.currentTarget.value.length >= maxLength) e.preventDefault()
  }
  const handleCompositionStart = (e: CompositionEvent<HTMLInputElement>) => {
    if (isNumber) e.preventDefault()
    setIsComposing(true)
  }
  const handleCompositionEnd = (e: CompositionEvent<HTMLInputElement>) => {
    setIsComposing(false)
    if (!isNumber) return
    const target = e.currentTarget
    const limited = digitsOnly(target.value, maxLength)
    if (target.value !== limited) {
      target.value = limited
      if (value === undefined) setInternalValue(limited)
      onChange?.({ ...e, target, currentTarget: target } as unknown as ChangeEvent<HTMLInputElement>)
    }
  }
  const togglePasswordVisibility = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    setShowPassword((shown) => !shown)
  }
  const handleClear = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    if (value === undefined) setInternalValue('')
    onClear?.()
    const input = inputRef.current
    if (onChange && input) {
      const target = { value: '', name: input.name, id: input.id }
      onChange({ target, currentTarget: target } as unknown as ChangeEvent<HTMLInputElement>)
    }
  }

  const nativeInputType =
    inputType === 'password'
      ? showPassword
        ? 'text'
        : 'password'
      : isNumber
        ? 'tel'
        : NATIVE_INPUT_TYPES.includes(inputType)
          ? inputType
          : 'text'
  const shouldShowClearButton = showClearButton && !disabled && !readOnly && hasValue && isFocused

  return (
    <div className={cx('mw-textfield-container', containerClassName)}>
      <div
        className={cx(
          'mw-textfield',
          `mw-textfield--${computedState}`,
          disabled && hasValue && 'mw-textfield--complete',
          error && 'mw-textfield--error',
          readOnly && 'mw-textfield--read-only',
          inputType && `mw-textfield--type-${inputType}`,
          className,
        )}
      >
        {leftIcon && <div className="mw-textfield__icon-container mw-textfield__icon-container--left">{leftIcon}</div>}
        <div className="mw-textfield__input-area">
          <label className="mw-textfield__label" htmlFor={inputId}>
            {label}
          </label>
          <input
            ref={inputRef}
            id={inputId}
            type={nativeInputType}
            className="mw-textfield__input"
            disabled={disabled}
            readOnly={readOnly}
            value={currentValue}
            onChange={handleChange}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            onFocus={handleFocus}
            onBlur={handleBlur}
            inputMode={isNumber ? 'numeric' : undefined}
            maxLength={maxLength}
            {...props}
          />
        </div>
        {shouldShowClearButton && (
          <div className="mw-textfield__clear-button-container">
            <button
              type="button"
              className="mw-textfield__clear-button"
              onMouseDown={handleClear}
              tabIndex={-1}
              aria-label="입력 내용 지우기"
            >
              <IcFillDelete />
            </button>
          </div>
        )}
        {inputType === 'password' && !disabled && isFocused && (
          <div className="mw-textfield__password-button-container">
            <button
              type="button"
              className="mw-textfield__password-button"
              onMouseDown={togglePasswordVisibility}
              tabIndex={-1}
              aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
            >
              {showPassword ? <IcLineEyeHidden /> : <IcLineEye />}
            </button>
          </div>
        )}
        {children && (isFocused || hasValue) && <div className="mw-textfield__right-content">{children}</div>}
      </div>
      {helperText && <HelperText type={error ? 'error' : 'default'}>{helperText}</HelperText>}
    </div>
  )
}

export type TextFieldFormatType = 'national-id' | 'business-id'

type FormatSegment = { length: number; maskable: boolean }

const FORMAT_CONFIGS: Record<TextFieldFormatType, { segments: FormatSegment[]; separator: string }> = {
  'national-id': {
    segments: [
      { length: 6, maskable: false },
      { length: 7, maskable: true },
    ],
    separator: '-',
  },
  'business-id': {
    segments: [
      { length: 3, maskable: false },
      { length: 2, maskable: false },
      { length: 5, maskable: false },
    ],
    separator: '-',
  },
}

export type TextFieldFormattedProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'onChange' | 'children' | 'maxLength'
> & {
  /** 입력 칸의 레이블이에요. */
  label: string
  /** 형식이에요. national-id는 6-7자리, business-id는 3-2-5자리로 나눠요. */
  formatType: TextFieldFormatType
  /** 값이에요. 구분 기호 없이 숫자만 넘겨요. 기본은 빈 문자열이에요. */
  value?: string
  /** 값이 바뀌면 숫자만 이어 붙인 문자열로 불러요. */
  onChange?: (value: string) => void
  /** 입력 칸 아래에 보이는 안내문이에요. error가 true면 오류 색으로 바뀌어요. */
  helperText?: string
  /** 포커스도 값도 없을 때 쓸 상태예요. 넘기지 않으면 default예요. */
  state?: TextFieldState
  /** 오류 상태예요. 기본은 false예요. */
  error?: boolean
  /** 가장 바깥 컨테이너에 붙일 클래스예요. */
  containerClassName?: string
  /** 처음부터 가려서 보일지 정해요. national-id의 뒤 6자리에만 적용돼요. 기본은 true예요. */
  defaultMasked?: boolean
  /** 입력 칸 오른쪽에 놓을 내용이에요. TextFieldButton이나 TextFieldTimer를 넣어요. */
  children?: ReactNode
  /** 첫 번째 input 요소를 가리키는 ref예요. */
  ref?: Ref<HTMLInputElement>
}

/**
 * 정해진 자릿수로 나눠 받는 입력 칸이에요.
 * 한 칸을 다 채우면 다음 칸으로 넘어가고, 빈 자리는 자리 표시 글자로 보여 줘요.
 */
export function TextFieldFormatted({
  label,
  helperText,
  state,
  error = false,
  formatType,
  disabled = false,
  readOnly = false,
  className,
  containerClassName,
  value = '',
  onChange,
  onFocus,
  onBlur,
  defaultMasked = true,
  children,
  id,
  ref,
  ...props
}: TextFieldFormattedProps) {
  const [isFocused, setIsFocused] = useState(false)
  const [masked] = useState(defaultMasked)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const autoId = useId()
  const inputId = id ?? autoId
  const config = FORMAT_CONFIGS[formatType]

  useImperativeHandle(ref, () => inputRefs.current[0] as HTMLInputElement)

  const numbers = value.replace(/[^0-9]/g, '')
  const hasValue = numbers.length > 0
  const segmentValues: string[] = []
  let offset = 0
  for (const segment of config.segments) {
    segmentValues.push(numbers.slice(offset, offset + segment.length))
    offset += segment.length
  }

  const isTyping = isFocused && hasValue
  const computedState: TextFieldState = disabled
    ? 'disabled'
    : isTyping
      ? 'typing'
      : isFocused
        ? 'focused'
        : hasValue
          ? 'complete'
          : state || 'default'
  const showDisplay = isFocused || hasValue

  const handleSegmentFocus = (e: FocusEvent<HTMLInputElement>) => {
    if (!readOnly) setIsFocused(true)
    onFocus?.(e)
  }
  const handleSegmentBlur = (e: FocusEvent<HTMLInputElement>) => {
    if (!readOnly) {
      // 다른 칸으로 옮겨 간 것인지 본 뒤에 포커스를 풀어요.
      setTimeout(() => {
        if (!inputRefs.current.some((input) => input === document.activeElement)) setIsFocused(false)
      }, 0)
    }
    onBlur?.(e)
  }
  const handleSegmentChange = (segmentIndex: number) => (e: ChangeEvent<HTMLInputElement>) => {
    const segment = config.segments[segmentIndex]
    const limited = e.target.value.replace(/[^0-9]/g, '').slice(0, segment.length)
    const nextValues = [...segmentValues]
    nextValues[segmentIndex] = limited
    onChange?.(nextValues.join(''))
    if (limited.length === segment.length && segmentIndex < config.segments.length - 1) {
      inputRefs.current[segmentIndex + 1]?.focus()
    }
  }
  const handleSegmentKeyDown = (segmentIndex: number) => (e: KeyboardEvent<HTMLInputElement>) => {
    const input = e.currentTarget
    const atStart = input.selectionStart === 0
    if ((e.key === 'Backspace' || e.key === 'ArrowLeft') && atStart && segmentIndex > 0) {
      e.preventDefault()
      const prevInput = inputRefs.current[segmentIndex - 1]
      prevInput?.focus()
      prevInput?.setSelectionRange(prevInput.value.length, prevInput.value.length)
    }
    if (
      e.key === 'ArrowRight' &&
      input.selectionStart === input.value.length &&
      segmentIndex < config.segments.length - 1
    ) {
      e.preventDefault()
      inputRefs.current[segmentIndex + 1]?.focus()
    }
  }
  const renderSegmentChars = (segmentValue: string, segmentIndex: number) => {
    const segment = config.segments[segmentIndex]
    const isNationalId = formatType === 'national-id'
    const needsFixedWidth = formatType === 'business-id' || (isNationalId && segmentIndex === 1)
    return Array.from({ length: segment.length }, (_, i) => {
      const char = segmentValue[i]
      const shouldMask = masked && segment.maskable && !(isNationalId && segmentIndex === 1 && i === 0)
      const displayChar = char ? (shouldMask ? ' ● ' : char) : isNationalId && segmentIndex === 0 ? '0' : '●'
      return (
        <span
          key={i}
          className={cx(
            'mw-textfield__formatted-char',
            !char && 'mw-textfield__formatted-char--placeholder',
            needsFixedWidth && 'mw-textfield__formatted-char--fixed-width',
          )}
        >
          {displayChar}
        </span>
      )
    })
  }

  return (
    <div className={cx('mw-textfield-container', containerClassName)}>
      <div
        className={cx(
          'mw-textfield',
          `mw-textfield--${computedState}`,
          disabled && hasValue && 'mw-textfield--complete',
          error && 'mw-textfield--error',
          readOnly && 'mw-textfield--read-only',
          'mw-textfield--formatted',
          className,
        )}
      >
        <div className="mw-textfield__input-area">
          <label className="mw-textfield__label" htmlFor={inputId}>
            {label}
          </label>
          <div className="mw-textfield__formatted-inputs">
            {config.segments.map((segment, segmentIndex) => (
              <Fragment key={segmentIndex}>
                <div className="mw-textfield__formatted-segment-wrapper">
                  <input
                    ref={(el) => {
                      inputRefs.current[segmentIndex] = el
                    }}
                    id={segmentIndex === 0 ? inputId : undefined}
                    type="tel"
                    className="mw-textfield__formatted-segment-input"
                    disabled={disabled}
                    readOnly={readOnly}
                    value={segmentValues[segmentIndex] || ''}
                    onChange={handleSegmentChange(segmentIndex)}
                    onFocus={handleSegmentFocus}
                    onBlur={handleSegmentBlur}
                    onKeyDown={handleSegmentKeyDown(segmentIndex)}
                    inputMode="numeric"
                    maxLength={segment.length}
                    aria-label={segmentIndex === 0 ? undefined : `${label} ${segmentIndex + 1}번째 칸`}
                    {...props}
                  />
                  <div
                    className={cx(
                      'mw-textfield__formatted-segment-display',
                      !showDisplay && 'mw-textfield__formatted-segment-display--hidden',
                    )}
                  >
                    {renderSegmentChars(segmentValues[segmentIndex] || '', segmentIndex)}
                  </div>
                </div>
                {segmentIndex < config.segments.length - 1 && (
                  <span
                    className={cx(
                      'mw-textfield__formatted-separator',
                      !showDisplay && 'mw-textfield__formatted-separator--hidden',
                    )}
                  >
                    {config.separator}
                  </span>
                )}
              </Fragment>
            ))}
          </div>
        </div>
        {children && showDisplay && <div className="mw-textfield__right-content">{children}</div>}
      </div>
      {helperText && <HelperText type={error ? 'error' : 'default'}>{helperText}</HelperText>}
    </div>
  )
}

export type TextFieldButtonProps = ButtonProps

/** 입력 칸 오른쪽에 넣는 버튼이에요. 기본은 secondary, small이에요. */
export function TextFieldButton({ variant = 'secondary', size = 'small', type = 'button', ...props }: TextFieldButtonProps) {
  return <Button variant={variant} size={size} type={type} {...props} />
}

export type TextFieldTimerProps = {
  /** 처음 남은 시간이에요. 초 단위로 넘겨요. */
  seconds: number
  /** 남은 시간이 0이 되면 불러요. */
  onExpire?: () => void
  /** 남은 초를 글자로 바꾸는 함수예요. 넘기지 않으면 `분:초`로 보여 줘요. */
  format?: (seconds: number) => string
}

function formatMinutesSeconds(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`
}

/** 입력 칸 오른쪽에 넣는 남은 시간 표시예요. 1초마다 줄어들어요. */
export function TextFieldTimer({ seconds, onExpire, format }: TextFieldTimerProps) {
  const [timeLeft, setTimeLeft] = useState(seconds)
  const onExpireRef = useRef(onExpire)

  useEffect(() => {
    onExpireRef.current = onExpire
  })
  useEffect(() => {
    setTimeLeft(seconds)
  }, [seconds])
  useEffect(() => {
    if (timeLeft <= 0) {
      onExpireRef.current?.()
      return
    }
    const timer = setTimeout(() => setTimeLeft((prev) => Math.max(0, prev - 1)), 1000)
    return () => clearTimeout(timer)
  }, [timeLeft])

  return <span className="mw-textfield__timer">{format ? format(timeLeft) : formatMinutesSeconds(timeLeft)}</span>
}
