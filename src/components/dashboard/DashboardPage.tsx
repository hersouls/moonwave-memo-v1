import { lazy, Suspense, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { PenLine } from 'lucide-react'
import clsx from 'clsx'
import { useAuthStore } from '@/stores/authStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useMemoStore } from '@/stores/memoStore'
import { ProfileCard } from './ProfileCard'
import { StatsRow } from './StatsRow'
import { StreakCounter } from './StreakCounter'
import { RecentWorkWidget } from './RecentWorkWidget'
// 카드 시스템 스타일 — 대시보드 청크에서 로드 (index.css 임포트 목록에서 제외되어 있음)
import '@/styles/foundation-card.css'

// PERF: Lazy-load heavier dashboard widgets
const BriefingWidget = lazy(() => import('./BriefingWidget').then((m) => ({ default: m.BriefingWidget })))
const FolderList = lazy(() => import('./FolderList').then((m) => ({ default: m.FolderList })))
const TagCloud = lazy(() => import('./TagCloud').then((m) => ({ default: m.TagCloud })))

// PERF: Lazy-load below-the-fold and heavy widgets
const ActivityHeatmap = lazy(() => import('./ActivityHeatmap').then((m) => ({ default: m.ActivityHeatmap })))
const MemoryLaneWidget = lazy(() => import('./MemoryLaneWidget').then((m) => ({ default: m.MemoryLaneWidget })))
const WeeklyDigestWidget = lazy(() => import('./WeeklyDigestWidget').then((m) => ({ default: m.WeeklyDigestWidget })))
const MoodGraphWidget = lazy(() => import('./MoodGraphWidget').then((m) => ({ default: m.MoodGraphWidget })))
const TodoWidget = lazy(() => import('./TodoWidget').then((m) => ({ default: m.TodoWidget })))
const WritingPromptWidget = lazy(() => import('./WritingPromptWidget').then((m) => ({ default: m.WritingPromptWidget })))
const AnalyticsWidget = lazy(() => import('./AnalyticsWidget').then((m) => ({ default: m.AnalyticsWidget })))
const KnowledgeGraph = lazy(() => import('./KnowledgeGraph').then((m) => ({ default: m.KnowledgeGraph })))
const InsightsWidget = lazy(() => import('./InsightsWidget').then((m) => ({ default: m.InsightsWidget })))

/* 실제 위젯 해부학(헤더 칩 + 본문 라인)을 반영한 스켈레톤 —
   bodyLines로 위젯별 실제 높이를 근사해 레이아웃 시프트 최소화 */
function WidgetFallback({ bodyLines = 2, delay = 0 }: { bodyLines?: number; delay?: number }) {
  return (
    <div
      aria-hidden="true"
      className="card animate-pulse overflow-hidden motion-reduce:animate-none"
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      <div className="flex items-center gap-2.5 px-5 py-3.5">
        <div className="h-8 w-8 rounded-lg bg-zinc-100 dark:bg-zinc-800" />
        <div className="h-3 w-20 rounded bg-zinc-100 dark:bg-zinc-800" />
      </div>
      <div className="space-y-2.5 border-t border-zinc-100 px-5 py-4 dark:border-white/[0.06]">
        {Array.from({ length: bodyLines }).map((_, i) => (
          <div
            key={i}
            className={clsx(
              'h-3 rounded bg-zinc-100 dark:bg-zinc-800',
              i % 2 === 1 ? 'w-2/3' : 'w-full'
            )}
          />
        ))}
      </div>
    </div>
  )
}

/* 매소너리 아이템 — 위젯이 null을 렌더하면 래퍼째로 사라져 유령 여백 방지 */
function GridItem({ children }: { children: ReactNode }) {
  return <div className="mb-4 break-inside-avoid empty:hidden">{children}</div>
}

function getTimeGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return '좋은 아침이에요'
  if (hour < 18) return '좋은 오후예요'
  return '좋은 저녁이에요'
}

export function DashboardPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const profileName = useSettingsStore((s) => s.settings.userProfile.name)
  const isEmpty = useMemoStore((s) => s.memos.filter((m) => !m.deletedAt).length === 0)

  const displayName = user?.displayName || profileName || '사용자'
  const todayStr = new Date().toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  })

  return (
    <div className="@container mx-auto w-full max-w-5xl xl:max-w-7xl 2xl:max-w-[1600px] px-4 py-4 lg:px-8 lg:py-6">
      {/* 페이지 헤더 — 인사 + 날짜 앵커 */}
      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-zinc-900 dark:text-zinc-100">
          {getTimeGreeting()}, {displayName}님
        </h1>
        <p className="mt-1 text-sm tabular-nums text-zinc-500 dark:text-zinc-400">{todayStr}</p>
      </header>

      {isEmpty ? (
        /* 첫 실행 상태 — 첫 메모 작성 CTA 히어로 */
        <div className="space-y-4">
          <ProfileCard />
          <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary-500 dark:bg-primary-900/20 dark:text-primary-400">
              <PenLine className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              첫 메모를 시작해 보세요
            </h2>
            <p className="max-w-xs text-sm text-zinc-500 dark:text-zinc-400">
              떠오르는 생각을 기록하면 통계·히트맵·인사이트가 이곳에 채워집니다
            </p>
            <button
              type="button"
              onClick={() => navigate('/memo/new')}
              className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[var(--color-accent)] px-5 text-sm font-medium text-[var(--color-on-accent)] transition-colors hover:bg-[var(--color-accent-hover)] active:bg-[var(--color-accent-pressed)]"
            >
              <PenLine className="h-4 w-4" />
              새 메모 작성
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* 최근 작업 위젯 (ContinueBanner 대체) */}
          <div className="mb-4 empty:hidden">
            <RecentWorkWidget />
          </div>

          {/* Container-query responsive masonry: 2-col @lg, 3-col @xl, 4-col @5xl */}
          <div className="columns-1 @lg:columns-2 @xl:columns-3 @5xl:columns-4 gap-4">
            <GridItem><ProfileCard /></GridItem>
            <GridItem>
              <Suspense fallback={<WidgetFallback bodyLines={3} />}><BriefingWidget /></Suspense>
            </GridItem>
            <GridItem><StreakCounter /></GridItem>
            <GridItem><StatsRow /></GridItem>
            <GridItem>
              <Suspense fallback={<WidgetFallback bodyLines={4} delay={80} />}><ActivityHeatmap /></Suspense>
            </GridItem>
            <GridItem>
              <Suspense fallback={null}><MoodGraphWidget /></Suspense>
            </GridItem>
            <GridItem>
              <Suspense fallback={null}><MemoryLaneWidget /></Suspense>
            </GridItem>
            <GridItem>
              <Suspense fallback={null}><WeeklyDigestWidget /></Suspense>
            </GridItem>
            <GridItem>
              <Suspense fallback={<WidgetFallback bodyLines={3} delay={160} />}><FolderList /></Suspense>
            </GridItem>
            <GridItem>
              <Suspense fallback={<WidgetFallback bodyLines={2} delay={240} />}><TagCloud /></Suspense>
            </GridItem>
            <GridItem>
              <Suspense fallback={null}><TodoWidget /></Suspense>
            </GridItem>
            <GridItem>
              <Suspense fallback={<WidgetFallback bodyLines={2} delay={320} />}><WritingPromptWidget /></Suspense>
            </GridItem>
            <GridItem>
              <Suspense fallback={<WidgetFallback bodyLines={2} delay={400} />}><AnalyticsWidget /></Suspense>
            </GridItem>
            <GridItem>
              <Suspense fallback={<WidgetFallback bodyLines={5} delay={480} />}><KnowledgeGraph /></Suspense>
            </GridItem>
            <GridItem>
              <Suspense fallback={null}><InsightsWidget /></Suspense>
            </GridItem>
          </div>
        </>
      )}
    </div>
  )
}
