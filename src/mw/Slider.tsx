import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  ChangeEvent,
  HTMLAttributes,
  KeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  Ref,
} from 'react'
import { cx } from './cx'

/** 핸들 반지름이에요. 핸들이 트랙 끝을 넘지 않도록 양 끝에서 이만큼 안쪽으로만 움직여요. */
const EDGE_MARGIN = 12
const HANDLE_SIZE = 'var(--slider-handle-default-sizing)'

function toRatio(value: number, min: number, max: number): number {
  if (max <= min) return 0
  return Math.max(0, Math.min(1, (value - min) / (max - min)))
}

/** 트랙 위에서 핸들 중심이 놓일 자리예요. */
function toPosition(ratio: number): string {
  return `calc(${HANDLE_SIZE} / 2 + (100% - ${HANDLE_SIZE}) * ${ratio})`
}

/** 두 핸들 사이를 채우는 길이예요. */
function toLength(ratio: number): string {
  return `calc((100% - ${HANDLE_SIZE}) * ${ratio})`
}

/** 누른 자리를 step에 맞춘 값으로 바꿔요. */
function valueAt(track: HTMLElement, clientX: number, min: number, max: number, step: number): number {
  const rect = track.getBoundingClientRect()
  const availableWidth = rect.width - EDGE_MARGIN * 2
  const offsetX = Math.max(EDGE_MARGIN, Math.min(rect.width - EDGE_MARGIN, clientX - rect.left))
  const ratio = availableWidth > 0 ? (offsetX - EDGE_MARGIN) / availableWidth : 0
  return Math.round((min + ratio * (max - min)) / step) * step
}

export type SliderPopoverProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  /** 말풍선에 보일 값이에요. */
  value: string | number
  /** div 요소를 가리키는 ref예요. */
  ref?: Ref<HTMLDivElement>
}

/** 핸들 위에 지금 값을 띄우는 말풍선이에요. Slider가 showPopover일 때 알아서 그려요. */
export function SliderPopover({ value, className, ref, ...props }: SliderPopoverProps) {
  return (
    <div ref={ref} className={cx('mw-slider-popover', className)} {...props}>
      <div className="mw-slider-popover__text">{value}</div>
      <div className="mw-slider-popover__caret-container">
        <svg className="mw-slider-popover__caret" width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true">
          <path className="mw-slider-popover__caret-fill" d="M5 6L0 0H10L5 6Z" />
        </svg>
      </div>
    </div>
  )
}

export type SliderProps = Omit<HTMLAttributes<HTMLDivElement>, 'onChange' | 'title' | 'children'> & {
  /** 헤더 왼쪽에 보이는 제목이에요. 넘기면 오른쪽에 지금 값도 함께 보여요. */
  title?: string
  /** 지금 값이에요. 기본은 0이에요. */
  value?: number
  /** 가장 작은 값이에요. 기본은 0이에요. */
  min?: number
  /** 가장 큰 값이에요. 기본은 100이에요. */
  max?: number
  /** 한 번에 움직이는 단위예요. 기본은 1이에요. */
  step?: number
  /** 비활성 상태예요. 기본은 false예요. */
  disabled?: boolean
  /** 트랙 아래 왼쪽에 보이는 최솟값 레이블이에요. */
  minLabel?: string
  /** 트랙 아래 오른쪽에 보이는 최댓값 레이블이에요. */
  maxLabel?: string
  /** 핸들 위 말풍선에 지금 값을 보일지 정해요. true면 헤더는 보이지 않아요. 기본은 false예요. */
  showPopover?: boolean
  /** 값을 화면에 보일 글자로 바꾸는 함수예요. */
  formatValue?: (value: number) => string
  /** 값이 바뀌면 불러요. */
  onChange?: (value: number) => void
  /** 가장 바깥 div 요소를 가리키는 ref예요. */
  ref?: Ref<HTMLDivElement>
}

/**
 * 정해진 범위에서 값 하나를 고르는 슬라이더예요.
 * 끌거나 트랙을 눌러 바꾸고, 방향키와 Home, End로도 바꿀 수 있어요.
 */
export function Slider({
  title,
  value = 0,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  minLabel,
  maxLabel,
  showPopover = false,
  formatValue,
  onChange,
  className,
  'aria-label': ariaLabel,
  ref,
  ...props
}: SliderProps) {
  const [internalValue, setInternalValue] = useState(value)
  const [isDragging, setIsDragging] = useState(false)
  const trackRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setInternalValue(value)
  }, [value])

  const position = toPosition(toRatio(internalValue, min, max))
  const displayValue = formatValue ? formatValue(internalValue) : internalValue.toString()

  const updateValue = useCallback(
    (clientX: number) => {
      const track = trackRef.current
      if (!track || disabled) return
      const nextValue = Math.max(min, Math.min(max, valueAt(track, clientX, min, max, step)))
      setInternalValue(nextValue)
      onChange?.(nextValue)
    },
    [min, max, step, disabled, onChange],
  )

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) return
    setIsDragging(true)
    updateValue(e.clientX)
  }

  useEffect(() => {
    if (!isDragging) return
    const handlePointerMove = (e: PointerEvent) => updateValue(e.clientX)
    const handlePointerUp = () => setIsDragging(false)
    document.addEventListener('pointermove', handlePointerMove)
    document.addEventListener('pointerup', handlePointerUp)
    document.addEventListener('pointercancel', handlePointerUp)
    return () => {
      document.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('pointerup', handlePointerUp)
      document.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [isDragging, updateValue])

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return
    let nextValue = internalValue
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        nextValue = Math.max(min, internalValue - step)
        break
      case 'ArrowRight':
      case 'ArrowUp':
        nextValue = Math.min(max, internalValue + step)
        break
      case 'Home':
        nextValue = min
        break
      case 'End':
        nextValue = max
        break
      default:
        return
    }
    e.preventDefault()
    setInternalValue(nextValue)
    onChange?.(nextValue)
  }

  return (
    <div ref={ref} className={cx('mw-slider', disabled && 'mw-slider--disabled', className)} {...props}>
      {!showPopover && title !== undefined && (
        <div className="mw-slider__header">
          <span className="mw-slider__title">{title}</span>
          <span className="mw-slider__value">{displayValue}</span>
        </div>
      )}
      <div className="mw-slider__container">
        <div
          ref={trackRef}
          className="mw-slider__track"
          style={{ touchAction: 'pan-y' }}
          onPointerDown={handlePointerDown}
          role="slider"
          aria-label={ariaLabel ?? (title || undefined)}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={internalValue}
          aria-valuetext={formatValue ? displayValue : undefined}
          aria-disabled={disabled}
          tabIndex={disabled ? -1 : 0}
          onKeyDown={handleKeyDown}
        >
          <div className="mw-slider__fill" style={{ width: position }} />
          <div className="mw-slider__handle" style={{ left: position, transition: isDragging ? 'none' : undefined }} />
          {showPopover && !disabled && <SliderPopover value={displayValue} style={{ left: position }} />}
        </div>
        {(minLabel !== undefined || maxLabel !== undefined) && (
          <div className="mw-slider__labels">
            <span className="mw-slider__label">{minLabel || ''}</span>
            <span className="mw-slider__label">{maxLabel || ''}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export type SliderRangeValue = [number, number]
type RangeHandle = 'min' | 'max'

const DEFAULT_RANGE: SliderRangeValue = [0, 100]

export type SliderRangeProps = Omit<HTMLAttributes<HTMLDivElement>, 'onChange' | 'title' | 'children'> & {
  /** 슬라이더의 이름이에요. 화면에는 보이지 않고 보조 기술이 읽어요. */
  title?: string
  /** 지금 고른 범위예요. [시작, 끝] 순서로 넘겨요. 기본은 [0, 100]이에요. */
  value?: SliderRangeValue
  /** 가장 작은 값이에요. 기본은 0이에요. */
  min?: number
  /** 가장 큰 값이에요. 기본은 100이에요. */
  max?: number
  /** 한 번에 움직이는 단위예요. 두 핸들은 이만큼은 늘 떨어져 있어요. 기본은 1이에요. */
  step?: number
  /** 비활성 상태예요. 기본은 false예요. */
  disabled?: boolean
  /** 트랙 아래 왼쪽에 보이는 최솟값 레이블이에요. */
  minLabel?: string
  /** 트랙 아래 오른쪽에 보이는 최댓값 레이블이에요. */
  maxLabel?: string
  /** 범위가 바뀌면 [시작, 끝]으로 불러요. */
  onChange?: (value: SliderRangeValue) => void
  /** 가장 바깥 div 요소를 가리키는 ref예요. */
  ref?: Ref<HTMLDivElement>
}

/**
 * 시작과 끝, 두 값을 함께 고르는 범위 슬라이더예요.
 * 트랙을 누르면 가까운 핸들이 그 자리로 움직여요.
 */
export function SliderRange({
  title,
  value = DEFAULT_RANGE,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  minLabel,
  maxLabel,
  onChange,
  className,
  ref,
  ...props
}: SliderRangeProps) {
  const [valueMin, valueMax] = value
  const [internalValue, setInternalValue] = useState<SliderRangeValue>([valueMin, valueMax])
  const [activeHandle, setActiveHandle] = useState<RangeHandle | null>(null)
  const trackRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setInternalValue([valueMin, valueMax])
  }, [valueMin, valueMax])

  const [minValue, maxValue] = internalValue
  const minRatio = toRatio(minValue, min, max)
  const maxRatio = toRatio(maxValue, min, max)

  const updateValue = useCallback(
    (clientX: number, handle: RangeHandle) => {
      const track = trackRef.current
      if (!track || disabled) return
      const steppedValue = valueAt(track, clientX, min, max, step)
      const nextValue: SliderRangeValue =
        handle === 'min'
          ? [Math.max(min, Math.min(steppedValue, maxValue - step)), maxValue]
          : [minValue, Math.min(max, Math.max(steppedValue, minValue + step))]
      setInternalValue(nextValue)
      onChange?.(nextValue)
    },
    [min, max, step, minValue, maxValue, disabled, onChange],
  )

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>, handle: RangeHandle) => {
    if (disabled) return
    e.stopPropagation()
    setActiveHandle(handle)
    updateValue(e.clientX, handle)
  }

  const handleTrackClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    const track = trackRef.current
    if (disabled || !track) return
    const rect = track.getBoundingClientRect()
    const clickValue = min + ((e.clientX - rect.left) / rect.width) * (max - min)
    const closestHandle: RangeHandle =
      Math.abs(clickValue - minValue) < Math.abs(clickValue - maxValue) ? 'min' : 'max'
    updateValue(e.clientX, closestHandle)
  }

  useEffect(() => {
    if (!activeHandle) return
    const handlePointerMove = (e: PointerEvent) => updateValue(e.clientX, activeHandle)
    const handlePointerUp = () => setActiveHandle(null)
    document.addEventListener('pointermove', handlePointerMove)
    document.addEventListener('pointerup', handlePointerUp)
    document.addEventListener('pointercancel', handlePointerUp)
    return () => {
      document.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('pointerup', handlePointerUp)
      document.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [activeHandle, updateValue])

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>, handle: RangeHandle) => {
    if (disabled) return
    let nextMin = minValue
    let nextMax = maxValue
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        if (handle === 'min') nextMin = Math.max(min, minValue - step)
        else nextMax = Math.max(minValue + step, maxValue - step)
        break
      case 'ArrowRight':
      case 'ArrowUp':
        if (handle === 'min') nextMin = Math.min(maxValue - step, minValue + step)
        else nextMax = Math.min(max, maxValue + step)
        break
      case 'Home':
        if (handle === 'min') nextMin = min
        break
      case 'End':
        if (handle === 'max') nextMax = max
        break
      default:
        return
    }
    e.preventDefault()
    const nextValue: SliderRangeValue = [nextMin, nextMax]
    setInternalValue(nextValue)
    onChange?.(nextValue)
  }

  const renderHandle = (handle: RangeHandle, ratio: number, valueNow: number) => (
    <div
      className="mw-slider__handle"
      style={{ left: toPosition(ratio), touchAction: 'pan-y' }}
      onPointerDown={(e) => handlePointerDown(e, handle)}
      role="slider"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={valueNow}
      aria-disabled={disabled}
      aria-label={handle === 'min' ? '최솟값' : '최댓값'}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => handleKeyDown(e, handle)}
    />
  )

  return (
    <div ref={ref} className={cx('mw-slider', disabled && 'mw-slider--disabled', className)} {...props}>
      <div className="mw-slider__container">
        <div
          ref={trackRef}
          className="mw-slider__track"
          onClick={handleTrackClick}
          role="group"
          aria-label={title || '범위 슬라이더'}
        >
          <div
            className="mw-slider__fill"
            style={{ left: toPosition(minRatio), width: toLength(maxRatio - minRatio) }}
          />
          {renderHandle('min', minRatio, minValue)}
          {renderHandle('max', maxRatio, maxValue)}
        </div>
        {(minLabel !== undefined || maxLabel !== undefined) && (
          <div className="mw-slider__labels">
            <span className="mw-slider__label">{minLabel || ''}</span>
            <span className="mw-slider__label">{maxLabel || ''}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export type SliderRangeInputProps = Omit<HTMLAttributes<HTMLDivElement>, 'onChange' | 'children'> & {
  /** 범위의 시작 값이에요. */
  minValue: number
  /** 범위의 끝 값이에요. */
  maxValue: number
  /** 넣을 수 있는 가장 작은 값이에요. 기본은 0이에요. */
  min?: number
  /** 넣을 수 있는 가장 큰 값이에요. 기본은 100이에요. */
  max?: number
  /** 값을 맞추는 단위예요. 기본은 1이에요. */
  step?: number
  /** 비활성 상태예요. 기본은 false예요. */
  disabled?: boolean
  /** 값 뒤에 붙는 단위예요. `원`, `%`, `km`처럼 써요. */
  unit?: string
  /** 입력을 마치면 [시작, 끝]으로 불러요. */
  onChange?: (value: SliderRangeValue) => void
  /** 가장 바깥 div 요소를 가리키는 ref예요. */
  ref?: Ref<HTMLDivElement>
}

/**
 * SliderRange 아래에 두는 숫자 입력 한 쌍이에요.
 * 입력을 마치거나 Enter를 누르면 범위와 step에 맞춰 값을 고친 뒤 onChange를 불러요.
 */
export function SliderRangeInput({
  minValue,
  maxValue,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  unit,
  onChange,
  className,
  ref,
  ...props
}: SliderRangeInputProps) {
  const [minInputValue, setMinInputValue] = useState(minValue.toString())
  const [maxInputValue, setMaxInputValue] = useState(maxValue.toString())

  useEffect(() => {
    setMinInputValue(minValue.toString())
  }, [minValue])
  useEffect(() => {
    setMaxInputValue(maxValue.toString())
  }, [maxValue])

  const handleMinInputBlur = () => {
    const numValue = parseFloat(minInputValue)
    if (isNaN(numValue)) {
      setMinInputValue(minValue.toString())
      return
    }
    const clampedValue = Math.max(min, Math.min(numValue, maxValue - step))
    const steppedValue = Math.round(clampedValue / step) * step
    setMinInputValue(steppedValue.toString())
    onChange?.([steppedValue, maxValue])
  }
  const handleMaxInputBlur = () => {
    const numValue = parseFloat(maxInputValue)
    if (isNaN(numValue)) {
      setMaxInputValue(maxValue.toString())
      return
    }
    const clampedValue = Math.min(max, Math.max(numValue, minValue + step))
    const steppedValue = Math.round(clampedValue / step) * step
    setMaxInputValue(steppedValue.toString())
    onChange?.([minValue, steppedValue])
  }
  const handleInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.currentTarget.blur()
  }

  return (
    <div ref={ref} className={cx('mw-slider__inputs', className)} {...props}>
      <div className="mw-slider__input-container">
        <input
          type="number"
          className="mw-slider__input"
          value={minInputValue}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setMinInputValue(e.target.value)}
          onBlur={handleMinInputBlur}
          onKeyDown={handleInputKeyDown}
          disabled={disabled}
          min={min}
          max={max}
          step={step}
          aria-label="최솟값"
        />
        {unit && <span className="mw-slider__input-unit">{unit}</span>}
      </div>
      <span className="mw-slider__input-separator">~</span>
      <div className="mw-slider__input-container">
        <input
          type="number"
          className="mw-slider__input"
          value={maxInputValue}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setMaxInputValue(e.target.value)}
          onBlur={handleMaxInputBlur}
          onKeyDown={handleInputKeyDown}
          disabled={disabled}
          min={min}
          max={max}
          step={step}
          aria-label="최댓값"
        />
        {unit && <span className="mw-slider__input-unit">{unit}</span>}
      </div>
    </div>
  )
}
