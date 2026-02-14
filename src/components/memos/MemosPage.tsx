import { MemoList } from './MemoList'
import { EditorEmptyState } from '../editor/EditorEmptyState'

export function MemosPage() {
  return (
    <>
      {/* Mobile: show MemoList as main content */}
      <div className="lg:hidden">
        <MemoList />
      </div>
      {/* Desktop: MemoList is already in MemosLayout aside; show empty state here */}
      <div className="hidden lg:flex items-center justify-center h-full">
        <EditorEmptyState />
      </div>
    </>
  )
}
