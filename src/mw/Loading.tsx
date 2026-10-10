/* Moonwave UX — Loading */
import type { HTMLAttributes, Ref } from 'react'
import { cx } from './cx'

export type LoadingSize = 'small' | 'medium' | 'large'

export type LoadingProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  /** 스피너 지름이에요. small 28px · medium 40px · large 56px. */
  size?: LoadingSize
  /** 스크린 리더가 읽는 로딩 설명이에요. */
  'aria-label'?: string
  /** 스피너 요소를 가리켜요. */
  ref?: Ref<HTMLDivElement>
}

/** 링 색이에요. 테마에 따라 바뀌는 토큰을 써요. */
const RING = 'var(--loading-fill-default-fill)'

/**
 * 돌아가는 원형 스피너예요.
 * 링은 이미지 파일 대신 인라인 SVG로 그려서 추가 자산 없이 쓰고, 테마 색을 그대로 따라요.
 */
export function Loading({ size = 'medium', className, 'aria-label': ariaLabel = '로딩 중', ref, ...props }: LoadingProps) {
  return (
    <div ref={ref} className={cx('mw-loading', `mw-loading--${size}`, className)} role="status" aria-label={ariaLabel} {...props}>
      <svg
        viewBox="0 0 40 40"
        width="100%"
        height="100%"
        fill="none"
        stroke={RING}
        strokeWidth="4"
        aria-hidden="true"
        focusable="false"
        style={{ display: 'block' }}
      >
        <path d="M38 20a18 18 0 0 1-18 18" strokeOpacity="0.15" />
        <path d="M20 38a18 18 0 0 1-18-18" strokeOpacity="0.4" />
        <path d="M2 20a18 18 0 0 1 18-18" strokeOpacity="0.7" />
        <path d="M20 2a18 18 0 0 1 18 18" />
        <circle cx="38" cy="20" r="2" fill={RING} stroke="none" />
      </svg>
    </div>
  )
}
