/* Moonwave UX — FilterBar (통합 필터 바) · FilterPanel (전체 필터) · FilterEmpty (결과 0건)
   규격: https://ux.moonwave.kr/components/filter-bar · https://ux.moonwave.kr/patterns/data-view */
import { useEffect, useId, useRef } from 'react'
import type { KeyboardEvent, ReactNode, Ref } from 'react'
import { useCloseRequest } from './close'
import { useSheetDrag } from './Sheet'
import { cx } from './cx'
import { Button } from './Button'
import { Checkbox, CheckboxGroup, CheckboxLabel } from './Checkbox'
import { IcLineClose, IcLineSearch, IcMwFilter } from './icons'
import { DATE_PRESETS, describeValue, isEmptyValue, presetRange } from './useDataView'
import type { DataViewState, DateRangeValue, FilterField, FilterValue, RangeValue } from './useDataView'

export type QuickFilter = {
  /** 거르는 열의 키예요. check 필터여야 해요. */
  key: string
  /** 칩에 보이는 말이에요. */
  label: string
  /** 눌렀을 때 켜고 끄는 값이에요. */
  value: string
}

export type FilterBarProps = {
  fields: FilterField[]
  state: DataViewState
  /** 자주 쓰는 필터예요. 2~4개를 왼쪽에 늘 보여요. */
  quick?: QuickFilter[]
  onQuery: (q: string) => void
  onFilter: (key: string, value: FilterValue | undefined) => void
  /** 칩 하나를 지울 때예요. */
  onRemove: (key: string) => void
  /** 필드의 X를 눌러 검색어와 필터를 모두 지울 때예요. */
  onClear: () => void
  /** 칩을 눌러 값을 고칠 때예요. 보통 전체 필터 패널을 그 필드에 맞춰 열어요. */
  onEdit: (key: string) => void
  /** "전체 필터" 버튼를 눌렀을 때예요. */
  onOpenAll: () => void
  /** 전체 필터 패널이 열려 있는지예요. */
  allOpen?: boolean
  /** 전체 필터 패널의 id예요. 버튼의 aria-controls가 돼요. */
  allControls?: string
  /** 검색 입력의 안내 글이에요. 무엇을 찾는지 말해요(`이름 · 메모 검색`). */
  placeholder?: string
  /** 이 도구가 무엇을 거르는지 말해요(`여행 거르기`). 화면 읽기 프로그램이 읽어요. */
  label?: string
  /** 검색 입력을 가리키는 ref예요. */
  inputRef?: Ref<HTMLInputElement>
}

const typing = (t: EventTarget | null) => {
  const el = t as HTMLElement | null
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))
}

/**
 * 하나의 필드 안에 적용한 필터 칩, 검색 입력, 모두 지우기가 들어 있어요. 왼쪽에는 자주 쓰는 필터가 늘 서 있고, 나머지는 "전체 필터"로 가요.
 * 칩은 "필드: 값"이에요. 누르면 값을 고치고, X로 하나씩 풀어요. 칩에서 Delete · Backspace로도 풀리고, 입력이 비었을 때 Backspace는 마지막 칩을 풀어요.
 * `/` 는 검색으로 가요(입력 중에는 그냥 글자예요).
 */
export function FilterBar({
  fields, state, quick = [], onQuery, onFilter, onRemove, onClear, onEdit, onOpenAll, allOpen = false, allControls,
  placeholder = '검색', label = '거르기', inputRef,
}: FilterBarProps) {
  const own = useRef<HTMLInputElement | null>(null)
  const chips = useRef<HTMLUListElement>(null)
  const setRef = (el: HTMLInputElement | null) => {
    own.current = el
    if (typeof inputRef === 'function') inputRef(el)
    else if (inputRef) (inputRef as { current: HTMLInputElement | null }).current = el
  }
  useEffect(() => {
    const on = (e: globalThis.KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return
      e.preventDefault()
      own.current?.focus()
    }
    document.addEventListener('keydown', on)
    return () => document.removeEventListener('keydown', on)
  }, [])

  const active = fields.filter((f) => !isEmptyValue(state.filters[f.key]))
  const total = active.length
  const hasAny = total > 0 || state.q.length > 0

  // 칩 사이를 방향키로 오가고, 지운 뒤에는 이웃 칩이나 입력으로 포커스를 옮겨요
  const focusAfterRemove = (index: number) => {
    requestAnimationFrame(() => {
      const edits = chips.current?.querySelectorAll<HTMLButtonElement>('.mw-filter-bar__chip-edit')
      if (edits && edits.length) edits[Math.min(index, edits.length - 1)].focus()
      else own.current?.focus()
    })
  }
  const chipKey = (e: KeyboardEvent<HTMLButtonElement>, key: string, index: number) => {
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); onRemove(key); focusAfterRemove(index) }
    const edits = [...(chips.current?.querySelectorAll<HTMLButtonElement>('.mw-filter-bar__chip-edit') ?? [])]
    if (e.key === 'ArrowRight' && index < edits.length - 1) { e.preventDefault(); edits[index + 1].focus() }
    if (e.key === 'ArrowLeft' && index > 0) { e.preventDefault(); edits[index - 1].focus() }
    if (e.key === 'ArrowRight' && index === edits.length - 1) { e.preventDefault(); own.current?.focus() }
  }
  const inputKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && state.q === '' && active.length) { e.preventDefault(); onRemove(active[active.length - 1].key) }
    if (e.key === 'Escape' && state.q) { e.preventDefault(); e.stopPropagation(); onQuery('') }
    if (e.key === 'ArrowLeft' && e.currentTarget.selectionStart === 0 && active.length) {
      const edits = chips.current?.querySelectorAll<HTMLButtonElement>('.mw-filter-bar__chip-edit')
      if (edits?.length) { e.preventDefault(); edits[edits.length - 1].focus() }
    }
  }

  return (
    <div className="mw-filter-bar" role="search" aria-label={label}>
      {quick.length > 0 && (
        <div className="mw-filter-bar__quick" role="group" aria-label="자주 쓰는 필터">
          {quick.map((q) => {
            const cur = (state.filters[q.key] as string[] | undefined) ?? []
            const on = cur.includes(q.value)
            return (
              <button
                key={`${q.key}:${q.value}`}
                type="button"
                className={cx('mw-select-chip', on ? 'mw-select-chip--on' : 'mw-select-chip--off')}
                aria-pressed={on}
                onClick={() => onFilter(q.key, on ? cur.filter((v) => v !== q.value) : [...cur, q.value])}
              >
                {q.label}
              </button>
            )
          })}
        </div>
      )}

      <div className="mw-filter-bar__field" onClick={(e) => { if (e.target === e.currentTarget) own.current?.focus() }}>
        <span className="mw-filter-bar__icon"><IcLineSearch /></span>
        <ul className="mw-filter-bar__chips" ref={chips} aria-label="적용한 필터">
          {active.map((f, i) => (
            <li key={f.key} className="mw-filter-bar__chip">
              <button
                type="button"
                className="mw-filter-bar__chip-edit"
                aria-label={`${f.label}: ${describeValue(f, state.filters[f.key])}. 눌러서 고쳐요. Delete로 풀어요`}
                onClick={() => onEdit(f.key)}
                onKeyDown={(e) => chipKey(e, f.key, i)}
              >
                <b>{f.label}:</b>
                <span>{describeValue(f, state.filters[f.key])}</span>
              </button>
              <button
                type="button"
                className="mw-filter-bar__chip-remove"
                aria-label={`${f.label} 필터 풀기`}
                onClick={() => { onRemove(f.key); focusAfterRemove(i) }}
              >
                <IcLineClose width={16} height={16} />
              </button>
            </li>
          ))}
        </ul>
        <input
          ref={setRef}
          className="mw-filter-bar__input"
          type="search"
          value={state.q}
          placeholder={placeholder}
          aria-label={placeholder}
          aria-keyshortcuts="/"
          autoComplete="off"
          enterKeyHint="search"
          onChange={(e) => onQuery(e.target.value)}
          onKeyDown={inputKey}
        />
        <kbd className="mw-filter-bar__key" aria-hidden="true">/</kbd>
        <button type="button" className="mw-filter-bar__clear" aria-label="검색어와 필터 모두 지우기" hidden={!hasAny} onClick={() => { onClear(); own.current?.focus() }}>
          <IcLineClose />
        </button>
      </div>

      <button
        type="button"
        className="mw-filter-bar__all"
        aria-haspopup="dialog"
        aria-expanded={allOpen}
        aria-controls={allControls}
        onClick={onOpenAll}
      >
        <IcMwFilter />
        전체 필터
        <span className="mw-filter-bar__count" hidden={total === 0} aria-label={`${total}개 적용 중`}>{total}</span>
      </button>
    </div>
  )
}

// ───────────────────────── 전체 필터 패널 ─────────────────────────

export type FilterPanelProps = {
  open: boolean
  onClose: () => void
  fields: FilterField[]
  state: DataViewState
  onFilter: (key: string, value: FilterValue | undefined) => void
  onClear: () => void
  /** 지금 조건으로 남는 개수예요. "결과 n건 보기"에 써요. */
  resultCount: number
  /** 열릴 때 포커스를 줄 필드예요(칩을 눌러 열었을 때). */
  focusKey?: string | null
  /** 패널의 id예요. "전체 필터" 버튼의 aria-controls와 같게 해요. */
  id: string
  title?: string
}

const num = (s: string): number | undefined => (s.trim() === '' || Number.isNaN(Number(s)) ? undefined : Number(s))

/**
 * 전체 필터예요. 601px부터는 오른쪽 서랍(앱 셸의 패널)이고, 600px 이하에서는 아래에서 올라오는 시트예요(키트의 CSS가 해요).
 * 고르는 즉시 목록에 반영돼요. 닫는 버튼가 "결과 n건 보기"라서 눌러야 적용되는 일이 없어요.
 */
export function FilterPanel({ open, onClose, fields, state, onFilter, onClear, resultCount, focusKey, id, title = '전체 필터' }: FilterPanelProps) {
  const panel = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useCloseRequest(open, onClose)
  useSheetDrag(panel, open, onClose, () => matchMedia('(max-width: 600px)').matches)
  useEffect(() => {
    if (!open) return
    const target = focusKey ? panel.current?.querySelector<HTMLElement>(`[data-field="${focusKey}"] input, [data-field="${focusKey}"] select`) : null
    ;(target ?? panel.current?.querySelector<HTMLElement>('input, select'))?.focus()
  }, [open, focusKey])

  return (
    <>
      <button type="button" className={cx('mw-app-panel-scrim', open && 'mw-app-panel-scrim--on')} aria-label="패널 닫기" tabIndex={-1} onClick={onClose} />
      <div ref={panel} id={id} className={cx('mw-app-panel', open && 'mw-app-panel--open')} role="dialog" aria-modal="false" aria-labelledby={titleId} inert={!open}>
        <div className="mw-app-panel__head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="mw-filter-bar__clear" aria-label="닫기" onClick={onClose}><IcLineClose /></button>
        </div>
        <div className="mw-app-panel__body">
          {fields.map((f) => (
            <FilterGroup key={f.key} field={f} value={state.filters[f.key]} onChange={(v) => onFilter(f.key, v)} />
          ))}
        </div>
        <div className="mw-app-panel__foot">
          <Button variant="tertiary" size="medium" onClick={onClear} disabled={!Object.values(state.filters).some((v) => !isEmptyValue(v))}>모두 지우기</Button>
          <Button variant="primary" size="medium" onClick={onClose}>{resultCount === 0 ? '결과가 없어요' : `결과 ${resultCount.toLocaleString('ko-KR')}건 보기`}</Button>
        </div>
      </div>
    </>
  )
}

function FilterGroup({ field, value, onChange }: { field: FilterField; value: FilterValue | undefined; onChange: (v: FilterValue | undefined) => void }) {
  const uid = useId()
  const body = (): ReactNode => {
    if (field.type === 'text') {
      return (
        <label className="mw-filter-group__field">
          <span>{field.label} 포함</span>
          <input
            className="mw-filter-group__input"
            type="text"
            placeholder="포함하는 글"
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value || undefined)}
          />
        </label>
      )
    }
    if (field.type === 'check') {
      const cur = Array.isArray(value) ? value : []
      return (
        <div className="mw-filter-group__list">
          {field.options?.map((o) => (
            <CheckboxGroup key={o.value} value={o.value} htmlFor={`${uid}-${o.value}`}>
              <Checkbox id={`${uid}-${o.value}`} value={o.value} aria-label={o.label} checked={cur.includes(o.value)} onChange={(e) => onChange(e.target.checked ? [...cur, o.value] : cur.filter((x) => x !== o.value))} />
              <CheckboxLabel htmlFor={`${uid}-${o.value}`}>{o.label}</CheckboxLabel>
            </CheckboxGroup>
          ))}
        </div>
      )
    }
    if (field.type === 'number') {
      const r = (value ?? {}) as RangeValue
      const set = (patch: RangeValue) => onChange({ ...r, ...patch })
      return (
        <div className="mw-filter-group__range">
          <label className="mw-filter-group__field"><span>최소</span><input className="mw-filter-group__input" type="number" inputMode="numeric" value={r.min ?? ''} onChange={(e) => set({ min: num(e.target.value) })} /></label>
          <span aria-hidden="true">~</span>
          <label className="mw-filter-group__field"><span>최대</span><input className="mw-filter-group__input" type="number" inputMode="numeric" value={r.max ?? ''} onChange={(e) => set({ max: num(e.target.value) })} /></label>
        </div>
      )
    }
    const d = (value ?? {}) as DateRangeValue
    return (
      <>
        <div className="mw-filter-group__presets" role="group" aria-label="기간 바로 고르기">
          {DATE_PRESETS.map((p) => {
            const range = presetRange(p.id)
            const on = d.from === range.from && d.to === range.to
            return (
              <button key={p.id} type="button" className={cx('mw-select-chip', on ? 'mw-select-chip--on' : 'mw-select-chip--off')} aria-pressed={on} onClick={() => onChange(on ? undefined : range)}>
                {p.label}
              </button>
            )
          })}
        </div>
        <div className="mw-filter-group__range">
          <label className="mw-filter-group__field"><span>시작</span><input className="mw-filter-group__input" type="date" value={d.from ?? ''} onChange={(e) => onChange({ ...d, from: e.target.value || undefined })} /></label>
          <span aria-hidden="true">~</span>
          <label className="mw-filter-group__field"><span>끝</span><input className="mw-filter-group__input" type="date" value={d.to ?? ''} onChange={(e) => onChange({ ...d, to: e.target.value || undefined })} /></label>
        </div>
      </>
    )
  }
  const grouped = field.type === 'text' || field.type === 'number' || field.type === 'date' || field.type === 'check'
  return (
    <fieldset className="mw-filter-group" data-field={field.key} aria-describedby={grouped ? undefined : uid}>
      <legend className="mw-filter-group__legend">{field.label}</legend>
      {body()}
    </fieldset>
  )
}

// ───────────────────────── 결과 0건 ─────────────────────────

export type FilterEmptyProps = {
  /** 적용 중인 필터 개수예요(검색어 포함). */
  count: number
  onRemoveLast: () => void
  onClear: () => void
}

/** 거른 결과가 0건일 때예요. 몇 개가 걸려 있는지 말하고, 마지막 필터만 풀거나 모두 지우게 해요. */
export function FilterEmpty({ count, onRemoveLast, onClear }: FilterEmptyProps) {
  return (
    <div className="mw-filter-empty" role="status">
      <p className="mw-filter-empty__title">조건에 맞는 항목이 없어요</p>
      <p className="mw-filter-empty__body">필터 {count}개 적용 중이에요.</p>
      <div className="mw-filter-empty__actions">
        {count > 1 && <Button variant="secondary" size="medium" onClick={onRemoveLast}>마지막 필터 풀기</Button>}
        <Button variant={count > 1 ? 'tertiary' : 'secondary'} size="medium" onClick={onClear}>{count > 1 ? '모두 지우기' : '필터 풀기'}</Button>
      </div>
    </div>
  )
}
