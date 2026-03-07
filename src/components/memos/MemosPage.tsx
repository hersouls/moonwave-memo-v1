import { MemoList } from './MemoList'

export function MemosPage() {
  return (
    // Mobile: show MemoList as main content
    // Desktop: MemosLayout renders MemoList directly, this component is not mounted
    <div className="lg:hidden">
      <MemoList />
    </div>
  )
}
