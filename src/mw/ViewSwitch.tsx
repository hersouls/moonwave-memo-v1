/* Moonwave UX — ViewSwitch (보기 방식: 표 · 카드 · 그리드)
   규격: https://ux.moonwave.kr/patterns/data-view#views */
import { useRef } from 'react'
import type { KeyboardEvent } from 'react'
import { cx } from './cx'
import { IcMwCard, IcMwGrid, IcMwList, IcMwTable } from './icons'

/** 보기 방식이에요. 표 · 카드 · 그리드가 기본이고, 목록은 넷째로 더할 수 있어요. */
export type ViewKind = 'table' | 'card' | 'grid' | 'list'

/** 데이터 뷰가 늘 주는 세 가지 보기예요. 이 순서로 놓아요. */
export const DEFAULT_VIEWS: ViewKind[] = ['table', 'card', 'grid']

/** 칩에 쓰는 이름이에요. 아이콘이 있어도 글자는 늘 보여요. */
export const VIEW_LABEL: Record<ViewKind, string> = { table: '표', card: '카드', grid: '그리드', list: '목록' }

const ICON = { table: IcMwTable, card: IcMwCard, grid: IcMwGrid, list: IcMwList }

export type ViewSwitchProps = {
  /** 지금 보기예요. `useDataView`의 `state.view`를 넘겨요. */
  value: ViewKind
  /** 다른 보기를 고르면 불러요. `useDataView`의 `setView`를 넘겨요. */
  onChange: (view: ViewKind) => void
  /** 줄 보기예요. 기본은 표 · 카드 · 그리드예요. 목록을 더할 때만 `[...DEFAULT_VIEWS, 'list']`를 넘겨요. */
  views?: ViewKind[]
  /** 묶음의 이름이에요. 기본은 `보기 방식`이에요. */
  label?: string
  className?: string
}

/**
 * 같은 항목을 표 · 카드 · 그리드로 바꿔 보는 Select 칩 묶음이에요. 고른 칩은 하나이고, 화살표 키로 옮기면 바로 바뀌어요.
 * 표는 Data Table, 카드는 Item Tile 카드(`mw-item-tile--card`, `mw-item-tile-grid--3`), 그리드는 Item Tile(`mw-item-tile-grid--4`)로 그려요.
 */
export function ViewSwitch({ value, onChange, views = DEFAULT_VIEWS, label = '보기 방식', className }: ViewSwitchProps) {
  const group = useRef<HTMLDivElement>(null)
  const move = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!step) return
    e.preventDefault()
    const i = Math.max(0, views.indexOf(value))
    const next = views[(i + step + views.length) % views.length]
    onChange(next)
    group.current?.querySelector<HTMLButtonElement>(`[data-view="${next}"]`)?.focus()
  }
  return (
    <div ref={group} className={cx('mw-chip-group mw-view-switch', className)} role="radiogroup" aria-label={label} onKeyDown={move}>
      {views.map((v) => {
        const Icon = ICON[v]
        const on = v === value
        return (
          <button key={v} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1} data-view={v}
            className={cx('mw-select-chip', on ? 'mw-select-chip--on' : 'mw-select-chip--off')} onClick={() => onChange(v)}>
            <Icon size={16} />{VIEW_LABEL[v]}
          </button>
        )
      })}
    </div>
  )
}
