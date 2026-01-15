import { createBrowserRouter } from 'react-router-dom'
import { AppShell } from './layout/AppShell'
import { LoginPage } from '../modules/auth/pages/LoginPage'
import { OkrHomePage } from '../modules/okr/pages/OkrHomePage'
import { OkrWeekPage } from '../modules/okr/pages/OkrWeekPage'
import { OkrDailyLogPage } from '../modules/okr/pages/OkrDailyLogPage'
import { OkrScoringPage } from '../modules/okr/pages/OkrScoringPage'
import { PipelinePage } from '../pages/PipelinePage'
import { FocusPage } from '../pages/FocusPage'
import { LeadDetailPage } from '../pages/LeadDetailPage'
import { PipelineSettingsPage } from '../pages/PipelineSettingsPage'
import { ProfilePage } from '../pages/ProfilePage'
import { OwnerDashboardPage } from '../pages/owner/OwnerDashboardPage'
import { AssignmentsPage } from '../pages/owner/AssignmentsPage'
import { ManagerDashboardPage } from '../pages/manager/ManagerDashboardPage'
import { AdvisorWeekDetailPage } from '../pages/manager/AdvisorWeekDetailPage'
import { WeeklyMinimumTargetsPage } from '../modules/okr/settings/WeeklyMinimumTargetsPage'

function ErrorPage() {
  return (
    <div style={{ textAlign: 'center', padding: '40px' }}>
      <h1>Error</h1>
      <p>Algo salió mal. Por favor, intenta recargar la página.</p>
    </div>
  )
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
    errorElement: <ErrorPage />,
  },
  {
    path: '/',
    element: <AppShell />,
    errorElement: <ErrorPage />,
    children: [
      {
        index: true,
        element: <OkrHomePage />,
      },
      {
        path: 'week',
        element: <OkrWeekPage />,
      },
      {
        path: 'okr/daily',
        element: <OkrDailyLogPage />,
      },
      {
        path: 'okr/scoring',
        element: <OkrScoringPage />,
      },
      {
        path: 'pipeline',
        element: <PipelinePage />,
      },
      {
        path: 'pipeline/settings',
        element: <PipelineSettingsPage />,
      },
      {
        path: 'focus',
        element: <FocusPage />,
      },
      {
        path: 'leads/:id',
        element: <LeadDetailPage />,
      },
      {
        path: 'profile',
        element: <ProfilePage />,
      },
      {
        path: 'owner/dashboard',
        element: <OwnerDashboardPage />,
      },
      {
        path: 'owner/assignments',
        element: <AssignmentsPage />,
      },
      {
        path: 'manager/dashboard',
        element: <ManagerDashboardPage />,
      },
      {
        path: 'manager/advisor/:advisorId',
        element: <AdvisorWeekDetailPage />,
      },
      {
        path: 'settings/okr-minimums',
        element: <WeeklyMinimumTargetsPage />,
      },
    ],
  },
])
