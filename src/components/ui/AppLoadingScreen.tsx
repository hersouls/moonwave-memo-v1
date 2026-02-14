import { StickyNote } from 'lucide-react'
import { SkeletonCard, SkeletonLine } from './Skeleton'

export function AppLoadingScreen() {
  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-zinc-900">
      {/* Sidebar skeleton (desktop) */}
      <div className="hidden lg:flex w-16 flex-col items-center gap-4 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 pt-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500">
          <StickyNote className="h-5 w-5 text-white" />
        </div>
        <div className="flex flex-col gap-3 mt-4">
          <SkeletonLine className="h-8 w-8 rounded-lg" />
          <SkeletonLine className="h-8 w-8 rounded-lg" />
        </div>
      </div>

      {/* Main content skeleton */}
      <div className="flex-1 flex flex-col">
        {/* Header skeleton */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <SkeletonLine className="h-5 w-24" />
          <SkeletonLine className="h-8 w-8 rounded-full" />
        </div>

        {/* Content area */}
        <div className="flex flex-1">
          {/* Memo list skeleton */}
          <div className="w-full lg:w-[380px] lg:border-r lg:border-zinc-200 lg:dark:border-zinc-800 p-4 flex flex-col gap-3">
            {/* Filter tabs skeleton */}
            <div className="flex gap-2 mb-2">
              <SkeletonLine className="h-8 w-16 rounded-lg" />
              <SkeletonLine className="h-8 w-16 rounded-lg" />
              <SkeletonLine className="h-8 w-16 rounded-lg" />
            </div>
            {/* Search bar skeleton */}
            <SkeletonLine className="h-10 w-full rounded-xl" />
            {/* Card skeletons */}
            {[1, 2, 3, 4, 5].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>

          {/* Editor skeleton (desktop) */}
          <div className="hidden lg:flex flex-1 flex-col p-6">
            <SkeletonLine className="h-7 w-1/3 mb-6" />
            <div className="flex flex-col gap-3">
              <SkeletonLine className="h-3.5 w-full" />
              <SkeletonLine className="h-3.5 w-5/6" />
              <SkeletonLine className="h-3.5 w-4/5" />
              <SkeletonLine className="h-3.5 w-full" />
              <SkeletonLine className="h-3.5 w-2/3" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
