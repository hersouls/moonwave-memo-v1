import { useState } from 'react'
import type { ButtonHTMLAttributes, HTMLAttributes, KeyboardEvent, MouseEvent, ReactNode, Ref } from 'react'
import { cx } from './cx'
import { IcLineChevronDown, IcLineClose } from './icons'

export type ChipActive = 'on' | 'off'

export type SelectChipProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  /** 선택 상태예요. on이면 채워진 모습, off면 옅은 모습이에요. 기본은 off예요. */
  active?: ChipActive
  /** 칩 레이블이에요. */
  children: ReactNode
  /** button 요소를 가리키는 ref예요. */
  ref?: Ref<HTMLButtonElement>
}

/** 여러 값 가운데 하나를 고르는 칩이에요. 레이블만 있어요. */
export function SelectChip({ active = 'off', className, children, ref, ...props }: SelectChipProps) {
  return (
    <button ref={ref} type="button" className={cx('mw-select-chip', `mw-select-chip--${active}`, className)} {...props}>
      {children}
    </button>
  )
}

export type FilterChipProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  /** 필터 적용 상태예요. on이면 채워진 모습이에요. 기본은 off예요. */
  active?: ChipActive
  /** 칩 레이블이에요. */
  children: ReactNode
  /** button 요소를 가리키는 ref예요. */
  ref?: Ref<HTMLButtonElement>
}

/** 목록을 조건으로 거르는 칩이에요. 레이블 오른쪽에 아래 화살표가 붙어요. */
export function FilterChip({ active = 'off', className, children, ref, ...props }: FilterChipProps) {
  return (
    <button ref={ref} type="button" className={cx('mw-filter-chip', `mw-filter-chip--${active}`, className)} {...props}>
      {children}
      <span className="mw-filter-chip__icon">
        <IcLineChevronDown />
      </span>
    </button>
  )
}

export type InputChipProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  /** 선택 상태예요. 기본은 off예요. */
  active?: ChipActive
  /** X 아이콘을 누르거나 Enter, Space로 실행할 때 불러요. 칩 본체의 onClick은 함께 불리지 않아요. */
  onIconClick?: (event: MouseEvent<HTMLSpanElement> | KeyboardEvent<HTMLSpanElement>) => void
  /** 칩 레이블이에요. */
  children: ReactNode
  /** button 요소를 가리키는 ref예요. */
  ref?: Ref<HTMLButtonElement>
}

/** 고른 값을 보여 주고 지우는 칩이에요. 레이블 오른쪽에 X가 붙어요. */
export function InputChip({ active = 'off', onIconClick, className, children, ref, ...props }: InputChipProps) {
  const handleIconClick = (event: MouseEvent<HTMLSpanElement> | KeyboardEvent<HTMLSpanElement>) => {
    event.stopPropagation()
    onIconClick?.(event)
  }

  return (
    <button ref={ref} type="button" className={cx('mw-input-chip', `mw-input-chip--${active}`, className)} {...props}>
      {children}
      <span
        className="mw-input-chip__icon"
        onClick={handleIconClick}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            handleIconClick(event)
          }
        }}
      >
        <IcLineClose label="지우기" />
      </span>
    </button>
  )
}

export type ChipGroupProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  /** 칩들을 넣어요. */
  children: ReactNode
  /** 칩이 놓이는 안쪽 div를 가리키는 ref예요. */
  ref?: Ref<HTMLDivElement>
}

/** 칩을 한 줄로 늘어놓는 그룹이에요. 넘치면 가로로 스크롤하고 오른쪽 끝이 흐려져요. */
export function ChipGroup({ className, children, ref, ...props }: ChipGroupProps) {
  return (
    <div className="mw-chip-group-wrapper">
      <div ref={ref} className={cx('mw-chip-group', className)} {...props}>
        {children}
      </div>
      <div className="mw-chip-group__gradient" aria-hidden="true" />
    </div>
  )
}

export type FolderChipGroupToggleButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  /** 펼침 상태예요. true면 화살표가 위를 봐요. 기본은 false예요. */
  expanded?: boolean
  /** button 요소를 가리키는 ref예요. */
  ref?: Ref<HTMLButtonElement>
}

/** Folder Chip Group을 접고 펴는 둥근 버튼이에요. */
export function FolderChipGroupToggleButton({ expanded = false, className, ref, ...props }: FolderChipGroupToggleButtonProps) {
  return (
    <button
      ref={ref}
      type="button"
      className={cx('mw-folder-chip-group-toggle', className)}
      aria-label={expanded ? '접기' : '펼치기'}
      aria-expanded={expanded}
      data-expanded={expanded}
      {...props}
    >
      <IcLineChevronDown />
    </button>
  )
}

export type FolderChipGroupProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  /** 처음 펼침 상태예요. expanded 없이 쓸 때 줘요. 기본은 false예요. */
  defaultExpanded?: boolean
  /** 펼침 상태예요. 주면 바깥에서 상태를 관리해요. */
  expanded?: boolean
  /** 펼침 상태가 바뀔 때 새 값을 넘겨 줘요. */
  onExpandedChange?: (expanded: boolean) => void
  /** 칩들을 넣어요. */
  children: ReactNode
  /** 칩이 놓이는 안쪽 div를 가리키는 ref예요. */
  ref?: Ref<HTMLDivElement>
}

/** 접으면 한 줄로 스크롤하고 펴면 여러 줄로 감싸는 칩 그룹이에요. 토글 버튼이 들어 있어요. */
export function FolderChipGroup({
  defaultExpanded = false,
  expanded: controlledExpanded,
  onExpandedChange,
  className,
  children,
  ref,
  ...props
}: FolderChipGroupProps) {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded)
  const isControlled = controlledExpanded !== undefined
  const expanded = isControlled ? controlledExpanded : internalExpanded

  const handleToggle = () => {
    const next = !expanded
    if (!isControlled) setInternalExpanded(next)
    onExpandedChange?.(next)
  }

  return (
    <div className="mw-folder-chip-group-wrapper">
      <div
        ref={ref}
        className={cx('mw-folder-chip-group', expanded ? 'mw-folder-chip-group--expanded' : 'mw-folder-chip-group--collapsed', className)}
        {...props}
      >
        {children}
      </div>
      {!expanded && <div className="mw-folder-chip-group__gradient" aria-hidden="true" />}
      <FolderChipGroupToggleButton expanded={expanded} onClick={handleToggle} />
    </div>
  )
}
