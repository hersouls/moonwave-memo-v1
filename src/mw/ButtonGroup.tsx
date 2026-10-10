import type { HTMLAttributes, ReactNode, Ref } from 'react'
import { cx } from './cx'

export type ButtonGroupProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  /** 그룹에 넣을 버튼들이에요. 아이콘만 있는 버튼을 빼고 너비를 똑같이 나눠요. */
  children: ReactNode
  /** div 요소를 가리키는 ref예요. */
  ref?: Ref<HTMLDivElement>
}

/**
 * 여러 버튼을 같은 간격으로 묶는 컨테이너예요.
 * 배경과 여백을 빼려면 className에 mw-button-group--transparent를 넣어요.
 */
export function ButtonGroup({ className, children, ref, ...props }: ButtonGroupProps) {
  return (
    <div ref={ref} className={cx('mw-button-group', className)} {...props}>
      {children}
    </div>
  )
}
