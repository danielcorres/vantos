import { lazy, Suspense } from 'react'
import { createBrowserRouter, Outlet } from 'react-router-dom'
import { RootLayout } from './RootLayout'
import { RouteErrorBoundary } from './RouteErrorBoundary'
import { AppShell } from './layout/AppShell'
import { RouterErrorPage } from './RouterErrorPage'
import { RoleGuard } from '../modules/auth/RoleGuard'
import { PageSkeleton } from '../shared/components/PageSkeleton'
import { LoginPage } from '../modules/auth/pages/LoginPage'
import { ResetPasswordPage } from '../modules/auth/pages/ResetPasswordPage'
import { AuthCallback } from '../pages/AuthCallback'
import { OkrHomePage } from '../modules/okr/pages/OkrHomePage'
import { OkrWeekPage } from '../modules/okr/pages/OkrWeekPage'
import { OkrDailyLogPage } from '../modules/okr/pages/OkrDailyLogPage'
import { OkrScoringPage } from '../modules/okr/pages/OkrScoringPage'
import { ProfilePage } from '../pages/ProfilePage'
import { OwnerDashboardPage } from '../pages/owner/OwnerDashboardPage'
import { AssignmentsPage } from '../pages/owner/AssignmentsPage'
import { AdvisorSettingsPage } from '../pages/owner/AdvisorSettingsPage'
import { ManagerDashboardPage } from '../pages/manager/ManagerDashboardPage'
import { AdvisorWeekDetailPage } from '../pages/manager/AdvisorWeekDetailPage'
import { WeeklyMinimumTargetsPage } from '../modules/okr/settings/WeeklyMinimumTargetsPage'
import { ConsultaPlaybookPage } from '../pages/advisor/ConsultaPlaybookPage'
import { DocumentationIndexPage } from '../pages/advisor/DocumentationIndexPage'

const PipelinePage = lazy(() =>
  import('../pages/PipelinePage').then((m) => ({ default: m.PipelinePage }))
)
const CalendarPage = lazy(() =>
  import('../pages/CalendarPage').then((m) => ({ default: m.CalendarPage }))
)
const ProductivityPage = lazy(() =>
  import('../pages/ProductivityPage').then((m) => ({ default: m.ProductivityPage }))
)
const FocusPage = lazy(() =>
  import('../pages/FocusPage').then((m) => ({ default: m.FocusPage }))
)
const LeadDetailPage = lazy(() =>
  import('../pages/LeadDetailPage').then((m) => ({ default: m.LeadDetailPage }))
)
const PipelineSettingsPage = lazy(() =>
  import('../pages/PipelineSettingsPage').then((m) => ({ default: m.PipelineSettingsPage }))
)

/** Acceso a /owner/assignments (Directivo + líderes con self-claim) */
const ASSIGNMENTS_PAGE_ROLES = ['owner', 'director', 'seguimiento', 'manager', 'recruiter'] as const
const OWNER_DASHBOARD_ROLES = ['owner', 'director', 'seguimiento'] as const
const ADVISOR_AREA_ROLES = ['advisor', 'owner', 'manager', 'recruiter', 'director', 'seguimiento', 'developer', 'super_admin'] as const
const PIPELINE_ROLES = ['advisor', 'manager', 'owner'] as const
const PIPELINE_SETTINGS_ROLES = ['manager', 'owner'] as const
const ADVISOR_SETTINGS_ROLES = ['owner', 'director', 'seguimiento', 'developer'] as const

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        path: '/login',
        element: <LoginPage />,
        errorElement: <RouterErrorPage />,
      },
      {
        path: '/auth/reset',
        element: <ResetPasswordPage />,
      },
      {
        path: '/auth/callback',
        element: <AuthCallback />,
        errorElement: <RouterErrorPage />,
      },
      {
        path: '/',
        element: <AppShell />,
        errorElement: <RouterErrorPage />,
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
        path: 'docs',
        element: (
          <RoleGuard allowedRoles={[...ADVISOR_AREA_ROLES]}>
            <Outlet />
          </RoleGuard>
        ),
        children: [
          {
            index: true,
            element: <DocumentationIndexPage />,
          },
          {
            path: 'playbook',
            element: <ConsultaPlaybookPage />,
          },
        ],
      },
      {
        path: 'pipeline',
        element: (
          <RoleGuard allowedRoles={[...PIPELINE_ROLES]}>
            <Suspense fallback={<PageSkeleton />}>
              <PipelinePage />
            </Suspense>
          </RoleGuard>
        ),
      },
      {
        path: 'pipeline/settings',
        element: (
          <RoleGuard allowedRoles={[...PIPELINE_SETTINGS_ROLES]}>
            <Suspense fallback={<PageSkeleton />}>
              <PipelineSettingsPage />
            </Suspense>
          </RoleGuard>
        ),
      },
      {
        path: 'calendar',
        element: (
          <RoleGuard allowedRoles={[...ADVISOR_AREA_ROLES]}>
            <Suspense fallback={<PageSkeleton />}>
              <CalendarPage />
            </Suspense>
          </RoleGuard>
        ),
      },
      {
        path: 'productividad',
        element: (
          <RoleGuard allowedRoles={[...ADVISOR_AREA_ROLES]}>
            <Suspense fallback={<PageSkeleton />}>
              <ProductivityPage />
            </Suspense>
          </RoleGuard>
        ),
      },
      {
        path: 'focus',
        element: (
          <RoleGuard allowedRoles={[...ADVISOR_AREA_ROLES]}>
            <Suspense fallback={<PageSkeleton />}>
              <FocusPage />
            </Suspense>
          </RoleGuard>
        ),
      },
      {
        path: 'leads/:id',
        element: (
          <RoleGuard allowedRoles={[...PIPELINE_ROLES]}>
            <Suspense fallback={<PageSkeleton />}>
              <LeadDetailPage />
            </Suspense>
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
          <RoleGuard allowedRoles={[...OWNER_DASHBOARD_ROLES]}>
            <OwnerDashboardPage />
          </RoleGuard>
        ),
      },
      {
        path: 'owner/assignments',
        element: (
          <RoleGuard allowedRoles={[...ASSIGNMENTS_PAGE_ROLES]}>
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
      {
        path: 'settings/advisors',
        element: (
          <RoleGuard allowedRoles={[...ADVISOR_SETTINGS_ROLES]}>
            <AdvisorSettingsPage />
          </RoleGuard>
        ),
      },
        ],
      },
    ],
  },
])
