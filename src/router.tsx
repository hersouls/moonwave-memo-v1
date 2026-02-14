import { createBrowserRouter } from 'react-router-dom'
import App from './App'
import { DashboardPage } from './components/dashboard/DashboardPage'
import { MemosLayout } from './components/memos/MemosLayout'
import { MemosPage } from './components/memos/MemosPage'
import { MemoEditor } from './components/editor/MemoEditor'
import { OAuthCallback } from './pages/OAuthCallback'

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
            element: <MemoEditor />,
          },
          {
            path: 'memo/:id',
            element: <MemoEditor />,
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
