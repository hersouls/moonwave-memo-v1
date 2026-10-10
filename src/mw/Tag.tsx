import type { HTMLAttributes, ReactNode, Ref } from 'react'
import { cx } from './cx'

export type TagSize = 'small' | 'medium' | 'large'
export type TagCategoryType = 'basic' | 'hot' | 'new' | 'recommand' | 'sale'
export type TagStatusType = 'critical' | 'default' | 'disabled' | 'info' | 'progress' | 'success' | 'warning'

export type TagCategoryProps = Omit<HTMLAttributes<HTMLSpanElement>, 'children'> & {
  /** 카테고리 색이에요. 기본은 basic이에요. */
  type?: TagCategoryType
  /** 태그 크기예요. large 24px, medium 20px, small 18px이고 기본은 medium이에요. */
  size?: TagSize
  /** 태그에 넣을 짧은 레이블이에요. */
  children: ReactNode
  /** span 요소를 가리키는 ref예요. */
  ref?: Ref<HTMLSpanElement>
}

/** 카테고리나 속성처럼 정보의 성격을 나누는 태그예요. */
export function TagCategory({ type = 'basic', size = 'medium', className, children, ref, ...props }: TagCategoryProps) {
  return (
    <span
      ref={ref}
      className={cx('mw-tag', 'mw-tag--category', `mw-tag--category-${type}`, `mw-tag--${size}`, className)}
      {...props}
    >
      {children}
    </span>
  )
}

export type TagStatusProps = Omit<HTMLAttributes<HTMLSpanElement>, 'children'> & {
  /** 상태의 뜻이에요. 뜻에 맞는 색이 정해져요. 기본은 default예요. */
  type?: TagStatusType
  /** 태그 크기예요. large 24px, medium 20px, small 18px이고 기본은 medium이에요. */
  size?: TagSize
  /** 태그에 넣을 짧은 레이블이에요. */
  children: ReactNode
  /** span 요소를 가리키는 ref예요. */
  ref?: Ref<HTMLSpanElement>
}

/** 정상·진행 중·주의·오류 같은 상태를 알리는 태그예요. */
export function TagStatus({ type = 'default', size = 'medium', className, children, ref, ...props }: TagStatusProps) {
  return (
    <span
      ref={ref}
      className={cx('mw-tag', 'mw-tag--status', `mw-tag--status-${type}`, `mw-tag--${size}`, className)}
      {...props}
    >
      {children}
    </span>
  )
}

/** Tag.Category, Tag.Status로 골라 쓰는 묶음이에요. */
export const Tag = {
  /** 정보의 성격을 나누는 태그예요. */
  Category: TagCategory,
  /** 상태를 알리는 태그예요. */
  Status: TagStatus,
}
