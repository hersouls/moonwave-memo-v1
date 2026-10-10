import { Children, isValidElement } from 'react'
import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'
import { cx } from './cx'

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'tertiary-subtle' | 'tertiary-subtle-filled' | 'accent-primary'
export type ButtonSize = 'small' | 'medium' | 'large'

export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  /** 버튼의 위계예요. 기본은 primary예요. tertiary-subtle은 윤곽이 옅은 Tertiary, tertiary-subtle-filled는 거기에 흰 바탕을 채운 것이에요. */
  variant?: ButtonVariant
  /** 버튼 크기예요. 기본은 medium이에요. */
  size?: ButtonSize
  /** 레이블이에요. 아이콘을 레이블 앞이나 뒤에 넣거나 아이콘만 넣을 수 있어요. */
  children: ReactNode
  /** button 요소를 가리키는 ref예요. */
  ref?: Ref<HTMLButtonElement>
}

/**
 * 자식이 아이콘인지 알아봐요.
 * svg 요소, viewBox가 있는 요소, 이름이 Ic로 시작하는 컴포넌트를 아이콘으로 봐요.
 * 빌드에서 이름이 줄어도 ./icons의 아이콘을 알아보도록, children 없이 쓴 함수 컴포넌트도 아이콘으로 봐요.
 */
function isIcon(child: ReactNode): boolean {
  if (!isValidElement(child)) return false
  if (child.type === 'svg') return true
  const props: unknown = child.props
  if (typeof props !== 'object' || props === null) return false
  if ('viewBox' in props) return true
  if (typeof child.type !== 'function') return false
  const type = child.type as { displayName?: string; name?: string }
  const name = type.displayName || type.name || ''
  return name.startsWith('Ic') || !('children' in props)
}

/** 사용자가 할 일을 실행하는 버튼이에요. 아이콘 위치는 children을 보고 알아서 맞춰요. */
export function Button({ variant = 'primary', size = 'medium', className, children, ref, ...props }: ButtonProps) {
  const childArray = Children.toArray(children)
  const firstChild = childArray[0]
  const lastChild = childArray[childArray.length - 1]

  const isIconOnly = childArray.length === 1 && isIcon(firstChild)
  const hasIconLeft = !isIconOnly && childArray.length > 1 && isIcon(firstChild)
  const hasIconRight = !isIconOnly && childArray.length > 1 && isIcon(lastChild) && !isIcon(firstChild)

  return (
    <button
      ref={ref}
      className={cx(
        'mw-button',
        `mw-button--${variant}`,
        `mw-button--${size}`,
        isIconOnly && 'mw-button--icon-only',
        hasIconLeft && 'mw-button--icon-left',
        hasIconRight && 'mw-button--icon-right',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
