import { createBrowserRouter, useParams } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import App from './App'
import { OAuthCallback } from './pages/OAuthCallback'

// P-02: Route-level code splitting
const DashboardPage = lazy(() => import('./components/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const MemosLayout = lazy(() => import('./components/memos/MemosLayout').then((m) => ({ default: m.MemosLayout })))
const MemosPage = lazy(() => import('./components/memos/MemosPage').then((m) => ({ default: m.MemosPage })))
const MemoEditor = lazy(() => import('./components/editor/MemoEditor').then((m) => ({ default: m.MemoEditor })))
const CalendarPage = lazy(() => import('./components/calendar/CalendarPage').then((m) => ({ default: m.CalendarPage })))

function SuspenseRoute({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      {children}
    </Suspense>
  )
}

// Wrapper to force remount when memo id changes (split view navigation)
function MemoEditorRoute() {
  const { id } = useParams()
  return (
    <SuspenseRoute>
      <MemoEditor key={id || 'new'} />
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
])
