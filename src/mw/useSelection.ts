/* Moonwave UX — 선택 모드
   규격: https://ux.moonwave.kr/patterns/selection-mode */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { haptics } from './haptics'

export type UseSelectionOptions = {
  /** 지금 화면에 있는 항목의 id를 보이는 순서대로예요. 묶음 선택과 범위 선택이 이 순서를 써요. */
  ids: readonly string[]
  /** 묶음 이름 → 그 묶음의 id예요. 없으면 묶음 선택은 쓰지 않아요. */
  groups?: Record<string, readonly string[]>
}

export type Selection = {
  /** 선택 모드가 열려 있는지예요. 0개를 골라도 취소하기 전까지 열려 있어요. */
  active: boolean
  selected: ReadonlySet<string>
  count: number
  /** 전체: `none` · `some`(일부) · `all`. 전체 선택 동그라미가 이 값을 그려요. */
  all: 'none' | 'some' | 'all'
  isSelected: (id: string) => boolean
  /** 길게 누르기가 받아들여졌을 때 불러요: 모드를 열고 그 항목을 골라요(한 번 떨어요). */
  start: (id: string) => void
  /** 동그라미나 항목을 눌렀을 때예요. 모드가 닫혀 있으면 열면서 고르고, 열려 있으면 켜고 꺼요. */
  toggle: (id: string, opts?: { range?: boolean }) => void
  /** 묶음 전체를 켜요. 이미 전부 골랐으면 그 묶음을 꺼요. */
  toggleGroup: (name: string) => void
  groupState: (name: string) => 'none' | 'some' | 'all'
  toggleAll: () => void
  /** 모드를 닫고 선택을 비워요. 취소 · Esc · 뒤로 가기가 이걸 불러요. */
  cancel: () => void
  /** 지금 선택한 id예요(보이는 순서). 지우기 같은 행동이 끝나면 `cancel()`을 불러요. */
  items: string[]
  /** 화면 읽기 프로그램에 전하는 말이에요: `3개 선택됨` · `항목을 선택하세요`. */
  label: string
}

/**
 * 선택 모드의 상태예요. 한 화면에 하나만 둬요. 선택은 순간의 일이라 주소에 남기지 않아요(새로 고치면 닫혀요).
 * 모드가 열린 동안 Esc와 Ctrl/⌘ + A, 브라우저의 뒤로 가기를 받아요(뒤로 가기는 모드부터 닫아요).
 *
 * ```tsx
 * const sel = useSelection({ ids: photos.map((p) => p.id), groups: byDay })
 * <SelectionBar selection={sel} />
 * ```
 */
export function useSelection({ ids, groups }: UseSelectionOptions): Selection {
  const [active, setActive] = useState(false)
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set())
  const anchor = useRef<string | null>(null)
  const idsRef = useRef(ids)
  idsRef.current = ids

  // 화면에서 사라진 항목(지움, 거름)은 선택에서도 빠져요
  useEffect(() => {
    setSelected((prev) => {
      const here = new Set(ids)
      const next = new Set([...prev].filter((id) => here.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [ids])

  const cancel = useCallback(() => { setActive(false); setSelected(new Set()); anchor.current = null }, [])

  const start = useCallback((id: string) => {
    haptics.impact()
    setActive(true)
    setSelected(new Set([id]))
    anchor.current = id
  }, [])

  const toggle = useCallback((id: string, opts?: { range?: boolean }) => {
    haptics.select()
    setActive(true)
    setSelected((prev) => {
      const next = new Set(prev)
      const from = anchor.current
      if (opts?.range && from && from !== id) {
        const list = idsRef.current, a = list.indexOf(from), b = list.indexOf(id)
        if (a >= 0 && b >= 0) { for (const x of list.slice(Math.min(a, b), Math.max(a, b) + 1)) next.add(x); return next }
      }
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    anchor.current = id
  }, [])

  const groupState = useCallback((name: string): 'none' | 'some' | 'all' => {
    const g = groups?.[name] ?? []
    const n = g.filter((id) => selected.has(id)).length
    return n === 0 ? 'none' : n === g.length ? 'all' : 'some'
  }, [groups, selected])

  const toggleGroup = useCallback((name: string) => {
    haptics.select()
    const g = groups?.[name] ?? []
    setActive(true)
    setSelected((prev) => {
      const next = new Set(prev)
      const full = g.length > 0 && g.every((id) => next.has(id))
      for (const id of g) { if (full) next.delete(id); else next.add(id) }
      return next
    })
  }, [groups])

  const toggleAll = useCallback(() => {
    haptics.select()
    setSelected((prev) => (prev.size === idsRef.current.length ? new Set() : new Set(idsRef.current)))
  }, [])

  // Esc는 모드를 닫고, Ctrl/⌘ + A는 전부 골라요(글자를 받는 칸 안에서는 건드리지 않아요)
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as Element | null)?.closest('input[type="text"], input[type="search"], textarea, [contenteditable="true"]')
      if (e.key === 'Escape') { e.preventDefault(); cancel() }
      else if (!typing && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') { e.preventDefault(); setSelected(new Set(idsRef.current)) }
    }
    window.addEventListener('keydown', onKey)
    // 하단 탭을 가리는 CSS(`[data-selecting] .mw-app-tabbar`)와 동그라미를 띄우는 CSS가 이 표시를 읽어요
    document.documentElement.setAttribute('data-selecting', '')
    // 뒤로 가기(손짓 포함)는 화면을 떠나지 않고 모드부터 닫아요
    history.pushState({ mwSelect: true }, '')
    const onPop = () => cancel()
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.documentElement.removeAttribute('data-selecting')
      window.removeEventListener('popstate', onPop)
      if ((history.state as { mwSelect?: boolean } | null)?.mwSelect) history.back()
    }
  }, [active, cancel])

  const count = selected.size
  const all = count === 0 ? 'none' : count === ids.length ? 'all' : 'some'
  const items = useMemo(() => ids.filter((id) => selected.has(id)), [ids, selected])
  const label = count ? `${count}개 선택됨` : '항목을 선택하세요'
  return { active, selected, count, all, isSelected: (id) => selected.has(id), start, toggle, toggleGroup, groupState, toggleAll, cancel, items, label }
}
