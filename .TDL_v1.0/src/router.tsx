import { createBrowserRouter, useParams, useNavigate } from 'react-router-dom'
import App from './App'
import { TaskList } from './components/tasks/TaskList'
import { TaskDetail } from './components/tasks/TaskDetail'
import { CalendarView } from './components/calendar/CalendarView'
import { GroupPage } from './components/groups/GroupPage'
import { GroupDetailPage } from './components/groups/GroupDetailPage'
import { ProfilePage } from './components/profile/ProfilePage'
import { ActivityLogPage } from './components/profile/ActivityLogPage'
import OAuthCallback from './pages/OAuthCallback'

function TaskDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  if (!id) return null
  return <TaskDetail taskId={Number(id)} onBack={() => navigate(-1)} />
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      {
        index: true,
        element: <TaskList />,
      },
      {
        path: 'tasks',
        element: <TaskList />,
      },
      {
        path: 'task/:id',
        element: <TaskDetailPage />,
      },
      {
        path: 'calendar',
        element: <CalendarView />,
      },
      {
        path: 'groups',
        element: <GroupPage />,
      },
      {
        path: 'groups/:id',
        element: <GroupDetailPage />,
      },
      {
        path: 'profile',
        element: <ProfilePage />,
      },
      {
        path: 'activity',
        element: <ActivityLogPage />,
      },
    ],
  },
  {
    path: '/oauth/callback',
    element: <OAuthCallback />,
  },
])
