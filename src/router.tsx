import { createBrowserRouter, Navigate, useParams } from 'react-router-dom'
import { lazy, Suspense, useState } from 'react'
import type { ComponentType, ReactNode } from 'react'
import App from './App'
import { OAuthCallback } from './pages/OAuthCallback'
import { ShareTargetPage } from './pages/ShareTargetPage'
import { EditorLoading, RouteLoading } from './components/layout/PageLoading'

/**
 * 화면의 코드는 나눠 받아요(P-02). 다만 받는 일을 화면을 그릴 때까지 미루지 않아요:
 * 지금 주소의 화면은 앱이 기기의 메모를 읽는 동안 함께 받고, 나머지 화면은 한가할 때 받아 둬요.
 * 한 번 받은 화면은 기다리는 모습(RouteLoading)을 거치지 않고 바로 그려요.
 */
function lazyPage(load: () => Promise<ComponentType>) {
  let ready: ComponentType | null = null
  let pending: Promise<ComponentType> | null = null
  // 받지 못했으면(오프라인) 다음에 다시 받아요
  const fetchPage = () => (pending ??= load().then((page) => (ready = page), (error) => { pending = null; throw error }))
  const Lazy = lazy(() => fetchPage().then((page) => ({ default: page })))
  function Page() {
    // 처음 그릴 때 한 번 정해요: 그 뒤에 바꾸면 화면이 처음부터 다시 그려져요
    const [Shown] = useState<ComponentType>(() => ready ?? Lazy)
    return <Shown />
  }
  return Object.assign(Page, { preload: () => { fetchPage().catch(() => {}) } })
}

const DashboardPage = lazyPage(() => import('./components/dashboard/DashboardPage').then((m) => m.DashboardPage))
const MemosLayout = lazyPage(() => import('./components/memos/MemosLayout').then((m) => m.MemosLayout))
const MemosPage = lazyPage(() => import('./components/memos/MemosPage').then((m) => m.MemosPage))
const MemoEditor = lazyPage(() => import('./components/editor/MemoEditor').then((m) => m.MemoEditor))
const CalendarPage = lazyPage(() => import('./components/calendar/CalendarPage').then((m) => m.CalendarPage))
const SemanticCanvas = lazyPage(() => import('./components/dashboard/SemanticCanvas').then((m) => m.default))

/** 주소에 놓이는 화면들. 메모 화면은 틀(MemosLayout)과 그 안의 화면을 차례로가 아니라 함께 받아요. */
function pagesOf(pathname: string) {
  if (pathname === '/') return [DashboardPage]
  if (pathname === '/calendar') return [CalendarPage]
  if (pathname === '/canvas') return [SemanticCanvas]
  if (pathname === '/memos') return [MemosLayout, MemosPage]
  if (pathname.startsWith('/memo/')) return [MemosLayout, MemoEditor]
  return []
}

if (typeof window !== 'undefined') {
  for (const page of pagesOf(window.location.pathname)) page.preload()
  // 메뉴의 화면들: 처음 그린 뒤 한가할 때 받아 둬요. 데이터를 아끼는 설정이면 받지 않아요.
  const saving = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData
  if (!saving) {
    const later = () => { for (const page of [DashboardPage, MemosLayout, MemosPage, CalendarPage, MemoEditor]) page.preload() }
    const whenIdle = () => {
      if ('requestIdleCallback' in window) window.requestIdleCallback(later, { timeout: 5000 })
      else setTimeout(later, 3000)
    }
    if (document.readyState === 'complete') whenIdle()
    else window.addEventListener('load', whenIdle, { once: true })
  }
}

/** 화면의 코드를 받는 동안: 그 화면의 제목과, 내용이 들어올 자리를 보여 줘요. */
function SuspenseRoute({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  return <Suspense fallback={fallback ?? <RouteLoading />}>{children}</Suspense>
}

// Wrapper to force remount when memo id changes (split view navigation)
function MemoEditorRoute() {
  const { id } = useParams()
  return (
    // 편집기는 메모 화면의 틀(MemosLayout) 안에 놓여요: 기다리는 동안에도 편집기의 자리만 보여 줘요
    <SuspenseRoute fallback={<EditorLoading />}>
      {/* 분할 뷰에서 메모 전환 시 에디터 패널만 150ms 페이드로 교체 (섹션 리마운트 없음) */}
      <div key={id || 'new'} className="flex flex-col flex-1 min-h-0 animate-in fade-in duration-200">
        <MemoEditor />
      </div>
    </SuspenseRoute>
  )
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      {
        index: true,
        element: <SuspenseRoute><DashboardPage /></SuspenseRoute>,
      },
      {
        path: 'calendar',
        element: <SuspenseRoute><CalendarPage /></SuspenseRoute>,
      },
      {
        path: 'canvas',
        element: <SuspenseRoute><SemanticCanvas /></SuspenseRoute>,
      },
      {
        element: <SuspenseRoute><MemosLayout /></SuspenseRoute>,
        children: [
          {
            path: 'memos',
            element: <SuspenseRoute><MemosPage /></SuspenseRoute>,
          },
          {
            path: 'memo/new',
            element: <MemoEditorRoute />,
          },
          {
            path: 'memo/:id',
            element: <MemoEditorRoute />,
          },
        ],
      },
    ],
  },
  {
    path: '/oauth/callback',
    element: <OAuthCallback />,
  },
  {
    path: '/share-target',
    element: <ShareTargetPage />,
  },
  {
    // Any unmatched path (e.g. Electron's app://bundle/index.html, or a stale deep
    // link) redirects home instead of react-router's default 404 error screen.
    path: '*',
    element: <Navigate to="/" replace />,
  },
])
