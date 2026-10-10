import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'
import { cx } from './cx'
import { IcLineChevronRight } from './icons'

export type TextButtonVariant = 'chevron' | 'ghost' | 'underline'
export type TextButtonSize = 'small' | 'medium' | 'large'
export type TextButtonDensity = 'default' | 'compact'

export type TextButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  /** 버튼의 모양이에요. chevron은 레이블 뒤에 화살표를 알아서 붙여요. 기본은 ghost예요. */
  variant?: TextButtonVariant
  /** 글자 크기와 높이예요. 기본은 medium이에요. */
  size?: TextButtonSize
  /** 밀도예요. compact는 스낵바처럼 좁은 곳에서 써요. 기본은 default예요. */
  density?: TextButtonDensity
  /** 레이블이에요. */
  children: ReactNode
  /** button 요소를 가리키는 ref예요. */
  ref?: Ref<HTMLButtonElement>
}

/** 글자가 중심인 가벼운 버튼이에요. 보조 동작이나 이동에 써요. */
export function TextButton({
  variant = 'ghost',
  size = 'medium',
  density = 'default',
  className,
  children,
  ref,
  ...props
}: TextButtonProps) {
  return (
    <button
      ref={ref}
      className={cx(
        'mw-text-button',
        `mw-text-button--${variant}`,
        `mw-text-button--${size}`,
        `mw-text-button--${density}`,
        className,
      )}
      {...props}
    >
      <span>{children}</span>
      {variant === 'chevron' && <IcLineChevronRight />}
    </button>
  )
}
