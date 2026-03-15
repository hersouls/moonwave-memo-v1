import { lazy, Suspense } from 'react'
import { ProfileCard } from './ProfileCard'
import { StatsRow } from './StatsRow'
import { FolderList } from './FolderList'
import { TagCloud } from './TagCloud'
import { StreakCounter } from './StreakCounter'
import { RecentWorkWidget } from './RecentWorkWidget'
import { BriefingWidget } from './BriefingWidget'

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

function WidgetFallback() {
  return <div className="h-32 rounded-2xl bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
}

export function DashboardPage() {
  return (
    <div className="@container mx-auto w-full max-w-5xl xl:max-w-7xl px-4 py-4 lg:px-8 lg:py-6">
      {/* 최근 작업 위젯 (ContinueBanner 대체) */}
      <div className="mb-4">
        <RecentWorkWidget />
      </div>

      {/* Container-query responsive: 2-col @lg, 3-col @xl */}
      <div className="grid grid-cols-1 @lg:grid-cols-2 @xl:grid-cols-3 gap-4">
        <ProfileCard />
        <BriefingWidget />
        <StreakCounter />
        <StatsRow />
        <Suspense fallback={<WidgetFallback />}><ActivityHeatmap /></Suspense>
        <Suspense fallback={<WidgetFallback />}><MoodGraphWidget /></Suspense>
        <Suspense fallback={<WidgetFallback />}><MemoryLaneWidget /></Suspense>
        <Suspense fallback={<WidgetFallback />}><WeeklyDigestWidget /></Suspense>
        <FolderList />
        <TagCloud />
        <Suspense fallback={<WidgetFallback />}><TodoWidget /></Suspense>
        <Suspense fallback={<WidgetFallback />}><WritingPromptWidget /></Suspense>
        <Suspense fallback={<WidgetFallback />}><AnalyticsWidget /></Suspense>
        <Suspense fallback={<WidgetFallback />}><KnowledgeGraph /></Suspense>
        <Suspense fallback={<WidgetFallback />}><InsightsWidget /></Suspense>
      </div>

    </div>
  )
}
