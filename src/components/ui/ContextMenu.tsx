import { clsx } from 'clsx'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { LucideIcon } from 'lucide-react'

export interface ContextMenuItem {
  label: string
  icon?: LucideIcon
  danger?: boolean
  disabled?: boolean
  onSelect: () => void
}

export type ContextMenuEntry = ContextMenuItem | 'divider'

interface ContextMenuProps {
  /** 뷰포트 기준 앵커 좌표 (보통 마우스 이벤트의 clientX/Y) */
  position: { x: number; y: number }
  items: ContextMenuEntry[]
  onClose: () => void
}

/**
 * 우클릭/케밥 컨텍스트 메뉴 공용 프리미티브.
 * .ctx-menu 파운데이션 토큰 사용, 뷰포트 클램핑, Escape/외부 클릭 닫기,
 * 화살표 키 이동 + 첫 항목 포커스(role=menu 시맨틱) 지원.
 */
export function ContextMenu({ position, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState(position)

  // 뷰포트 밖으로 나가지 않도록 클램핑
  useLayoutEffect(() => {
    const el = menuRef.current
    if (!el) return
    const { innerWidth, innerHeight } = window
    const rect = el.getBoundingClientRect()
    setCoords({
      x: Math.min(position.x, innerWidth - rect.width - 8),
      y: Math.min(position.y, innerHeight - rect.height - 8),
    })
  }, [position])

  useEffect(() => {
    const el = menuRef.current
    el?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
      e.preventDefault()
      const focusables = Array.from(
        el?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? []
      )
      if (focusables.length === 0) return
      const index = focusables.indexOf(document.activeElement as HTMLButtonElement)
      const next =
        e.key === 'ArrowDown'
          ? focusables[(index + 1) % focusables.length]
          : focusables[(index - 1 + focusables.length) % focusables.length]
      next.focus()
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [onClose])

  return createPortal(
    <>
      <div className="fixed inset-0 z-[calc(var(--z-context-menu)-1)]" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose() }} />
      <div
        ref={menuRef}
        role="menu"
        className="ctx-menu fixed z-[var(--z-context-menu)] animate-in fade-in-0 zoom-in-95 duration-150"
        style={{ left: coords.x, top: coords.y }}
      >
        {items.map((item, i) =>
          item === 'divider' ? (
            <div key={`divider-${i}`} className="ctx-menu__divider" role="separator" />
          ) : (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              className={clsx('ctx-menu__item', item.danger && 'ctx-menu__item--danger')}
              onClick={() => {
                onClose()
                item.onSelect()
              }}
            >
              {item.icon && <item.icon className="ctx-menu__item-icon" />}
              <span className="ctx-menu__item-label">{item.label}</span>
            </button>
          )
        )}
      </div>
    </>,
    document.body
  )
}
