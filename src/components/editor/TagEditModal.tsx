import { useEffect, useState } from 'react'
import { Hash, Plus, Sparkles, X } from 'lucide-react'
import { Dialog, DialogHeader, DialogBody, DialogFooter } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { normalizeAITags } from '@/lib/tagParser'
import { suggestTags } from '@/services/aiFeatures'

interface TagEditModalProps {
  open: boolean
  onClose: () => void
  /** 본문 `#해시태그`에서 파생된 태그 — 본문을 수정해야 삭제되므로 여기서는 표시만. */
  bodyTags: string[]
  /** 필드 전용 태그(AI/수동) — 이 모달에서 추가·삭제. */
  fieldTags: string[]
  /** AI 태그 제안에 사용할 메모 본문. */
  body: string
  onSave: (fieldTags: string[]) => void
}

/**
 * 태그 보기/편집 모달. 태그는 본문에 해시태그로 삽입되지 않고 tags 필드에만
 * 저장된다 — 본문을 난잡하게 만들지 않기 위한 설계. 본문 해시태그 파생 태그는
 * 본문에서 지워야 사라지므로 삭제 버튼 없이 구분 표시한다.
 */
export function TagEditModal({ open, onClose, bodyTags, fieldTags, body, onSave }: TagEditModalProps) {
  const [draft, setDraft] = useState<string[]>(fieldTags)
  const [input, setInput] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [isSuggesting, setIsSuggesting] = useState(false)
  const [suggestError, setSuggestError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setDraft(fieldTags)
      setInput('')
      setSuggestions([])
      setSuggestError(null)
    }
    // fieldTags는 열리는 시점의 스냅샷만 필요 — open 전환 시에만 리셋
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const addTag = (raw: string) => {
    const [tag] = normalizeAITags([raw])
    if (!tag || draft.includes(tag) || bodyTags.includes(tag)) return
    setDraft((prev) => [...prev, tag])
  }

  const handleInputAdd = () => {
    if (!input.trim()) return
    addTag(input)
    setInput('')
  }

  const handleSuggest = async () => {
    if (isSuggesting) return
    setIsSuggesting(true)
    setSuggestError(null)
    try {
      const { tags, error } = await suggestTags(body)
      const normalized = normalizeAITags(tags).filter(
        (t) => !draft.includes(t) && !bodyTags.includes(t)
      )
      setSuggestions(normalized)
      if (normalized.length === 0) {
        setSuggestError(error ? 'AI 제안을 가져오지 못했습니다' : '제안할 새 태그가 없습니다')
      }
    } catch {
      setSuggestError('AI 제안을 가져오지 못했습니다')
    } finally {
      setIsSuggesting(false)
    }
  }

  const handleSave = () => {
    onSave(draft)
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} size="md">
      <DialogHeader
        title="태그 편집"
        description="태그는 본문에 추가되지 않고 별도로 저장됩니다."
        onClose={onClose}
      />
      <DialogBody className="space-y-4">
        {/* 현재 태그 */}
        <div className="flex flex-wrap gap-1.5">
          {bodyTags.map((tag) => (
            <span
              key={`body-${tag}`}
              title="본문 해시태그 — 본문에서 삭제할 수 있습니다"
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
            >
              <Hash className="w-3 h-3" />
              {tag}
            </span>
          ))}
          {draft.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-primary-50 text-primary-700 dark:bg-primary-900 dark:text-primary-300"
            >
              #{tag}
              <button
                onClick={() => setDraft((prev) => prev.filter((t) => t !== tag))}
                className="hover:text-primary-900 dark:hover:text-primary-100"
                aria-label={`${tag} 태그 삭제`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          {bodyTags.length === 0 && draft.length === 0 && (
            <span className="text-xs text-zinc-400 dark:text-zinc-500">아직 태그가 없습니다</span>
          )}
        </div>

        {/* 태그 추가 입력 */}
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleInputAdd()
              }
            }}
            placeholder="태그 입력 후 Enter"
            className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
          <button
            onClick={handleInputAdd}
            disabled={!input.trim()}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
            aria-label="태그 추가"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* AI 제안 */}
        <div>
          <button
            onClick={handleSuggest}
            disabled={isSuggesting || body.trim().length < 20}
            className="flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-700 disabled:opacity-40 dark:text-primary-400 dark:hover:text-primary-300 transition-colors"
          >
            {isSuggesting ? <Spinner size="sm" label="" className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
            AI 태그 제안
          </button>
          {suggestions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {suggestions.map((tag) => (
                <button
                  key={tag}
                  onClick={() => {
                    addTag(tag)
                    setSuggestions((prev) => prev.filter((t) => t !== tag))
                  }}
                  className="px-2.5 py-1 text-xs rounded-full bg-primary-50 text-primary-600 hover:bg-primary-100 dark:bg-primary-900/20 dark:text-primary-400 dark:hover:bg-primary-900/30 transition-colors"
                >
                  + #{tag}
                </button>
              ))}
            </div>
          )}
          {suggestError && (
            <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">{suggestError}</p>
          )}
        </div>
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>취소</Button>
        <Button variant="primary" onClick={handleSave}>저장</Button>
      </DialogFooter>
    </Dialog>
  )
}
