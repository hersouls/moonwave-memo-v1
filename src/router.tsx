import { createBrowserRouter } from 'react-router-dom'
import App from './App'
import { DashboardPage } from './components/dashboard/DashboardPage'
import { MemoList } from './components/memos/MemoList'
import { MemoEditor } from './components/editor/MemoEditor'
import { SettingsPage } from './components/settings/SettingsPage'
import { FontSettingsPage } from './components/settings/FontSettingsPage'
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
        path: 'memos',
        element: <MemoList />,
      },
      {
        path: 'memo/new',
        element: <MemoEditor />,
      },
      {
        path: 'memo/:id',
        element: <MemoEditor />,
      },
      {
        path: 'settings',
        element: <SettingsPage />,
      },
      {
        path: 'settings/font',
        element: <FontSettingsPage />,
      },
    ],
  },
  {
    path: '/oauth/callback',
    element: <OAuthCallback />,
  },
])
