import { useState, useRef, useEffect } from 'react'
import { Send, X } from 'lucide-react'
import { useMemoStore } from '@/stores/memoStore'
import { useToastStore } from '@/stores/toastStore'

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
    const firstLine = body.split('\n')[0].slice(0, 50)
    await addMemo({ title: firstLine, body, folderId: null })
    useToastStore.getState().showToast('메모가 저장되었습니다', 'success')
    setBody('')
    onClose()
  }

  return (
    <div className="mx-4 mb-3 rounded-2xl bg-white dark:bg-zinc-800 shadow-md border border-zinc-200 dark:border-zinc-700 p-3 animate-in slide-in-from-bottom duration-200">
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
        <div className="flex flex-col gap-1.5 shrink-0">
          <button
            onClick={handleSubmit}
            disabled={!body.trim()}
            className="p-1.5 rounded-lg bg-primary-500 text-white disabled:opacity-40 hover:bg-primary-600 transition-colors"
            aria-label="저장"
          >
            <Send className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
            aria-label="닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1">Ctrl+Enter로 저장 · Esc로 닫기</p>
    </div>
  )
}
