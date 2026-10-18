import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import type { Folder } from '@/lib/types'
import { OutlineList, parseHeadings } from './EditorOutline'

interface EditorInspectorProps {
  body: string
  folder?: Folder
  tags: string[]
  charCount: number
  readingTime: number
  checklist: { checked: number; total: number } | null
  createdAt?: string
  updatedAt?: string
  onScrollToLine: (line: number) => void
  onScrollToHeadingIndex?: (index: number) => void
  /** 이어진 메모(백링크 · 관련 메모) 패널 */
  children?: ReactNode
}

// 표기: 2026.10.05(월) 14:30 (foundations/notation)
const day = (iso?: string) => {
  if (!iso) return null
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : format(date, 'yyyy.MM.dd(EEE) HH:mm', { locale: ko })
}

/**
 * 넓은 화면에서 편집기 오른쪽의 정보 서랍(DetailDrawer) 안에 놓여요: 글의 분량, 태그, 목차, 이어진 메모.
 * 좁은 화면에서는 편집기 아래 줄과 메뉴 안에 있던 것들을 한곳에 모아 둬요. 태그 편집은 서랍 아래의 버튼이에요.
 */
export function EditorInspector({ body, folder, tags, charCount, readingTime, checklist, createdAt, updatedAt, onScrollToLine, onScrollToHeadingIndex, children }: EditorInspectorProps) {
  const headings = useMemo(() => parseHeadings(body), [body])
  const created = day(createdAt)
  const updated = day(updatedAt)

  return (
    <div className="memo-inspector">
      <section>
        <h2 className="memo-inspector__title">정보</h2>
        <dl className="memo-inspector__facts">
          <dt>폴더</dt>
          <dd className="flex items-center justify-end gap-1.5">
            {folder ? (
              <>
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: folder.color }} aria-hidden="true" />
                <span className="truncate">{folder.name}</span>
              </>
            ) : '폴더 없음'}
          </dd>
          <dt>분량</dt>
          <dd>{charCount.toLocaleString()}자 · 읽기 약 {readingTime}분</dd>
          {checklist && checklist.total > 0 && (
            <>
              <dt>할 일</dt>
              <dd className="flex items-center justify-end gap-2">
                <span className="inline-block h-1.5 w-16 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700" aria-hidden="true">
                  <span className="block h-full rounded-full bg-primary-500" style={{ width: `${(checklist.checked / checklist.total) * 100}%` }} />
                </span>
                {checklist.total}개 가운데 {checklist.checked}개
              </dd>
            </>
          )}
          {updated && (<><dt>고친 때</dt><dd>{updated}</dd></>)}
          {created && (<><dt>만든 때</dt><dd>{created}</dd></>)}
        </dl>
      </section>

      <section>
        <h2 className="memo-inspector__title">태그</h2>
        {tags.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-1">
            {tags.map((tag) => (
              <li key={tag} className="mw-tag mw-tag--category-basic mw-tag--large">#{tag}</li>
            ))}
          </ul>
        ) : (
          <p className="memo-inspector__hint">아직 태그가 없어요. 본문에 #을 붙여 적거나 태그 편집에서 붙여요.</p>
        )}
      </section>

      <section>
        <h2 className="memo-inspector__title">목차</h2>
        {headings.length > 0 ? (
          <div className="-mx-2 mt-1">
            <OutlineList headings={headings} onScrollToLine={onScrollToLine} onScrollToHeadingIndex={onScrollToHeadingIndex} />
          </div>
        ) : (
          <p className="memo-inspector__hint">줄 앞에 #을 붙여 제목을 쓰면 여기에 목차가 만들어져요.</p>
        )}
      </section>

      {children && <section className="space-y-3 empty:hidden">{children}</section>}
    </div>
  )
}
