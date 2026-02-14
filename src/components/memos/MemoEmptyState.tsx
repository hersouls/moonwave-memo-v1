import { FileText, Search, Trash2 } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { useUIStore } from '@/stores/uiStore'
import { useFolderStore } from '@/stores/folderStore'

function getTimeGreeting(): string {
  const hour = new Date().getHours()
  if (hour >= 5 && hour <= 11) return '좋은 아침이에요!'
  if (hour >= 12 && hour <= 17) return '좋은 오후에요!'
  if (hour >= 18 && hour <= 21) return '좋은 저녁이에요!'
  return '편안한 밤 되세요!'
}

export function MemoEmptyState() {
  const searchQuery = useUIStore((s) => s.searchQuery)
  const activeFolderId = useUIStore((s) => s.activeFolderId)
  const getTrashFolder = useFolderStore((s) => s.getTrashFolder)

  const trashFolder = getTrashFolder()
  const isTrashView = trashFolder != null && activeFolderId === trashFolder.id

  if (searchQuery.trim().length > 0) {
    return (
      <EmptyState
        icon={<Search className="h-8 w-8 text-zinc-300 dark:text-zinc-600" />}
        title="검색 결과가 없습니다"
        description={`"${searchQuery}"에 대한 결과를 찾을 수 없습니다`}
      />
    )
  }

  if (isTrashView) {
    return (
      <EmptyState
        icon={<Trash2 className="h-8 w-8 text-zinc-300 dark:text-zinc-600" />}
        title="휴지통이 비어 있습니다"
        description="삭제된 메모가 이곳에 표시됩니다"
      />
    )
  }

  return (
    <EmptyState
      icon={<FileText className="h-8 w-8 text-zinc-300 dark:text-zinc-600" />}
      title={getTimeGreeting()}
      description="새 메모를 작성해보세요"
    />
  )
}
