import { createBrowserRouter, Navigate, useParams } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import type { ReactNode } from 'react'
import App from './App'
import { OAuthCallback } from './pages/OAuthCallback'
import { ShareTargetPage } from './pages/ShareTargetPage'
import { Spinner } from './components/ui/Spinner'
import { SkeletonCard, SkeletonLine } from './components/ui/Skeleton'

// P-02: Route-level code splitting
const DashboardPage = lazy(() => import('./components/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const MemosLayout = lazy(() => import('./components/memos/MemosLayout').then((m) => ({ default: m.MemosLayout })))
const MemosPage = lazy(() => import('./components/memos/MemosPage').then((m) => ({ default: m.MemosPage })))
const MemoEditor = lazy(() => import('./components/editor/MemoEditor').then((m) => ({ default: m.MemoEditor })))
const CalendarPage = lazy(() => import('./components/calendar/CalendarPage').then((m) => ({ default: m.CalendarPage })))
const SemanticCanvas = lazy(() => import('./components/dashboard/SemanticCanvas'))

/** 빠른 청크 로드(<300ms)에서는 스피너가 아예 보이지 않도록 300ms 지연 후 페이드 인 */
function DelayedSpinnerFallback() {
  return (
    <div
      className="flex items-center justify-center min-h-[50dvh] opacity-0"
      style={{ animation: 'fadeIn 200ms ease-out 300ms forwards' }}
    >
      <Spinner size="lg" className="text-primary-500" />
    </div>
  )
}

/** 메모 섹션 전용 스켈레톤 — 필터 칩 행 + 카드 4장이 셸처럼 먼저 그려진다 */
function MemosSkeletonFallback() {
  return (
    <div
      aria-hidden="true"
      className="max-w-3xl mx-auto p-4 space-y-4 opacity-0"
      style={{ animation: 'fadeIn 200ms ease-out 150ms forwards' }}
    >
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((i) => (
          <SkeletonLine key={i} className="h-8 w-16 rounded-full" />
        ))}
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  )
}

function SuspenseRoute({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  return <Suspense fallback={fallback ?? <DelayedSpinnerFallback />}>{children}</Suspense>
}

// Wrapper to force remount when memo id changes (split view navigation)
function MemoEditorRoute() {
  const { id } = useParams()
  return (
    <SuspenseRoute>
      {/* 분할 뷰에서 메모 전환 시 에디터 패널만 150ms 페이드로 교체 (섹션 리마운트 없음) */}
      <div key={id || 'new'} className="flex flex-col flex-1 min-h-0 animate-in fade-in duration-150">
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
        element: <SuspenseRoute fallback={<MemosSkeletonFallback />}><MemosLayout /></SuspenseRoute>,
        children: [
          {
            path: 'memos',
            element: <SuspenseRoute fallback={<MemosSkeletonFallback />}><MemosPage /></SuspenseRoute>,
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
