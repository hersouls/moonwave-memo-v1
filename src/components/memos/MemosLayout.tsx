import { Outlet } from 'react-router-dom'
import { MemoList } from './MemoList'

export function MemosLayout() {
  return (
    <div className="lg:flex lg:h-full">
      {/* Middle panel: MemoList - visible only on desktop */}
      <aside className="hidden lg:flex lg:flex-col w-[380px] shrink-0 border-r border-zinc-200 dark:border-zinc-800 overflow-y-auto">
        <MemoList />
      </aside>

      {/* Right panel (desktop) / Main content (mobile) */}
      <div className="flex-1 lg:overflow-y-auto">
        <Outlet />
      </div>
    </div>
  )
}
