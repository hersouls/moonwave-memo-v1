import type { HTMLAttributes, Ref } from 'react'
import { cx } from './cx'

export type DividerType = 'inset' | 'full-width'

export type DividerProps = HTMLAttributes<HTMLDivElement> & {
  /** 구분선 유형이에요. inset은 좌우 20px 안쪽의 1px 선, full-width는 끝까지 닿는 8px 띠예요. 기본은 inset이에요. */
  type?: DividerType
  /** 덧붙일 클래스예요. */
  className?: string
  /** div 요소를 가리키는 ref예요. */
  ref?: Ref<HTMLDivElement>
}

/** 정보 묶음 사이를 나누는 구분선이에요. 위아래로 20px 여백을 함께 가져요. */
export function Divider({ type = 'inset', className, ref, ...props }: DividerProps) {
  return (
    <div
      ref={ref}
      className={cx('mw-divider', `mw-divider--${type}`, className)}
      role="separator"
      aria-orientation="horizontal"
      {...props}
    />
  )
}
