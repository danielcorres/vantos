import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'
import { getHomePathForRole } from './getHomePathForRole'
import { FullScreenLoader } from '../../components/FullScreenLoader'

type RoleGuardProps = {
  allowedRoles: readonly string[]
  children: React.ReactNode
}

export function RoleGuard({ allowedRoles, children }: RoleGuardProps) {
  const { session, role, loading } = useAuth()
  const location = useLocation()
  const { pathname, search, hash } = location

  if (loading) {
    return <FullScreenLoader />
  }

  if (!session) {
    const next = encodeURIComponent(pathname + search + hash)
    return <Navigate to={`/login?next=${next}`} replace />
  }

  if (session && role == null) {
    return <FullScreenLoader />
  }

  if (role != null && allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    return <Navigate to={getHomePathForRole(role)} replace />
  }

  return <>{children}</>
}
