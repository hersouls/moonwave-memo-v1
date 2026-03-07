import { ProfileCard } from './ProfileCard'
import { StatsRow } from './StatsRow'
import { FolderList } from './FolderList'
import { TagCloud } from './TagCloud'
import { StreakCounter } from './StreakCounter'
import { ActivityHeatmap } from './ActivityHeatmap'
import { RecentWorkWidget } from './RecentWorkWidget'
import { FAB } from '@/components/ui/FAB'

export function DashboardPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-4 lg:px-8 lg:py-6">
      {/* 최근 작업 위젯 (ContinueBanner 대체) */}
      <div className="mb-4">
        <RecentWorkWidget />
      </div>

      {/* Desktop: 2-column grid; Mobile: single column */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left column: Profile + Streak + Stats */}
        <div className="flex flex-col gap-4">
          <ProfileCard />
          <StreakCounter />
          <StatsRow />
        </div>

        {/* Right column: Heatmap + Folders + Tags */}
        <div className="flex flex-col gap-4">
          <ActivityHeatmap />
          <FolderList />
          <TagCloud />
        </div>
      </div>

      <FAB />
    </div>
  )
}
