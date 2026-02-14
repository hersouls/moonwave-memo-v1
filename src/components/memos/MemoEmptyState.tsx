import { FileText } from 'lucide-react'

export function MemoEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-20">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800">
        <FileText className="h-8 w-8 text-zinc-300 dark:text-zinc-600" />
      </div>
      <p className="mt-4 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
        메모가 없습니다
      </p>
      <p className="mt-1.5 text-xs text-zinc-400 dark:text-zinc-500">
        새 메모를 작성해보세요
      </p>
    </div>
  )
}
