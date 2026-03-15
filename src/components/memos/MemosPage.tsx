import { MemoList } from './MemoList'
import { useUIStore } from '@/stores/uiStore'

export function MemosPage() {
  const isDesktop = useUIStore((s) => s.isDesktop)

  // Desktop: MemosLayout renders MemoList directly, skip here
  if (isDesktop) return null

  return <MemoList />
}
