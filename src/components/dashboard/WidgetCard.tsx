import { useId, useState, type ReactNode } from 'react'
import clsx from 'clsx'
import { ChevronDown, type LucideIcon } from 'lucide-react'

/* 대시보드 위젯 공용 카드 — 헤더 해부학 단일화
   (아이콘 칩 h-8 w-8 rounded-lg + px-5 py-3.5 헤더 + border-t 본문)
   액센트 규율: neutral 기본, primary(브랜드/인터랙티브), amber(웜/AI) 2색으로 제한 */
const TINT_STYLES = {
  neutral: 'bg-zinc-100 text-zinc-500 dark:bg-white/[0.06] dark:text-zinc-400',
  primary: 'bg-primary-50 text-primary-500 dark:bg-primary-900/20 dark:text-primary-400',
  amber: 'bg-amber-50 text-amber-500 dark:bg-amber-900/20 dark:text-amber-400',
} as const

export type WidgetTint = keyof typeof TINT_STYLES

interface WidgetCardProps {
  icon: LucideIcon
  title: ReactNode
  /** 아이콘 칩 색조 (기본 neutral) */
  tint?: WidgetTint
  /** 타이틀 오른쪽 장식 (AI Sparkles 등) */
  titleAdornment?: ReactNode
  /** 헤더 우측 메타 (개수·기간 등) */
  meta?: ReactNode
  /** 헤더 우측 액션 버튼 — collapsible일 때 토글 버튼의 형제로 오버레이 렌더 (중첩 인터랙티브 방지) */
  action?: ReactNode
  collapsible?: boolean
  defaultCollapsed?: boolean
  /** 헤더와 접이식 본문 사이의 항상 보이는 영역 (요약 통계 등) */
  subheader?: ReactNode
  /** 본문 패딩 오버라이드 (기본 px-5 py-4) */
  bodyClassName?: string
  className?: string
  children: ReactNode
}

export function WidgetCard({
  icon: Icon,
  title,
  tint = 'neutral',
  titleAdornment,
  meta,
  action,
  collapsible = false,
  defaultCollapsed = false,
  subheader,
  bodyClassName,
  className,
  children,
}: WidgetCardProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed)
  const bodyId = useId()

  const headerContent = (
    <>
      <span
        className={clsx(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
          TINT_STYLES[tint]
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="truncate text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
          {title}
        </span>
        {titleAdornment}
      </span>
      {meta != null && (
        <span className="ml-auto shrink-0 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
          {meta}
        </span>
      )}
    </>
  )

  const body = (
    <div
      className={clsx(
        'border-t border-zinc-100 dark:border-white/[0.06]',
        bodyClassName ?? 'px-5 py-4'
      )}
    >
      {children}
    </div>
  )

  if (!collapsible) {
    return (
      <div className={clsx('card overflow-hidden', className)}>
        <div className="flex items-center gap-2.5 px-5 py-3.5">
          {headerContent}
          {action && <span className={clsx('shrink-0', meta == null && 'ml-auto')}>{action}</span>}
        </div>
        {subheader}
        {body}
      </div>
    )
  }

  return (
    <div className={clsx('card overflow-hidden', className)}>
      {/* 액션은 토글 버튼의 형제로 오버레이 — 인터랙티브 요소 중첩 방지 */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          aria-expanded={!isCollapsed}
          aria-controls={bodyId}
          className={clsx(
            'flex w-full items-center gap-2.5 py-3.5 pl-5 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-white/[0.03]',
            action ? 'pr-24' : 'pr-12'
          )}
        >
          {headerContent}
          <ChevronDown
            aria-hidden="true"
            className={clsx(
              'absolute right-5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 transition-transform duration-200 ease-standard motion-reduce:transition-none',
              !isCollapsed && 'rotate-180'
            )}
          />
        </button>
        {action && (
          <span className="absolute right-11 top-1/2 -translate-y-1/2">{action}</span>
        )}
      </div>

      {subheader}

      {/* grid-rows 트릭으로 부드러운 접기/펼치기 */}
      <div
        id={bodyId}
        inert={isCollapsed}
        className={clsx(
          'grid transition-[grid-template-rows] duration-200 ease-standard motion-reduce:transition-none',
          isCollapsed ? '[grid-template-rows:0fr]' : '[grid-template-rows:1fr]'
        )}
      >
        {/* 펼칠 때 본문을 리마운트해 draw-in 류 등장 애니메이션이 재생되도록 key 부여 */}
        <div key={isCollapsed ? 'collapsed' : 'expanded'} className="min-h-0 overflow-hidden">
          {body}
        </div>
      </div>
    </div>
  )
}
