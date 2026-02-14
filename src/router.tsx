import { createBrowserRouter, useParams } from 'react-router-dom'
import App from './App'
import { DashboardPage } from './components/dashboard/DashboardPage'
import { MemosLayout } from './components/memos/MemosLayout'
import { MemosPage } from './components/memos/MemosPage'
import { MemoEditor } from './components/editor/MemoEditor'
import { OAuthCallback } from './pages/OAuthCallback'

// Wrapper to force remount when memo id changes (split view navigation)
function MemoEditorRoute() {
  const { id } = useParams()
  return <MemoEditor key={id || 'new'} />
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      {
        element: <MemosLayout />,
        children: [
          {
            path: 'memos',
            element: <MemosPage />,
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
