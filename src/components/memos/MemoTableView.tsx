import type { Memo } from '@/lib/types'
import { useViewTransition } from '@/hooks/useViewTransition'
import { formatMemoDate } from '@/utils/format'

/** 표 보기예요. 메모 한 건이 한 행이고, 행을 누르면 메모가 열려요. */
export function MemoTableView({ memos }: { memos: Memo[] }) {
  const { navigateWithTransition } = useViewTransition()
  return (
    <div className="mw-data-table" role="region" aria-label="메모 표" tabIndex={0}>
      <table className="mw-data-table__table">
        <thead>
          <tr className="mw-data-table__row">
            <th scope="col" className="mw-data-table__header mw-data-table__header--fill">제목</th>
            <th scope="col" className="mw-data-table__header mw-data-table__header--center">고친 날</th>
          </tr>
        </thead>
        <tbody>
          {memos.map((m) => (
            <tr key={m.id} className="mw-data-table__row">
              <td className="mw-data-table__cell mw-data-table__cell--truncate">
                <button type="button" className="mw-text-button" onClick={() => navigateWithTransition(`/memo/${m.id}`)}>
                  {m.title || '제목 없음'}
                </button>
              </td>
              <td className="mw-data-table__cell mw-data-table__cell--center">{formatMemoDate(m.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
