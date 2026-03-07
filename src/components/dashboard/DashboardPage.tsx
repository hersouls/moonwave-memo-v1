import { ProfileCard } from './ProfileCard'
import { StatsRow } from './StatsRow'
import { FolderList } from './FolderList'
import { TagCloud } from './TagCloud'
import { StreakCounter } from './StreakCounter'
import { ActivityHeatmap } from './ActivityHeatmap'
import { RecentWorkWidget } from './RecentWorkWidget'
import { MemoryLaneWidget } from './MemoryLaneWidget'
import { WeeklyDigestWidget } from './WeeklyDigestWidget'
import { MoodGraphWidget } from './MoodGraphWidget'
import { TodoWidget } from './TodoWidget'
import { WritingPromptWidget } from './WritingPromptWidget'
import { AnalyticsWidget } from './AnalyticsWidget'
import { KnowledgeGraph } from './KnowledgeGraph'
import { BriefingWidget } from './BriefingWidget'
import { InsightsWidget } from './InsightsWidget'
import { FAB } from '@/components/ui/FAB'

export function DashboardPage() {
  return (
    <div className="@container mx-auto w-full max-w-5xl px-4 py-4 lg:px-8 lg:py-6">
      {/* 최근 작업 위젯 (ContinueBanner 대체) */}
      <div className="mb-4">
        <RecentWorkWidget />
      </div>

      {/* Container-query responsive: 2-column when space allows */}
      <div className="grid grid-cols-1 @lg:grid-cols-2 gap-4">
        {/* Left column: Profile + Streak + Stats */}
        <div className="flex flex-col gap-4">
          <ProfileCard />
          <StreakCounter />
          <StatsRow />
          <MemoryLaneWidget />
          <WeeklyDigestWidget />
        </div>

        {/* Right column: Heatmap + Folders + Tags + Widgets */}
        <div className="flex flex-col gap-4">
          <BriefingWidget />
          <ActivityHeatmap />
          <MoodGraphWidget />
          <FolderList />
          <TagCloud />
          <TodoWidget />
          <WritingPromptWidget />
          <AnalyticsWidget />
          <KnowledgeGraph />
          <InsightsWidget />
        </div>
      </div>

      <FAB />
    </div>
  )
}
