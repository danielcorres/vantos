import { useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../shared/auth/AuthProvider'
import { getHomePathForRole } from '../modules/auth/getHomePathForRole'

function isSafeNext(next: string | null): next is string {
  if (!next || typeof next !== 'string') return false
  return next.startsWith('/') && !next.startsWith('//')
}

export function RootLayout() {
  const { session, role, loading } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const { pathname, search } = location

  useEffect(() => {
    if (!session || role == null || loading) return
    if (pathname !== '/' && pathname !== '/login') return

    const params = new URLSearchParams(search)
    const next = params.get('next')
    if (isSafeNext(next)) {
      navigate(next, { replace: true })
      return
    }
    navigate(getHomePathForRole(role), { replace: true })
  }, [session, role, loading, pathname, search, navigate])

  return <Outlet />
}
