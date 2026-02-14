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

function SearchIllustration() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" className="text-zinc-300 dark:text-zinc-600">
      <circle cx="34" cy="34" r="20" stroke="currentColor" strokeWidth="3" />
      <line x1="48.5" y1="48.5" x2="64" y2="64" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <text x="26" y="40" fontSize="18" fill="currentColor" fontWeight="bold">?</text>
    </svg>
  )
}

function TrashIllustration() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" className="text-zinc-300 dark:text-zinc-600">
      <rect x="20" y="24" width="40" height="40" rx="4" stroke="currentColor" strokeWidth="2.5" strokeDasharray="4 3" />
      <path d="M30 24V20a4 4 0 014-4h12a4 4 0 014 4v4" stroke="currentColor" strokeWidth="2.5" />
      <line x1="16" y1="24" x2="64" y2="24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M35 58l5-5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
    </svg>
  )
}

function NoteIllustration() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" className="text-zinc-300 dark:text-zinc-600">
      <rect x="18" y="12" width="44" height="56" rx="6" stroke="currentColor" strokeWidth="2.5" />
      <line x1="28" y1="28" x2="52" y2="28" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      <line x1="28" y1="36" x2="48" y2="36" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      <line x1="28" y1="44" x2="44" y2="44" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      <circle cx="56" cy="18" r="6" fill="currentColor" opacity="0.3" />
      <path d="M53 18l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
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
        illustration={<SearchIllustration />}
        title="검색 결과가 없습니다"
        description={`"${searchQuery}"에 대한 결과를 찾을 수 없습니다`}
      />
    )
  }

  if (isTrashView) {
    return (
      <EmptyState
        icon={<Trash2 className="h-8 w-8 text-zinc-300 dark:text-zinc-600" />}
        illustration={<TrashIllustration />}
        title="휴지통이 비어 있습니다"
        description="삭제된 메모가 이곳에 표시됩니다"
      />
    )
  }

  return (
    <EmptyState
      icon={<FileText className="h-8 w-8 text-zinc-300 dark:text-zinc-600" />}
      illustration={<NoteIllustration />}
      title={getTimeGreeting()}
      description="새 메모를 작성해보세요"
    />
  )
}
