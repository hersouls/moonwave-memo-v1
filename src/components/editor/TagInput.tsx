import { IcMwTag } from '@/mw/icons'
import { ChipGroup, InputChip } from '@/mw/Chip'

interface TagInputProps {
  tags: string[]
  onRemoveTag?: (tag: string) => void
  /** 태그 편집 모달 열기 — 지정하면 태그가 없어도 편집 버튼이 보인다. */
  onEdit?: () => void
}

/**
 * 편집기 아래의 태그 줄이에요. 키트의 Input 칩(고른 값을 보여 주고 X로 지워요)을 한 줄로 놓고,
 * 넘치면 옆으로 넘겨요. 여러 줄로 감으면 폰에서 글 쓸 자리를 태그가 차지해요.
 */
export function TagInput({ tags, onRemoveTag, onEdit }: TagInputProps) {
  if (tags.length === 0 && !onEdit) return null

  return (
    <div className="flex shrink-0 items-center gap-2 pt-3">
      {tags.length > 0 && (
        <div className="min-w-0 flex-1">
          <ChipGroup role="group" aria-label="태그">
            {tags.map((tag) => (
              onRemoveTag ? (
                <InputChip key={tag} onClick={onEdit} onIconClick={() => onRemoveTag(tag)}>
                  #{tag}
                </InputChip>
              ) : (
                <span key={tag} className="mw-tag mw-tag--category-basic mw-tag--large">#{tag}</span>
              )
            ))}
          </ChipGroup>
        </div>
      )}
      {onEdit && (
        <button type="button"
          onClick={onEdit}
          className="mw-button mw-button--secondary mw-button--small mw-button--icon-left shrink-0"
        >
          <IcMwTag size={16} />
          태그 편집
        </button>
      )}
    </div>
  )
}
