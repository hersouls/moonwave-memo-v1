import { useState, useRef, useEffect } from 'react'
import { Send, X } from 'lucide-react'
import { useMemoStore } from '@/stores/memoStore'
import { useFolderStore } from '@/stores/folderStore'
import { useToastStore } from '@/stores/toastStore'
import { buildRuleTitle } from '@/utils/memoTitle'
import { Kbd } from '@/components/ui/Kbd'

interface QuickMemoInputProps {
  onClose: () => void
}

export function QuickMemoInput({ onClose }: QuickMemoInputProps) {
  const [body, setBody] = useState('')
  const addMemo = useMemoStore((s) => s.addMemo)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = async () => {
    if (!body.trim()) return
    // 카테고리별 제목 규칙 적용([폴더]_요약_YYMMDD). 빠른 메모는 미분류.
    const folders = useFolderStore.getState().folders
    const title = buildRuleTitle({ folderId: null, createdAt: new Date().toISOString(), body }, folders)
    await addMemo({ title, body, folderId: null })
    useToastStore.getState().showToast('메모가 저장되었습니다', 'success')
    setBody('')
    onClose()
  }

  return (
    <div className="mx-4 mb-3 rounded-2xl bg-white dark:bg-zinc-800 shadow-md border border-[var(--card-hairline)] p-3 animate-in slide-in-from-bottom duration-200">
      <div className="flex items-start gap-2">
        <textarea
          ref={inputRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit()
            if (e.key === 'Escape') onClose()
          }}
          placeholder="빠른 메모..."
          rows={2}
          className="flex-1 bg-transparent text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 outline-none resize-none"
        />
        {/* 44px touch targets — quick capture is a high-frequency mobile flow */}
        <div className="flex flex-col gap-1 shrink-0">
          <button
            onClick={handleSubmit}
            disabled={!body.trim()}
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-accent)] text-[var(--color-on-accent)] disabled:opacity-40 hover:bg-[var(--color-accent-hover)] active:bg-[var(--color-accent-pressed)] transition-colors"
            aria-label="저장"
          >
            <Send className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
            aria-label="닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      <p className="mt-1.5 flex items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400">
        <Kbd>Ctrl</Kbd>
        <span aria-hidden="true">+</span>
        <Kbd>Enter</Kbd>
        <span>저장</span>
        <span className="mx-0.5" aria-hidden="true">·</span>
        <Kbd>Esc</Kbd>
        <span>닫기</span>
      </p>
    </div>
  )
}
