import { createBrowserRouter } from 'react-router-dom'
import { RootLayout } from './RootLayout'
import { RouteErrorBoundary } from './RouteErrorBoundary'
import { AppShell } from './layout/AppShell'
import { RoleGuard } from '../modules/auth/RoleGuard'
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

const OWNER_ROLES = ['owner'] as const
const ADVISOR_AREA_ROLES = ['advisor', 'owner', 'manager', 'recruiter', 'director', 'seguimiento', 'developer', 'super_admin'] as const

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
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
        element: (
          <RoleGuard allowedRoles={[...ADVISOR_AREA_ROLES]}>
            <OkrHomePage />
          </RoleGuard>
        ),
      },
      {
        path: 'week',
        element: (
          <RoleGuard allowedRoles={[...ADVISOR_AREA_ROLES]}>
            <OkrWeekPage />
          </RoleGuard>
        ),
      },
      {
        path: 'okr/daily',
        element: (
          <RoleGuard allowedRoles={[...ADVISOR_AREA_ROLES]}>
            <OkrDailyLogPage />
          </RoleGuard>
        ),
      },
      {
        path: 'okr/scoring',
        element: (
          <RoleGuard allowedRoles={[...ADVISOR_AREA_ROLES]}>
            <OkrScoringPage />
          </RoleGuard>
        ),
      },
      {
        path: 'pipeline',
        element: (
          <RoleGuard allowedRoles={[...ADVISOR_AREA_ROLES]}>
            <PipelinePage />
          </RoleGuard>
        ),
      },
      {
        path: 'pipeline/settings',
        element: (
          <RoleGuard allowedRoles={[...ADVISOR_AREA_ROLES]}>
            <PipelineSettingsPage />
          </RoleGuard>
        ),
      },
      {
        path: 'focus',
        element: (
          <RoleGuard allowedRoles={[...ADVISOR_AREA_ROLES]}>
            <FocusPage />
          </RoleGuard>
        ),
      },
      {
        path: 'leads/:id',
        element: (
          <RoleGuard allowedRoles={[...ADVISOR_AREA_ROLES]}>
            <LeadDetailPage />
          </RoleGuard>
        ),
      },
      {
        path: 'profile',
        element: (
          <RoleGuard allowedRoles={[...ADVISOR_AREA_ROLES]}>
            <ProfilePage />
          </RoleGuard>
        ),
      },
      {
        path: 'owner/dashboard',
        element: (
          <RoleGuard allowedRoles={[...OWNER_ROLES]}>
            <OwnerDashboardPage />
          </RoleGuard>
        ),
      },
      {
        path: 'owner/assignments',
        element: (
          <RoleGuard allowedRoles={[...OWNER_ROLES]}>
            <AssignmentsPage />
          </RoleGuard>
        ),
      },
      {
        path: 'manager/dashboard',
        element: (
          <RoleGuard allowedRoles={[...ADVISOR_AREA_ROLES]}>
            <ManagerDashboardPage />
          </RoleGuard>
        ),
      },
      {
        path: 'manager/advisor/:advisorId',
        element: (
          <RoleGuard allowedRoles={[...ADVISOR_AREA_ROLES]}>
            <AdvisorWeekDetailPage />
          </RoleGuard>
        ),
      },
      {
        path: 'settings/okr-minimums',
        element: (
          <RoleGuard allowedRoles={[...ADVISOR_AREA_ROLES]}>
            <WeeklyMinimumTargetsPage />
          </RoleGuard>
        ),
      },
        ],
      },
    ],
  },
])
