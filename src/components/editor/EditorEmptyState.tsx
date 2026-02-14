import { FileText } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'

function EditorIllustration() {
  return (
    <svg width="96" height="96" viewBox="0 0 96 96" fill="none" className="text-zinc-300 dark:text-zinc-600">
      <rect x="20" y="14" width="56" height="68" rx="8" stroke="currentColor" strokeWidth="2.5" />
      <line x1="32" y1="32" x2="64" y2="32" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
      <line x1="32" y1="42" x2="58" y2="42" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
      <line x1="32" y1="52" x2="52" y2="52" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
      <path d="M56 60l8-8 8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
      <line x1="64" y1="52" x2="64" y2="68" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
    </svg>
  )
}

export function EditorEmptyState() {
  return (
    <EmptyState
      icon={<FileText className="h-8 w-8 text-zinc-300 dark:text-zinc-600" />}
      illustration={<EditorIllustration />}
      title="메모를 선택하세요"
      description="왼쪽 목록에서 메모를 선택하거나 새 메모를 작성하세요"
      size="lg"
    />
  )
}
