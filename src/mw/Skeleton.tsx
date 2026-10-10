/* Moonwave UX — Skeleton */
import type { CSSProperties, HTMLAttributes, Ref } from 'react'
import { cx } from './cx'

export type SkeletonType = 'text' | 'rectangle' | 'circle'

export type SkeletonProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  /** 자리 모양이에요. text는 글줄, rectangle은 이미지·카드, circle은 프로필 사진 자리예요. */
  type?: SkeletonType
  /** 너비예요. 숫자는 px로, 문자열은 CSS 값 그대로 써요. */
  width?: string | number
  /** 높이예요. 숫자는 px로, 문자열은 CSS 값 그대로 써요. */
  height?: string | number
  /** 스켈레톤 요소를 가리켜요. */
  ref?: Ref<HTMLDivElement>
}

const toCss = (value: string | number) => (typeof value === 'number' ? `${value}px` : value)

/** 콘텐츠가 들어올 자리를 미리 보여 주는 블록이에요. 쉬머가 2초마다 지나가요. */
export function Skeleton({ type = 'text', width, height, className, style, ref, ...props }: SkeletonProps) {
  const customStyle: CSSProperties = {
    ...style,
    ...(width !== undefined && { width: toCss(width) }),
    ...(height !== undefined && { height: toCss(height) }),
  }
  return (
    <div
      ref={ref}
      className={cx('mw-skeleton', `mw-skeleton--${type}`, className)}
      style={customStyle}
      aria-busy="true"
      aria-live="polite"
      {...props}
    />
  )
}
