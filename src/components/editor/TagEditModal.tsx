import { useEffect, useState } from 'react'
import { Dialog, DialogHeader, DialogBody, DialogFooter } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { normalizeAITags } from '@/lib/tagParser'
import { suggestTags } from '@/services/aiFeatures'
import { IcLineAdd, IcLineClose, IcMwSparkles } from '@/mw/icons'
import { TextField } from '@/mw/TextField'

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
        setSuggestError(error ? 'AI 제안을 가져오지 못했어요. 잠시 후 다시 시도해 주세요' : '제안할 새 태그가 없어요')
      }
    } catch {
      setSuggestError('AI 제안을 가져오지 못했어요. 잠시 후 다시 시도해 주세요')
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
        description="태그는 본문에 넣지 않고 따로 저장해요."
        onClose={onClose}
      />
      <DialogBody className="space-y-4">
        {/* 현재 태그 */}
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-3">
          {/* 본문에 적은 #태그: 본문에서만 지울 수 있어서 눌리지 않는 키트 Tag로 보여요 */}
          {bodyTags.map((tag) => (
            <span key={`body-${tag}`} title="본문에 적은 태그예요. 본문에서 지울 수 있어요" className="mw-tag mw-tag--category-basic mw-tag--large">
              #{tag}
            </span>
          ))}
          {/* 따로 붙인 태그: 키트의 Input 칩이에요. 칩을 누르면 지워져요 (저장하기 전에는 취소로 되돌릴 수 있어요) */}
          {draft.map((tag) => (
            <button key={tag} type="button" className="mw-input-chip mw-input-chip--off" aria-label={`${tag} 태그 지우기`} onClick={() => setDraft((prev) => prev.filter((t) => t !== tag))}>
              #{tag}
              <span className="mw-input-chip__icon"><IcLineClose size={16} /></span>
            </button>
          ))}
          {bodyTags.length === 0 && draft.length === 0 && (
            <span className="text-xs text-[var(--text-tertiary)]">아직 태그가 없어요</span>
          )}
        </div>

        {/* 태그 추가 입력 */}
        <div className="flex items-center gap-2">
          <TextField
            label="태그 (적고 Enter)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleInputAdd()
              }
            }}
            showClearButton={false}
            containerClassName="min-w-0 flex-1"
          />
          <button type="button"
            onClick={handleInputAdd}
            disabled={!input.trim()}
            className="mw-icon-button"
            aria-label="태그 추가"
          >
            <IcLineAdd size={16} />
          </button>
        </div>

        {/* AI 제안 */}
        <div>
          <button type="button"
            onClick={handleSuggest}
            disabled={isSuggesting || body.trim().length < 20}
            className="mw-button mw-button--tertiary-subtle mw-button--medium"
          >
            {isSuggesting ? <Spinner size="sm" label="" className="h-3.5 w-3.5" /> : <IcMwSparkles size={16} />}
            AI 태그 제안
          </button>
          {suggestions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {suggestions.map((tag) => (
                <button type="button"
                  key={tag}
                  onClick={() => {
                    addTag(tag)
                    setSuggestions((prev) => prev.filter((t) => t !== tag))
                  }}
                  className="mw-button mw-button--secondary mw-button--medium"
                >
                  + #{tag}
                </button>
              ))}
            </div>
          )}
          {suggestError && (
            <p className="mt-2 text-xs text-[var(--text-tertiary)]">{suggestError}</p>
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
