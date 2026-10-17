/* Moonwave UX — SortableList (끌어서 순서 바꾸기)
   길게 눌러 들어 올리고 위아래로 끌어요(파워 단계). 어느 단계에서나 메뉴의 ‘위로 · 아래로 옮기기’와 Alt + ↑ · ↓로도 옮겨요.
   규격: https://ux.moonwave.kr/patterns/touch-gestures#reorder */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { cx } from './cx'
import { useGesture } from './gestures'
import { haptics } from './haptics'
import { SortSlotContext } from './SwipeItem'
import { reorder } from './touch'

export type SortableListProps<T> = {
  items: readonly T[]
  /** 항목마다 늘 같은 열쇠예요(id). */
  getKey: (item: T) => string
  /** 항목의 이름이에요. 옮긴 뒤 화면 읽기 프로그램이 `제주 여행 준비물을 2번째로 옮겼어요`라고 읽어요. */
  itemLabel: (item: T) => string
  /** 옮겼을 때 불러요. 0부터의 차례예요. 이 안에서 목록의 순서를 바꿔요(서버에도 저장해요). */
  onMove: (from: number, to: number) => void
  /** 목록의 이름이에요(`메모 순서`). */
  label: string
  /** 한 줄을 그려요. 보통 `<SwipeItem>`이에요. 줄의 `li`는 키트가 그려요. */
  renderItem: (item: T, index: number) => ReactNode
  className?: string
}

/**
 * 순서를 사람이 정하는 목록이에요. 줄마다 `SwipeItem`을 두면 그 메뉴에 `위로 옮기기` · `아래로 옮기기`가 들어가요.
 * ‘끌어서 순서 바꾸기’가 켜져 있으면 줄을 길게 눌러 들어 올리고(진동), 끌어서 놓아요. 움직이지 않고 놓으면 그 줄의 메뉴가 열려요.
 * 키보드로는 줄 안에 포커스가 있을 때 Alt + ↑ · ↓로 옮겨요.
 */
export function SortableList<T>({ items, getKey, itemLabel, onMove, label, renderItem, className }: SortableListProps<T>) {
  const list = useRef<HTMLUListElement>(null)
  const dragOn = useGesture('reorder')
  const [said, setSaid] = useState('')
  const [lifted, setLifted] = useState(-1)
  const latest = useRef({ items, onMove, itemLabel })
  useLayoutEffect(() => { latest.current = { items, onMove, itemLabel } })

  // latest만 읽어서, 손짓을 붙인 뒤에 목록이 바뀌어도 지금 목록으로 옮겨요
  const move = (from: number, to: number, sync = false) => {
    const { items: now, onMove: run, itemLabel: name } = latest.current
    if (from === to || to < 0 || to >= now.length) return
    const item = now[from]
    if (sync) flushSync(() => run(from, to))
    else run(from, to)
    setSaid(`‘${name(item)}’ 항목을 ${to + 1}번째로 옮겼어요.`)
  }

  useEffect(() => {
    const node = list.current
    if (!node || !dragOn) return
    return reorder(node, {
      onLift: (i) => { setLifted(i); setSaid(`‘${latest.current.itemLabel(latest.current.items[i])}’ 항목을 들어 올렸어요. 끌어서 놓아요.`) },
      onMove: (from, to) => move(from, to, true),
      onRelease: (i, at) => {
        // 움직이지 않고 놓았어요: 그 줄의 메뉴를 열어요
        const row = node.children[i]?.querySelector('.mw-swipe')
        row?.dispatchEvent(new CustomEvent('mw-menu', { detail: at }))
      },
      onDrop: () => setLifted(-1),
    })
  }, [dragOn])

  const keys = (index: number) => (e: KeyboardEvent<HTMLLIElement>) => {
    if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return
    e.preventDefault()
    const to = index + (e.key === 'ArrowUp' ? -1 : 1)
    if (to < 0 || to >= items.length) { haptics.edge(); return }
    const focus = e.target as HTMLElement
    move(index, to, true)
    haptics.select()
    requestAnimationFrame(() => focus.focus({ preventScroll: false }))
  }

  return (
    <>
      <ul ref={list} className={cx('mw-sortable', className)} aria-label={label}>
        {items.map((item, i) => (
          <li key={getKey(item)} className={cx('mw-sortable__item', lifted === i && 'mw-sortable__item--lifted')} onKeyDown={keys(i)}>
            <SortSlotContext.Provider value={{ index: i, count: items.length, moveTo: (to) => { haptics.select(); move(i, to) }, dragging: dragOn }}>
              {renderItem(item, i)}
            </SortSlotContext.Provider>
          </li>
        ))}
      </ul>
      <p className="mw-sr-only" aria-live="polite">{said}</p>
    </>
  )
}
