/* Moonwave UX — 데이터 뷰 상태 (거르기 · 정렬 · 보기 방식 · 저장한 뷰)
   규격: https://ux.moonwave.kr/patterns/data-view */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export type FilterType = 'text' | 'check' | 'number' | 'date'
export type FilterOption = { value: string; label: string }
export type FilterField = {
  key: string
  /** 칩과 패널에 보이는 이름이에요. */
  label: string
  type: FilterType
  /** check 필터의 선택지예요. */
  options?: FilterOption[]
  /** number 필터의 단위예요(`원`, `kg`). 칩에 붙어요. */
  unit?: string
}
export type RangeValue = { min?: number; max?: number }
export type DateRangeValue = { from?: string; to?: string }
export type FilterValue = string | string[] | RangeValue | DateRangeValue
export type SortDir = 'asc' | 'desc'
export type SortKey = { key: string; dir: SortDir }
export type DataViewState = {
  /** 검색어예요. */
  q: string
  filters: Record<string, FilterValue>
  /** 1순위, 2순위 순서예요. 2개까지 써요. */
  sort: SortKey[]
  /** 보기 방식이에요(`table` · `card` · `list`). */
  view: string
}

export const MAX_SORT = 2

export const emptyState = (view = 'table'): DataViewState => ({ q: '', filters: {}, sort: [], view })

// ── 값이 비었는지, 칩에 무엇이라고 쓸지 ──

export function isEmptyValue(v: FilterValue | undefined): boolean {
  if (v === undefined) return true
  if (typeof v === 'string') return v.trim() === ''
  if (Array.isArray(v)) return v.length === 0
  const o = v as RangeValue & DateRangeValue
  return o.min === undefined && o.max === undefined && !o.from && !o.to
}

const won = (n: number) => n.toLocaleString('ko-KR')

/** 칩에 보일 "값" 쪽 글이에요. 레이블은 따로 보여요(`상태` + `진행 중`). */
export function describeValue(field: FilterField, v: FilterValue): string {
  if (typeof v === 'string') return v
  if (Array.isArray(v)) {
    const names = v.map((x) => field.options?.find((o) => o.value === x)?.label ?? x)
    return names.length <= 2 ? names.join(', ') : `${names[0]} 외 ${names.length - 1}`
  }
  const o = v as RangeValue & DateRangeValue
  const unit = field.unit ?? ''
  if (field.type === 'number') {
    if (o.min !== undefined && o.max !== undefined) return `${won(o.min)}${unit} ~ ${won(o.max)}${unit}`
    if (o.min !== undefined) return `${won(o.min)}${unit} 이상`
    return `${won(o.max as number)}${unit} 이하`
  }
  if (o.from && o.to) return `${o.from} ~ ${o.to}`
  if (o.from) return `${o.from}부터`
  return `${o.to}까지`
}

/** 적용 중인 필터 개수예요. 검색어도 하나로 세요. */
export function activeCount(state: DataViewState): number {
  return Object.values(state.filters).filter((v) => !isEmptyValue(v)).length + (state.q.trim() ? 1 : 0)
}

// ── 날짜 프리셋 (이번 달 · 지난달 · 올해) ──

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export type DatePreset = 'this-month' | 'last-month' | 'this-year'
export const DATE_PRESETS: { id: DatePreset; label: string }[] = [
  { id: 'this-month', label: '이번 달' },
  { id: 'last-month', label: '지난달' },
  { id: 'this-year', label: '올해' },
]
export function presetRange(id: DatePreset, now = new Date()): DateRangeValue {
  const y = now.getFullYear()
  const m = now.getMonth()
  if (id === 'this-month') return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) }
  if (id === 'last-month') return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) }
  return { from: iso(new Date(y, 0, 1)), to: iso(new Date(y, 11, 31)) }
}

// ── 주소(쿼리스트링)와 오가기 ──
// q · sort · view는 이름 그대로, 필터는 `f.<키>`예요. 서비스의 다른 주소 값은 건드리지 않아요.

export function toSearchParams(state: DataViewState, base = new URLSearchParams(), fallbackView = 'table'): URLSearchParams {
  const p = new URLSearchParams(base)
  const drop: string[] = []
  for (const k of p.keys()) if (k === 'q' || k === 'sort' || k === 'view' || k.startsWith('f.')) drop.push(k)
  for (const k of drop) p.delete(k)
  if (state.q.trim()) p.set('q', state.q.trim())
  if (state.sort.length) p.set('sort', state.sort.map((s) => `${s.key}:${s.dir}`).join(','))
  if (state.view && state.view !== fallbackView) p.set('view', state.view)
  for (const [k, v] of Object.entries(state.filters)) {
    if (isEmptyValue(v)) continue
    if (typeof v === 'string') p.set(`f.${k}`, v)
    else if (Array.isArray(v)) p.set(`f.${k}`, v.join(','))
    else {
      const o = v as RangeValue & DateRangeValue
      const a = o.min ?? o.from ?? ''
      const b = o.max ?? o.to ?? ''
      p.set(`f.${k}`, `${a}..${b}`)
    }
  }
  return p
}

export function fromSearchParams(p: URLSearchParams, fields: FilterField[], fallbackView = 'table'): DataViewState {
  const state = emptyState(p.get('view') ?? fallbackView)
  state.q = p.get('q') ?? ''
  state.sort = (p.get('sort') ?? '')
    .split(',')
    .map((s) => s.split(':'))
    .filter(([k, d]) => k && (d === 'asc' || d === 'desc'))
    .slice(0, MAX_SORT)
    .map(([key, dir]) => ({ key, dir: dir as SortDir }))
  for (const f of fields) {
    const raw = p.get(`f.${f.key}`)
    if (raw === null || raw === '') continue
    if (f.type === 'text') state.filters[f.key] = raw
    else if (f.type === 'check') state.filters[f.key] = raw.split(',').filter(Boolean)
    else {
      const [a = '', b = ''] = raw.split('..')
      if (f.type === 'number') {
        const v: RangeValue = {}
        if (a !== '' && !Number.isNaN(Number(a))) v.min = Number(a)
        if (b !== '' && !Number.isNaN(Number(b))) v.max = Number(b)
        if (!isEmptyValue(v)) state.filters[f.key] = v
      } else {
        const v: DateRangeValue = {}
        if (a) v.from = a
        if (b) v.to = b
        if (!isEmptyValue(v)) state.filters[f.key] = v
      }
    }
  }
  return state
}

// ── 저장한 뷰 ──
// 이 프로젝트에는 서버도 DB도 없어서, 이미 쓰는 방식인 localStorage(`mw:` 접두사, Expand와 같아요)에 둬요.
// 서버에 사용자 데이터가 있는 서비스는 `store`로 자기 저장소를 끼워요. 그 서비스가 이미 쓰는 방식이 먼저예요.

export type SavedView = { id: string; name: string; state: DataViewState; savedAt: number }
export type SavedViewStore = {
  load: () => SavedView[] | Promise<SavedView[]>
  save: (views: SavedView[]) => void | Promise<void>
}

export function localViewStore(name: string): SavedViewStore {
  const key = `mw:views:${name}`
  return {
    load() {
      try { return JSON.parse(localStorage.getItem(key) ?? '[]') as SavedView[] } catch { return [] }
    },
    save(views) {
      try { localStorage.setItem(key, JSON.stringify(views)) } catch { /* 저장소를 쓸 수 없어요 */ }
    },
  }
}

// ── 한 번에 쓰는 훅 ──

export type UseDataViewOptions = {
  fields: FilterField[]
  /** 서비스 이름과 화면 이름이에요(`photo:list`). 저장한 뷰의 이름표예요. */
  name: string
  /** 처음 보기 방식이에요. 기본은 `table`이에요. */
  defaultView?: string
  /** 처음 정렬이에요. 주소에 정렬이 없을 때만 써요. */
  defaultSort?: SortKey[]
  /** 저장한 뷰를 둘 곳이에요. 기본은 이 기기의 localStorage예요. */
  store?: SavedViewStore
}

export function useDataView({ fields, name, defaultView = 'table', defaultSort = [], store }: UseDataViewOptions) {
  const fieldsRef = useRef(fields)
  useEffect(() => { fieldsRef.current = fields })
  const [state, setState] = useState<DataViewState>(() => {
    const s = fromSearchParams(new URLSearchParams(location.search), fields, defaultView)
    if (!s.sort.length) s.sort = defaultSort
    return s
  })

  // 상태가 바뀌면 주소를 바꿔요. 기록은 쌓지 않아요(replace). 뒤로 가기는 화면을 떠나는 일이에요.
  useEffect(() => {
    const next = toSearchParams(state, new URLSearchParams(location.search), defaultView)
    const qs = next.toString()
    const url = `${location.pathname}${qs ? `?${qs}` : ''}${location.hash}`
    if (url !== `${location.pathname}${location.search}${location.hash}`) history.replaceState(history.state, '', url)
  }, [state, defaultView])

  // 주소를 직접 바꾼 경우(앞으로 · 뒤로)도 따라가요
  useEffect(() => {
    const on = () => setState(fromSearchParams(new URLSearchParams(location.search), fieldsRef.current, defaultView))
    addEventListener('popstate', on)
    return () => removeEventListener('popstate', on)
  }, [defaultView])

  const set = useCallback((patch: Partial<DataViewState>) => setState((s) => ({ ...s, ...patch })), [])
  const setQuery = useCallback((q: string) => setState((s) => ({ ...s, q })), [])
  const setFilter = useCallback((key: string, value: FilterValue | undefined) => setState((s) => {
    const filters = { ...s.filters }
    if (value === undefined || isEmptyValue(value)) delete filters[key]
    else filters[key] = value
    return { ...s, filters }
  }), [])
  const removeFilter = useCallback((key: string) => setFilter(key, undefined), [setFilter])
  const clearAll = useCallback(() => setState((s) => ({ ...s, q: '', filters: {} })), [])
  /** 가장 나중에 건 필터를 풀어요. 결과가 0건일 때 "마지막 필터 풀기"가 불러요. */
  const removeLast = useCallback(() => setState((s) => {
    const keys = Object.keys(s.filters)
    if (!keys.length) return { ...s, q: '' }
    const filters = { ...s.filters }
    delete filters[keys[keys.length - 1]]
    return { ...s, filters }
  }), [])
  const setSort = useCallback((sort: SortKey[]) => setState((s) => ({ ...s, sort: sort.slice(0, MAX_SORT) })), [])
  /** 표의 열 머리글을 눌렀을 때예요: 없음 → 오름 → 내림 → 없음. 누른 열이 1순위가 되고, 원래 1순위는 2순위로 밀려요. */
  const cycleSort = useCallback((key: string) => setState((s) => {
    const cur = s.sort.find((x) => x.key === key)
    const rest = s.sort.filter((x) => x.key !== key)
    if (!cur) return { ...s, sort: [{ key, dir: 'asc' as const }, ...rest].slice(0, MAX_SORT) }
    if (cur.dir === 'asc') return { ...s, sort: [{ key, dir: 'desc' as const }, ...rest].slice(0, MAX_SORT) }
    return { ...s, sort: rest }
  }), [])

  // 저장한 뷰
  const backend = useMemo(() => store ?? localViewStore(name), [store, name])
  const [saved, setSaved] = useState<SavedView[]>([])
  useEffect(() => {
    let live = true
    Promise.resolve(backend.load()).then((v) => { if (live) setSaved(v) })
    return () => { live = false }
  }, [backend])
  const persist = useCallback((next: SavedView[]) => { setSaved(next); void backend.save(next) }, [backend])
  const saveView = useCallback((label: string) => {
    const nm = label.trim()
    if (!nm) return
    const entry: SavedView = { id: `${Date.now().toString(36)}`, name: nm, state, savedAt: Date.now() }
    // 같은 이름이면 덮어써요
    persist([entry, ...saved.filter((v) => v.name !== nm)])
  }, [state, saved, persist])
  const applyView = useCallback((id: string) => {
    const v = saved.find((x) => x.id === id)
    if (v) setState(v.state)
  }, [saved])
  const deleteView = useCallback((id: string) => persist(saved.filter((v) => v.id !== id)), [saved, persist])

  return {
    state, set, setQuery, setFilter, removeFilter, removeLast, clearAll, setSort, cycleSort,
    count: activeCount(state),
    saved, saveView, applyView, deleteView,
  }
}

// ── 거르고 정렬하는 도우미 (서버가 따로 해 주지 않는 작은 목록용) ──

type Row = Record<string, unknown>
const collator = new Intl.Collator('ko')

export function filterRows<T extends Row>(rows: T[], state: DataViewState, fields: FilterField[], searchKeys: string[] = []): T[] {
  const q = state.q.trim().toLowerCase()
  return rows.filter((r) => {
    if (q && !searchKeys.some((k) => String(r[k] ?? '').toLowerCase().includes(q))) return false
    for (const f of fields) {
      const v = state.filters[f.key]
      if (isEmptyValue(v)) continue
      const cell = r[f.key]
      if (f.type === 'text') { if (!String(cell ?? '').toLowerCase().includes(String(v).toLowerCase())) return false }
      else if (f.type === 'check') { if (!(v as string[]).includes(String(cell))) return false }
      else if (f.type === 'number') {
        const o = v as RangeValue
        const n = Number(cell)
        if (Number.isNaN(n) || (o.min !== undefined && n < o.min) || (o.max !== undefined && n > o.max)) return false
      } else {
        const o = v as DateRangeValue
        const d = String(cell ?? '').slice(0, 10)
        if (!d || (o.from && d < o.from) || (o.to && d > o.to)) return false
      }
    }
    return true
  })
}

/** 값이 없는 칸은 방향과 상관없이 맨 뒤에 둬요. 제자리 정렬이 아니라 새 배열을 돌려줘요. */
export function sortRows<T extends Row>(rows: T[], sort: SortKey[], order: Record<string, string[]> = {}): T[] {
  if (!sort.length) return rows
  const rank = (key: string, v: unknown) => { const o = order[key]; return o ? o.indexOf(String(v)) : -1 }
  return [...rows].sort((a, b) => {
    for (const { key, dir } of sort) {
      const x = a[key]
      const y = b[key]
      const nx = x === null || x === undefined || x === ''
      const ny = y === null || y === undefined || y === ''
      if (nx || ny) { if (nx && ny) continue; return nx ? 1 : -1 }
      let c: number
      if (order[key]) c = rank(key, x) - rank(key, y)
      else if (typeof x === 'number' && typeof y === 'number') c = x - y
      else c = collator.compare(String(x), String(y))
      if (c !== 0) return dir === 'asc' ? c : -c
    }
    return 0
  })
}
