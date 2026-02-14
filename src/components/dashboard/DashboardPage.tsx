import { ProfileCard } from './ProfileCard'
import { StatsRow } from './StatsRow'
import { FolderList } from './FolderList'
import { TagCloud } from './TagCloud'
import { StreakCounter } from './StreakCounter'
import { ActivityHeatmap } from './ActivityHeatmap'
import { ContinueBanner } from '@/components/ui/ContinueBanner'
import { FAB } from '@/components/ui/FAB'

export function DashboardPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-4 lg:px-8 lg:py-6">
      <ContinueBanner />
      <div className="flex flex-col gap-4">
        <ProfileCard />
        <StreakCounter />
        <StatsRow />
        <ActivityHeatmap />
        <FolderList />
        <TagCloud />
      </div>

      <FAB />
    </div>
  )
}
