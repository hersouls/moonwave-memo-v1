import { useCallback, useEffect, useId, useImperativeHandle, useRef, useState } from 'react'
import type { ChangeEvent, FocusEvent, Ref, TextareaHTMLAttributes } from 'react'
import { cx } from './cx'
import { HelperText } from './HelperText'
import type { HelperTextType } from './HelperText'

export type TextAreaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'defaultValue'> & {
  /** 모양이에요. 지금은 default 하나예요. */
  variant?: 'default'
  /** 크기예요. 지금은 default 하나예요. */
  size?: 'default'
  /** 레이블이에요. 비어 있을 때는 플레이스홀더 자리에 보이고, 입력하면 위로 올라가 작아져요. */
  label?: string
  /** 입력 영역 아래에 보이는 안내문이에요. */
  helperText?: string
  /** 안내문의 종류예요. error가 true면 늘 error로 보여요. 기본은 default예요. */
  helperTextType?: HelperTextType
  /** 오류 상태예요. 기본은 false예요. */
  error?: boolean
  /** 읽기 전용 상태예요. 기본은 false예요. */
  readOnly?: boolean
  /** 입력을 마친 상태예요. 기본은 false예요. */
  complete?: boolean
  /** 입력 중 상태를 직접 정할 때 써요. 넘기지 않으면 포커스를 보고 알아서 바꿔요. */
  typing?: boolean
  /** 최대 글자 수예요. 카운터의 분모로도 써요. */
  maxLength?: number
  /** 글자 수 카운터를 보일지 정해요. maxLength가 있을 때만 보여요. 기본은 true예요. */
  showCounter?: boolean
  /** 입력한 글이에요. 값을 밖에서 관리할 때 써요. */
  value?: string
  /** 처음 넣어 둘 글이에요. 값을 안에서 관리할 때 써요. */
  defaultValue?: string
  /** 테두리가 있는 입력 영역에 붙일 클래스예요. */
  containerClassName?: string
  /** 레이블에 붙일 클래스예요. */
  labelClassName?: string
  /** 안내문에 붙일 클래스예요. */
  helperTextClassName?: string
  /** 카운터에 붙일 클래스예요. */
  counterClassName?: string
  /** textarea 요소를 가리키는 ref예요. */
  ref?: Ref<HTMLTextAreaElement>
}

/**
 * 여러 줄 글을 받는 입력 영역이에요.
 * 내용이 늘면 높이가 따라 늘고, maxLength를 주면 오른쪽 아래에 글자 수를 보여 줘요.
 */
export function TextArea({
  variant = 'default',
  size = 'default',
  className,
  containerClassName,
  labelClassName,
  helperTextClassName,
  counterClassName,
  label,
  helperText,
  helperTextType = 'default',
  error = false,
  readOnly = false,
  complete = false,
  typing,
  maxLength,
  showCounter = true,
  value,
  defaultValue,
  onFocus,
  onBlur,
  onChange,
  disabled,
  id,
  ref,
  ...props
}: TextAreaProps) {
  const [internalValue, setInternalValue] = useState(defaultValue || '')
  const [isTyping, setIsTyping] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const autoId = useId()
  const textareaId = id ?? autoId

  useImperativeHandle(ref, () => textareaRef.current as HTMLTextAreaElement)

  const actualValue = value !== undefined ? value : internalValue
  const isInTypingState = typing !== undefined ? typing : isTyping && isFocused
  const currentLength = String(actualValue).length
  const hasValue = currentLength > 0

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${textarea.scrollHeight}px`
    }
  }, [])

  useEffect(() => {
    adjustHeight()
  }, [actualValue, adjustHeight])

  const handleFocus = (e: FocusEvent<HTMLTextAreaElement>) => {
    setIsFocused(true)
    setIsTyping(true)
    onFocus?.(e)
  }
  const handleBlur = (e: FocusEvent<HTMLTextAreaElement>) => {
    setIsFocused(false)
    setIsTyping(false)
    onBlur?.(e)
  }
  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    if (value === undefined) setInternalValue(e.target.value)
    setIsTyping(true)
    adjustHeight()
    onChange?.(e)
  }

  return (
    <div className="mw-textarea-container">
      <div
        className={cx(
          'mw-textarea',
          `mw-textarea--${variant}`,
          `mw-textarea--${size}-size`,
          error && 'mw-textarea--error',
          disabled && 'mw-textarea--disabled',
          readOnly && 'mw-textarea--read-only',
          complete && 'mw-textarea--complete',
          isInTypingState && 'mw-textarea--typing',
          hasValue && 'mw-textarea--has-value',
          containerClassName,
        )}
      >
        <div className="mw-textarea__input-area">
          {label && (
            <label htmlFor={textareaId} className={cx('mw-textarea__label', labelClassName)}>
              {label}
            </label>
          )}
          <textarea
            id={textareaId}
            ref={textareaRef}
            className={cx('mw-textarea__textarea', className)}
            value={actualValue}
            maxLength={maxLength}
            disabled={disabled}
            readOnly={readOnly}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onChange={handleChange}
            {...props}
          />
        </div>
        {showCounter && maxLength !== undefined && (
          <div className={cx('mw-textarea__counter', counterClassName)}>
            <span className="mw-textarea__counter-text">{currentLength}</span>
            <span className="mw-textarea__counter-text">/</span>
            <span className="mw-textarea__counter-text">{maxLength}</span>
          </div>
        )}
      </div>
      {helperText && (
        <HelperText type={error ? 'error' : helperTextType} className={helperTextClassName}>
          {helperText}
        </HelperText>
      )}
    </div>
  )
}
