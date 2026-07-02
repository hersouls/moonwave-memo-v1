import { clsx } from 'clsx'
import type { ReactNode } from 'react'

interface KbdProps {
  children: ReactNode
  className?: string
}

/** 단축키 힌트 칩 — 명령 팔레트/단축키 모달/툴팁에서 공용 사용 */
export function Kbd({ children, className }: KbdProps) {
  return (
    <kbd
      className={clsx(
        'inline-flex h-5 min-w-5 items-center justify-center rounded px-1',
        'border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)]',
        'font-mono text-[11px] font-medium text-[var(--color-text-secondary)]',
        className
      )}
    >
      {children}
    </kbd>
  )
}
