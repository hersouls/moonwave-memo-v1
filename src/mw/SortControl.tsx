/* Moonwave UX — SortControl (정렬) · ViewMenu (뷰 저장 · 불러오기) · SortHeaderState (표 머리글)
   규격: https://ux.moonwave.kr/components/sort-control · https://ux.moonwave.kr/patterns/data-view */
import { useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { cx } from './cx'
import { Button } from './Button'
import { IcLineClose, IcMwArrowDown, IcMwBookmark, IcMwSort } from './icons'
import { MAX_SORT } from './useDataView'
import type { SavedView, SortDir, SortKey } from './useDataView'

export type SortOption = { key: string; label: string }

const DIR_WORD: Record<SortDir, string> = { asc: '오름차순', desc: '내림차순' }

/** 지금 정렬을 글로 말해요: `상태 오름차순 → 날짜 내림차순`. 정렬이 없으면 빈 글이에요. */
export function sortSummary(sort: SortKey[], options: SortOption[]): string {
  return sort
    .map((s) => `${options.find((o) => o.key === s.key)?.label ?? s.key} ${DIR_WORD[s.dir]}`)
    .join(' → ')
}

/** 표의 열 머리글에 붙일 aria-sort 값이에요. `<th aria-sort={ariaSort(sort, 'date')}>` */
export function ariaSort(sort: SortKey[], key: string): 'ascending' | 'descending' | 'none' {
  const s = sort[0]?.key === key ? sort[0] : sort.find((x) => x.key === key)
  return !s ? 'none' : s.dir === 'asc' ? 'ascending' : 'descending'
}

/** 열고 닫는 작은 메뉴의 공통 동작이에요: 바깥을 누르면, Esc를 누르면 닫히고 포커스가 버튼로 돌아와요. */
function usePopover() {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const id = useId()
  useEffect(() => {
    if (!open) return
    const out = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false) }
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      setOpen(false)
      root.current?.querySelector<HTMLElement>('[aria-haspopup]')?.focus()
    }
    document.addEventListener('pointerdown', out)
    document.addEventListener('keydown', key, true)
    return () => { document.removeEventListener('pointerdown', out); document.removeEventListener('keydown', key, true) }
  }, [open])
  return { open, setOpen, root, id }
}

export type SortControlProps = {
  options: SortOption[]
  sort: SortKey[]
  onChange: (sort: SortKey[]) => void
  /** 정렬을 글로 보여 줄 곳의 id예요(`mw-data-toolbar__status`). 버튼가 가리켜요. */
  statusId?: string
}

/**
 * 카드와 목록의 정렬이에요(표는 열 머리글을 눌러요). 버튼는 1순위 기준을 말하고, 옆의 토글이 오름·내림을 바꿔요.
 * 버튼를 열면 1순위와 2순위를 고르는 메뉴가 떠요. 2순위는 1순위가 같은 것들 안에서만 일해요.
 */
export function SortControl({ options, sort, onChange, statusId }: SortControlProps) {
  const { open, setOpen, root, id } = usePopover()
  const first = sort[0]
  const firstLabel = options.find((o) => o.key === first?.key)?.label
  const setLevel = (level: number, key: string, dir?: SortDir) => {
    const next = [...sort]
    if (key === '') next.splice(level)
    else {
      next[level] = { key, dir: dir ?? next[level]?.dir ?? 'asc' }
      // 같은 기준을 두 번 쓰지 않아요
      for (let i = 0; i < next.length; i++) if (i !== level && next[i].key === key) next.splice(i, 1)
    }
    onChange(next.filter(Boolean).slice(0, MAX_SORT))
  }
  const flip = (level: number) => {
    const s = sort[level]
    if (s) setLevel(level, s.key, s.dir === 'asc' ? 'desc' : 'asc')
  }

  return (
    <div className="mw-sort-control" ref={root}>
      <button
        type="button"
        className="mw-sort-control__trigger"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={id}
        aria-describedby={statusId}
        onClick={() => setOpen(!open)}
      >
        <IcMwSort />
        정렬 기준 {firstLabel && <b>{firstLabel}</b>}
      </button>
      <button
        type="button"
        className="mw-sort-control__dir"
        data-dir={first?.dir ?? 'desc'}
        aria-label={first ? `${DIR_WORD[first.dir]}. 눌러서 ${DIR_WORD[first.dir === 'asc' ? 'desc' : 'asc']}으로 바꿔요` : '정렬 기준을 먼저 골라요'}
        disabled={!first}
        onClick={() => flip(0)}
      >
        <IcMwArrowDown />
      </button>
      <div className="mw-data-menu" id={id} role="group" aria-label="정렬 순서" hidden={!open}>
        {[0, 1].map((level) => {
          const cur = sort[level]
          return (
            <div key={level}>
              <p className="mw-data-menu__title">{level === 0 ? '1순위' : '2순위 (1순위가 같을 때)'}</p>
              <div className="mw-data-menu__row">
                <select
                  className="mw-data-menu__select"
                  aria-label={level === 0 ? '1순위 기준' : '2순위 기준'}
                  value={cur?.key ?? ''}
                  disabled={level === 1 && !first}
                  onChange={(e) => setLevel(level, e.target.value)}
                >
                  <option value="">{level === 0 ? '정렬 없음' : '없음'}</option>
                  {options.filter((o) => level === 0 || o.key !== first?.key).map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                </select>
                <button
                  type="button"
                  className="mw-sort-control__dir"
                  data-dir={cur?.dir ?? 'desc'}
                  aria-label={cur ? `${level + 1}순위 ${DIR_WORD[cur.dir]}. 눌러서 바꿔요` : `${level + 1}순위 방향`}
                  disabled={!cur}
                  onClick={() => flip(level)}
                >
                  <IcMwArrowDown />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export type ViewMenuProps = {
  views: SavedView[]
  /** 지금 상태와 같은 뷰의 id예요. 있으면 체크 표시를 해요. */
  currentId?: string | null
  onApply: (id: string) => void
  onDelete: (id: string) => void
  /** 이름을 붙여 지금 상태를 저장해요. */
  onSave: (name: string) => void
  /** 저장할 것이 있는지예요(필터나 정렬이 하나라도 있을 때). */
  canSave?: boolean
}

/** 필터 + 정렬 + 보기 방식의 조합에 이름을 붙여 저장하고, 툴바에서 불러와요. */
export function ViewMenu({ views, currentId, onApply, onDelete, onSave, canSave = true }: ViewMenuProps) {
  const { open, setOpen, root, id } = usePopover()
  const [name, setName] = useState('')
  const [naming, setNaming] = useState(false)
  const field = useRef<HTMLInputElement>(null)
  useEffect(() => { if (naming) field.current?.focus() }, [naming])
  useEffect(() => { if (!open) { setNaming(false); setName('') } }, [open])

  return (
    <div className="mw-view-menu" ref={root}>
      <button type="button" className="mw-view-menu__trigger" aria-haspopup="true" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        <IcMwBookmark />
        뷰{views.length > 0 && <span className="mw-filter-bar__count">{views.length}</span>}
      </button>
      <div className="mw-data-menu" id={id} role="group" aria-label="저장한 뷰" hidden={!open}>
        <p className="mw-data-menu__title">저장한 뷰</p>
        {views.length === 0
          ? <p className="mw-data-menu__hint">아직 저장한 뷰가 없어요. 필터와 정렬을 맞춰 두고 저장해요.</p>
          : (
            <ul className="mw-data-menu__list">
              {views.map((v) => (
                <li key={v.id} className="mw-data-menu__entry">
                  <button
                    type="button"
                    className="mw-data-menu__item"
                    aria-pressed={currentId === v.id}
                    onClick={() => { onApply(v.id); setOpen(false) }}
                  >
                    <span className="mw-data-menu__item-label">{v.name}</span>
                  </button>
                  <button type="button" className="mw-row-expand" aria-label={`${v.name} 뷰 지우기`} onClick={() => onDelete(v.id)}>
                    <IcLineClose />
                  </button>
                </li>
              ))}
            </ul>
          )}
        <div className="mw-data-menu__foot">
          {naming
            ? (
              <form
                className="mw-data-menu__row"
                onSubmit={(e) => { e.preventDefault(); if (name.trim()) { onSave(name.trim()); setOpen(false) } }}
              >
                <input ref={field} className="mw-data-menu__select" aria-label="뷰 이름" placeholder="뷰 이름 (예: 이번 달 진행 중)" maxLength={30} value={name} onChange={(e) => setName(e.target.value)} />
                <Button variant="primary" size="medium" type="submit" disabled={!name.trim()}>저장하기</Button>
              </form>
            )
            : <Button variant="tertiary" size="medium" disabled={!canSave} onClick={() => setNaming(true)}>현재 상태 저장</Button>}
        </div>
      </div>
    </div>
  )
}

/** 툴바 아래에 지금 정렬을 글로 말해요. 화면 읽기 프로그램에는 바뀔 때 알려요. */
export function SortStatus({ id, sort, options, children }: { id: string; sort: SortKey[]; options: SortOption[]; children?: ReactNode }) {
  const text = sortSummary(sort, options)
  return (
    <p id={id} className={cx('mw-data-toolbar__status')} aria-live="polite">
      {text ? <>정렬: <b>{text}</b></> : '정렬: 기본 순서'}
      {children}
    </p>
  )
}
