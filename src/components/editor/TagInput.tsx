import { IcMwTag } from '@/mw/icons'

interface TagInputProps {
  tags: string[]
  /** 태그 편집 모달 열기 — 지정하면 태그가 없어도 편집 버튼이 보인다. */
  onEdit?: () => void
}

/**
 * 편집기 아래의 태그 줄이에요. 붙은 태그를 키트의 Tag(눌리지 않는 표시)로 한 줄에 보여 주고, 넘치면 옆으로 넘겨요.
 * 붙이고 지우는 일은 '태그 편집' 창에서 해요: 여러 줄의 지우는 칩을 두면 폰에서 글 쓸 자리를 태그가 차지하고,
 * 줄을 넘기다 잘못 눌러 지우기 쉬워요.
 */
export function TagInput({ tags, onEdit }: TagInputProps) {
  if (tags.length === 0 && !onEdit) return null

  return (
    // 아래 여백(pb-2)은 '태그 편집'(32px 버튼)의 누르는 영역이 편집기 칸의 끝에서 잘리지 않게 해요
    <div className="flex shrink-0 items-center gap-2 pt-3 pb-2">
      {tags.length > 0 && (
        <ul aria-label="태그" className="scrollbar-none flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {tags.map((tag) => (
            <li key={tag} className="mw-tag mw-tag--category-basic mw-tag--large shrink-0 whitespace-nowrap">#{tag}</li>
          ))}
        </ul>
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
