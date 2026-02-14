import clsx from 'clsx'

interface SkeletonProps {
  className?: string
}

export function SkeletonLine({ className }: SkeletonProps) {
  return (
    <div
      className={clsx(
        'rounded-md bg-zinc-200 dark:bg-zinc-700 skeleton-shimmer',
        className || 'h-3 w-full'
      )}
    />
  )
}

export function SkeletonCircle({ className }: SkeletonProps) {
  return (
    <div
      className={clsx(
        'rounded-full bg-zinc-200 dark:bg-zinc-700 skeleton-shimmer',
        className || 'h-10 w-10'
      )}
    />
  )
}

export function SkeletonCard() {
  return (
    <div className="rounded-2xl bg-white dark:bg-zinc-800 p-4 shadow-sm">
      <SkeletonLine className="h-4 w-3/4 mb-3" />
      <SkeletonLine className="h-3 w-full mb-2" />
      <SkeletonLine className="h-3 w-2/3 mb-3" />
      <div className="flex items-center gap-2">
        <SkeletonLine className="h-2.5 w-16" />
        <SkeletonLine className="h-2.5 w-20" />
      </div>
    </div>
  )
}

export function SkeletonEditor() {
  return (
    <div className="flex-1 p-4">
      <SkeletonLine className="h-6 w-1/2 mb-6" />
      <div className="flex flex-col gap-3">
        <SkeletonLine className="h-3 w-full" />
        <SkeletonLine className="h-3 w-5/6" />
        <SkeletonLine className="h-3 w-4/5" />
        <SkeletonLine className="h-3 w-full" />
        <SkeletonLine className="h-3 w-3/4" />
      </div>
    </div>
  )
}

export function SkeletonDashboard() {
  return (
    <div className="flex flex-col gap-6 p-4">
      {/* Profile skeleton */}
      <div className="flex items-center gap-3">
        <SkeletonCircle className="h-12 w-12" />
        <div className="flex flex-col gap-2">
          <SkeletonLine className="h-4 w-32" />
          <SkeletonLine className="h-3 w-24" />
        </div>
      </div>
      {/* Stats skeleton */}
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl bg-white dark:bg-zinc-800 p-3">
            <SkeletonLine className="h-6 w-10 mb-2" />
            <SkeletonLine className="h-3 w-16" />
          </div>
        ))}
      </div>
      {/* Folders skeleton */}
      <div className="flex flex-col gap-2">
        <SkeletonLine className="h-4 w-20 mb-1" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-zinc-800">
            <SkeletonCircle className="h-8 w-8" />
            <SkeletonLine className="h-3 w-24" />
          </div>
        ))}
      </div>
    </div>
  )
}
