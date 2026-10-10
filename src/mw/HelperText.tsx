import type { HTMLAttributes, ReactNode, Ref } from 'react'
import { cx } from './cx'

export type HelperTextType = 'default' | 'error' | 'success' | 'info'

export type HelperTextProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  /** 안내문의 종류예요. 종류에 따라 글자색이 달라져요. 기본은 default예요. */
  type?: HelperTextType
  /** 안내문 내용이에요. 한 줄을 넘기지 않게 써요. */
  children: ReactNode
  /** div 요소를 가리키는 ref예요. */
  ref?: Ref<HTMLDivElement>
}

/** Text Field와 Text Area 아래에 붙는 안내문이에요. 도움말, 오류, 성공, 정보 네 가지로 써요. */
export function HelperText({ type = 'default', className, children, ref, ...props }: HelperTextProps) {
  return (
    <div ref={ref} className={cx('mw-helper-text', `mw-helper-text--${type}`, className)} {...props}>
      {children}
    </div>
  )
}
