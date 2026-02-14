import { ProfileCard } from './ProfileCard'
import { StatsRow } from './StatsRow'
import { FolderList } from './FolderList'
import { TagCloud } from './TagCloud'
import { FAB } from '@/components/ui/FAB'

export function DashboardPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-4 lg:px-8 lg:py-6">
      <div className="flex flex-col gap-4">
        <ProfileCard />
        <StatsRow />
        <FolderList />
        <TagCloud />
      </div>

      <FAB />
    </div>
  )
}
