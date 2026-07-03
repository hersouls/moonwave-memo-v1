import { clsx } from 'clsx'
import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right'

interface TooltipProps {
  content: ReactNode
  children: ReactNode
  placement?: TooltipPlacement
  className?: string
}

/** 첫 표시 지연 — 마우스 이동 중 툴팁이 연쇄적으로 깜빡이는 것을 방지 */
const OPEN_DELAY = 400
/** 직전 툴팁이 닫힌 뒤 이 시간 안에 인접 트리거로 이동하면 지연 없이 바로 표시 */
const WARM_WINDOW = 150
const EXIT_MS = 100
const GAP = 8

// 모듈 레벨 타임스탬프 — 트리거 간 이동 시 warm window 판단용
let lastHiddenAt = 0

export function Tooltip({ content, children, placement = 'top', className }: TooltipProps) {
  const id = useId()
  const triggerRef = useRef<HTMLSpanElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const openTimer = useRef<number | null>(null)
  const exitTimer = useRef<number | null>(null)
  const [phase, setPhase] = useState<'closed' | 'open' | 'leaving'>('closed')
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null)

  const clearOpenTimer = useCallback(() => {
    if (openTimer.current !== null) {
      window.clearTimeout(openTimer.current)
      openTimer.current = null
    }
  }, [])

  const clearExitTimer = useCallback(() => {
    if (exitTimer.current !== null) {
      window.clearTimeout(exitTimer.current)
      exitTimer.current = null
    }
  }, [])

  const show = useCallback(
    (immediate = false) => {
      clearExitTimer()
      clearOpenTimer()
      if (immediate || Date.now() - lastHiddenAt < WARM_WINDOW) {
        setPhase('open')
        return
      }
      openTimer.current = window.setTimeout(() => setPhase('open'), OPEN_DELAY)
    },
    [clearExitTimer, clearOpenTimer]
  )

  const hide = useCallback(() => {
    clearOpenTimer()
    setPhase((prev) => {
      if (prev === 'closed') return prev
      lastHiddenAt = Date.now()
      return 'leaving'
    })
    clearExitTimer()
    exitTimer.current = window.setTimeout(() => {
      setPhase('closed')
      setCoords(null)
    }, EXIT_MS)
  }, [clearExitTimer, clearOpenTimer])

  // 언마운트 시 타이머 정리
  useEffect(
    () => () => {
      clearOpenTimer()
      clearExitTimer()
    },
    [clearOpenTimer, clearExitTimer]
  )

  // WCAG 1.4.13 — Escape로 호버 콘텐츠 해제
  useEffect(() => {
    if (phase !== 'open') return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hide()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [phase, hide])

  // 트리거 rect 기준 위치 계산 + 뷰포트 클램핑 (페인트 전 동기 실행)
  useLayoutEffect(() => {
    if (phase === 'closed') return
    const trigger = triggerRef.current
    const tip = tipRef.current
    if (!trigger || !tip) return
    const r = trigger.getBoundingClientRect()
    const t = tip.getBoundingClientRect()
    let x = 0
    let y = 0
    switch (placement) {
      case 'top':
        x = r.left + r.width / 2 - t.width / 2
        y = r.top - GAP - t.height
        break
      case 'bottom':
        x = r.left + r.width / 2 - t.width / 2
        y = r.bottom + GAP
        break
      case 'left':
        x = r.left - GAP - t.width
        y = r.top + r.height / 2 - t.height / 2
        break
      case 'right':
        x = r.right + GAP
        y = r.top + r.height / 2 - t.height / 2
        break
    }
    x = Math.max(8, Math.min(x, window.innerWidth - t.width - 8))
    y = Math.max(8, Math.min(y, window.innerHeight - t.height - 8))
    setCoords({ x, y })
  }, [phase, placement])

  if (!content) {
    return <>{children}</>
  }

  const isVisible = phase !== 'closed'
  const describedChild = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        'aria-describedby': isVisible ? id : undefined,
      })
    : children

  return (
    <span
      ref={triggerRef}
      className="relative inline-flex"
      onMouseEnter={() => show()}
      onMouseLeave={hide}
      onFocus={() => show(true)}
      onBlur={hide}
    >
      {describedChild}
      {isVisible &&
        createPortal(
          <div
            ref={tipRef}
            id={id}
            role="tooltip"
            className={clsx(
              'fixed z-[var(--z-tooltip)] max-w-xs px-2.5 py-1.5 text-xs font-medium rounded-lg shadow-lg text-pretty pointer-events-none',
              'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900',
              'border border-zinc-700 dark:border-zinc-300',
              phase === 'open' && 'animate-in fade-in-0 zoom-in-95 duration-150',
              phase === 'leaving' && 'animate-out fade-out-0 zoom-out-95 duration-100',
              className
            )}
            style={{
              left: coords?.x ?? 0,
              top: coords?.y ?? 0,
              visibility: coords ? undefined : 'hidden',
            }}
          >
            {content}
          </div>,
          document.body
        )}
    </span>
  )
}
