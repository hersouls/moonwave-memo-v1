/* 화면을 불러오는 동안의 모습이에요. 뼈대와 페이지 머리(제목 · 행동)는 바로 그릴 수 있으니 그대로 그리고,
   아직 오지 않은 내용의 자리만 키트의 Skeleton으로 먼저 보여 줘요.
   화면 가운데에 도는 표시 하나만 두지 않아요: 제목이 없으면 화면 낭독기가 어느 화면인지 알 수 없고,
   내용이 들어올 때 화면이 통째로 바뀌어요.
   규격: https://ux.moonwave.kr/patterns/system-status#where (불러오는 중) · https://ux.moonwave.kr/components/skeleton */
import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { Skeleton } from '@/mw/Skeleton'
import { usePanelWidth } from '@/components/memos/panelWidth'
import { CreateActions, PageHead } from './PageHead'
import { CALENDAR_HEAD, MEMOS_TITLE, editorTitle, timeGreeting, todayLine } from './pages'

/** 화면 낭독기에는 무엇을 불러오는지 말로 알려요 (스켈레톤에는 글이 없어요). */
function Saying({ children }: { children: ReactNode }) {
  return <p className="mw-sr-only" role="status">{children}</p>
}

/** 메모 카드가 놓일 자리: 목록과 같은 격자(.memo-list)라서 카드가 들어와도 자리가 그대로예요. */
function Cards({ count }: { count: number }) {
  return (
    <div className="memo-list">
      {Array.from({ length: count }, (_, i) => <Skeleton key={i} type="rectangle" className="memo-loading__card" />)}
    </div>
  )
}

/** 메모 목록의 자리. pane: 넓은 화면에서 편집기 왼쪽에 놓이는 좁은 칸 */
function MemosLoading({ pane = false }: { pane?: boolean }) {
  return (
    <div className="mw-page">
      <PageHead title={MEMOS_TITLE} actions={<CreateActions compact={pane} />} />
      {!pane && <Saying>메모를 불러오고 있어요</Saying>}
      <Cards count={pane ? 4 : 6} />
    </div>
  )
}

/** 편집기의 자리: 제목은 보이지 않는 h1이고(편집기와 같아요), 내용 칸의 자리와 너비도 편집기와 같아요. */
export function EditorLoading() {
  const { pathname } = useLocation()
  return (
    <div className="flex flex-col flex-1 min-w-0 min-h-0">
      <h1 className="mw-sr-only">{editorTitle(pathname === '/memo/new')}</h1>
      <Saying>메모를 불러오고 있어요</Saying>
      <div className="px-4 pt-3 lg:px-8 max-w-[var(--editor-measure)] mx-auto w-full">
        <Skeleton type="text" className="memo-loading__line memo-loading__line--title" />
        <Skeleton type="text" className="memo-loading__line" />
        <Skeleton type="text" className="memo-loading__line" />
        <Skeleton type="text" className="memo-loading__line memo-loading__line--short" />
      </div>
    </div>
  )
}

/** 지금 주소의 화면을 불러오는 동안의 모습. 앱이 기기의 메모를 읽는 동안과, 화면의 코드를 받는 동안에 써요. */
export function RouteLoading() {
  const { pathname } = useLocation()
  const [listWidth] = usePanelWidth()

  // 메모를 연 화면: 1280px부터는 왼쪽에 목록, 오른쪽에 편집기예요 (MemosLayout과 같은 틀). 그보다 좁으면 편집기만 있어요
  if (pathname.startsWith('/memo/')) {
    return (
      <div className="h-full flex flex-row">
        <div className="hidden xl:block shrink-0 border-r border-zinc-200 dark:border-zinc-700 overflow-hidden" style={{ width: listWidth }}>
          <MemosLoading pane />
        </div>
        <EditorLoading />
      </div>
    )
  }

  if (pathname === '/memos') return <MemosLoading />

  if (pathname === '/calendar') {
    return (
      <div className="mw-page">
        <PageHead {...CALENDAR_HEAD} actions={<CreateActions />} />
        <Saying>캘린더를 불러오고 있어요</Saying>
        <div className="memo-calendar">
          <div className="memo-calendar__side">
            <Skeleton type="rectangle" className="memo-loading__calendar" />
          </div>
          <div className="memo-calendar__list">
            <Skeleton type="rectangle" className="memo-loading__card" />
          </div>
        </div>
      </div>
    )
  }

  if (pathname === '/canvas') {
    return (
      <div className="mw-page">
        <PageHead title="시맨틱 캔버스" />
        <Saying>캔버스를 불러오고 있어요</Saying>
        <Skeleton type="rectangle" className="memo-loading__calendar" />
      </div>
    )
  }

  return (
    <div className="mw-page">
      <PageHead title={timeGreeting()} description={todayLine()} actions={<CreateActions />} />
      <Saying>홈을 불러오고 있어요</Saying>
      <Cards count={3} />
    </div>
  )
}
