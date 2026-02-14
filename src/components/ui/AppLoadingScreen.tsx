import { StickyNote } from 'lucide-react'

export function AppLoadingScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white dark:bg-zinc-900">
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-500">
          <StickyNote className="h-8 w-8 text-white" />
        </div>

        <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          Memo
        </h1>

        <div className="mt-4 flex gap-1">
          <span className="h-2 w-2 animate-bounce rounded-full bg-primary-400 [animation-delay:0ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-primary-400 [animation-delay:150ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-primary-400 [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  )
}
