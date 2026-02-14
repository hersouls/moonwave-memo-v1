import { FileText } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'

export function EditorEmptyState() {
  return (
    <EmptyState
      icon={<FileText className="h-8 w-8 text-zinc-300 dark:text-zinc-600" />}
      title="메모를 선택하세요"
      description="왼쪽 목록에서 메모를 선택하거나 새 메모를 작성하세요"
      size="lg"
    />
  )
}
