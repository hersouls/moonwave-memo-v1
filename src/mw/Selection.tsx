/* Moonwave UX — SelectionBar · SelectionActions · SelectCheck · SelectGroup · SelectItem (선택 모드)
   규격: https://ux.moonwave.kr/patterns/selection-mode */
import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { IcLineCheck } from './icons'
import { useLongPress } from './useLongPress'
import type { Selection } from './useSelection'

/** 진짜 체크박스에 동그라미 모양을 입혀요. 이름(`label`)은 늘 있어야 해요: 항목의 이름이에요. */
export function SelectCheck({ checked, indeterminate, label, onChange }: {
  checked: boolean
  indeterminate?: boolean
  label: string
  onChange: (event: { shiftKey: boolean }) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { if (ref.current) ref.current.indeterminate = !!indeterminate && !checked }, [indeterminate, checked])
  return (
    <span className="mw-select-check">
      <input
        ref={ref}
        type="checkbox"
        className="mw-select-check__input"
        checked={checked}
        aria-label={label}
        onChange={() => undefined}
        onClick={(e) => { e.stopPropagation(); onChange({ shiftKey: e.shiftKey }) }}
      />
      <span className="mw-select-check__mark" aria-hidden="true"><IcLineCheck /></span>
    </span>
  )
}

/** 위쪽 줄이에요. 선택 모드가 열려 있을 때만 그려요: 전체 · `N개 선택됨` · 취소. 앱 상단 바 자리에 놓아요. */
export function SelectionBar({ selection, allLabel = '전체' }: { selection: Selection; allLabel?: string }) {
  if (!selection.active) return null
  return (
    <div className="mw-select-bar" role="region" aria-label="선택 모드">
      <label className="mw-select-bar__all">
        <SelectCheck checked={selection.all === 'all'} indeterminate={selection.all === 'some'} label="전체 선택" onChange={selection.toggleAll} />
        {allLabel}
      </label>
      <h2 className="mw-select-bar__title" aria-live="polite">{selection.label}</h2>
      <button type="button" className="mw-select-bar__cancel" onClick={selection.cancel}>취소</button>
    </div>
  )
}

/** 날짜 같은 묶음의 머리글이에요. 동그라미로 묶음 전체를 한 번에 골라요. */
export function SelectGroup({ name, title, selection }: { name: string; title: ReactNode; selection: Selection }) {
  const state = selection.groupState(name)
  return (
    <h3 className="mw-select-group">
      <SelectCheck checked={state === 'all'} indeterminate={state === 'some'} label={`${name} 전체 선택`} onChange={() => selection.toggleGroup(name)} />
      {title}
    </h3>
  )
}

/**
 * 선택할 수 있는 항목이에요. 길게 누르면 선택 모드가 열리고, 열린 뒤에는 누르면 켜고 꺼요(열기 · 이동은 하지 않아요).
 * 모드가 닫혀 있을 때의 짧은 누르기는 `onOpen`이에요. Shift + 누르기는 범위예요.
 */
export function SelectItem({ id, label, selection, onOpen, children, enabled = true }: {
  id: string
  label: string
  selection: Selection
  onOpen?: () => void
  children: ReactNode
  /** 설정에서 길게 누르기를 끄면 false예요. 이때도 동그라미와 `선택` 버튼으로 골라요. */
  enabled?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  useLongPress(ref, { onPress: () => selection.start(id), enabled })
  const on = selection.isSelected(id)
  return (
    <div ref={ref} className="mw-select-item" data-selected={on ? '' : undefined}
      onClick={(e) => {
        if (selection.active) { e.preventDefault(); selection.toggle(id, { range: e.shiftKey }) } else onOpen?.()
      }}>
      <SelectCheck checked={on} label={label} onChange={(e) => selection.toggle(id, { range: e.shiftKey })} />
      <div className="mw-select-item__body">{children}</div>
    </div>
  )
}

export type SelectionAction = { key: string; label: string; icon: ReactNode; onRun: () => void }

/**
 * 고른 항목에 하는 일이에요. 4개까지(폰에서 한 줄에 들어가요), 더 있으면 마지막을 `더보기`로 둬요.
 * 0개를 골랐을 때는 모두 꺼져 있어요. 폰에서는 아래에 뜬 알약, 태블릿 · PC에서는 위쪽 줄 안에 놓여요.
 */
export function SelectionActions({ selection, actions }: { selection: Selection; actions: SelectionAction[] }) {
  if (!selection.active) return null
  return (
    <div className="mw-select-actions mw-select-actions--float" role="toolbar" aria-label="선택한 항목 작업">
      {actions.slice(0, 4).map((a) => (
        <button key={a.key} type="button" className="mw-select-actions__button" disabled={!selection.count} onClick={a.onRun}>
          {a.icon}
          <span>{a.label}</span>
        </button>
      ))}
    </div>
  )
}
