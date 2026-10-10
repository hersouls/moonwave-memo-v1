import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode, Ref } from 'react'
import { cx } from './cx'

export type TopNavigationScrolling = 'off' | 'on'

export type TopNavigationProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  /** 스크롤 상태예요. on이면 아래에 그림자가 생겨요. 기본은 off예요. */
  scrolling?: TopNavigationScrolling
  /** 왼쪽·가운데·오른쪽 영역을 넣어요. */
  children?: ReactNode
  /** div 요소를 가리키는 ref예요. */
  ref?: Ref<HTMLDivElement>
}

/** 화면 맨 위에 붙는 내비게이션 바예요. 아래 조각들을 조합해 유형을 만들어요. */
export function TopNavigation({ scrolling = 'off', className, children, ref, ...props }: TopNavigationProps) {
  return (
    <div ref={ref} className={cx('mw-top-navigation', `mw-top-navigation--scrolling-${scrolling}`, className)} {...props}>
      {children}
    </div>
  )
}

export type TopNavigationAreaProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  /** 영역에 넣을 버튼, 로고, 제목이에요. */
  children?: ReactNode
  /** div 요소를 가리키는 ref예요. */
  ref?: Ref<HTMLDivElement>
}

/** 왼쪽 영역이에요. 뒤로 가기, 메뉴, 로고를 넣어요. */
export function TopNavigationLeft({ className, children, ref, ...props }: TopNavigationAreaProps) {
  return (
    <div ref={ref} className={cx('mw-top-navigation__left', className)} {...props}>
      {children}
    </div>
  )
}

/** 가운데 영역이에요. 왼쪽·오른쪽에 무엇이 있어도 늘 정가운데에 놓여요. */
export function TopNavigationCenter({ className, children, ref, ...props }: TopNavigationAreaProps) {
  return (
    <div ref={ref} className={cx('mw-top-navigation__center', className)} {...props}>
      {children}
    </div>
  )
}

/** 오른쪽 영역이에요. 아이콘 버튼을 3개까지 넣어요. */
export function TopNavigationRight({ className, children, ref, ...props }: TopNavigationAreaProps) {
  return (
    <div ref={ref} className={cx('mw-top-navigation__right', className)} {...props}>
      {children}
    </div>
  )
}

export type TopNavigationTitleProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  /** 제목 글자예요. 글자 대신 다른 요소를 넣을 수도 있어요. */
  children: ReactNode
  /** div 요소를 가리키는 ref예요. */
  ref?: Ref<HTMLDivElement>
}

/** 제목이에요. 글자를 넣으면 제목 글자 스타일을 알아서 입혀요. */
export function TopNavigationTitle({ className, children, ref, ...props }: TopNavigationTitleProps) {
  return (
    <div ref={ref} className={cx('mw-top-navigation__title', className)} {...props}>
      {typeof children === 'string' ? <span className="mw-top-navigation__title-text">{children}</span> : children}
    </div>
  )
}

export type TopNavigationLogoProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  /** 로고 이미지나 SVG예요. */
  children: ReactNode
  /** button의 type이에요. 기본은 button이에요. */
  type?: 'button' | 'submit' | 'reset'
  /** button 요소를 가리키는 ref예요. */
  ref?: Ref<HTMLButtonElement>
}

/** 누를 수 있는 로고예요. 보통 홈으로 이동해요. */
export function TopNavigationLogo({ className, children, type = 'button', ref, ...props }: TopNavigationLogoProps) {
  return (
    <button ref={ref} type={type} className={cx('mw-top-navigation__logo', className)} {...props}>
      {children}
    </button>
  )
}

export type TopNavigationIconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  /** 보여 줄 아이콘이에요. 24px 아이콘을 넣고 aria-label로 이름을 붙여요. */
  icon: ReactNode
  /** button 요소를 가리키는 ref예요. */
  ref?: Ref<HTMLButtonElement>
}

/** 내비게이션 바에 넣는 44px 아이콘 버튼이에요. */
export function TopNavigationIconButton({ className, icon, ref, ...props }: TopNavigationIconButtonProps) {
  return (
    <button ref={ref} type="button" className={cx('mw-top-navigation__icon-container', className)} {...props}>
      {icon}
    </button>
  )
}
