/* Moonwave UX — Facts · Fact (이름-값 줄)
   규격: https://ux.moonwave.kr/components/facts */
import type { HTMLAttributes, ReactNode } from 'react'
import { cx } from './cx'

/**
 * 이름과 값의 짝을 한 줄에 하나씩 늘어놓는 정의 목록(`dl`)이에요. 읽기만 하는 짝이에요:
 * 누르거나 바꾸는 줄은 List · Settings, 여러 값을 견주면 Table이에요.
 */
export function Facts({ layout = 'split', lined = false, className, children, ...props }: HTMLAttributes<HTMLDListElement> & {
  /** `split`은 값이 줄의 오른쪽 끝(숫자 · 짧은 값), `column`은 이름 칸 다음에 왼쪽 정렬(주소 · 문장)이에요. */
  layout?: 'split' | 'column'
  /** 줄 사이에 선을 그어요. 줄이 다섯 개를 넘거나 금액을 견줄 때예요. */
  lined?: boolean
  children: ReactNode
}) {
  return (
    <dl className={cx('mw-facts', layout === 'column' && 'mw-facts--column', lined && 'mw-facts--lined', className)} {...props}>
      {children}
    </dl>
  )
}

/** 한 줄이에요. `name`은 짧은 명사예요. 값이 없으면 비워 두지 않고 `해당 없음` · `확인 전`처럼 말로 써요. */
export function Fact({ name, lead = false, className, children, ...props }: HTMLAttributes<HTMLDivElement> & {
  name: ReactNode
  /** 묶음의 대표 값이에요. 크게 굵게 보여 줘요. 한 묶음에 하나예요. */
  lead?: boolean
  children: ReactNode
}) {
  return (
    <div className={cx('mw-facts__row', lead && 'mw-facts__row--lead', className)} {...props}>
      <dt className="mw-facts__name">{name}</dt>
      <dd className="mw-facts__value">{children}</dd>
    </div>
  )
}
