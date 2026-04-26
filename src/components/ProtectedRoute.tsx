import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useSession } from '../lib/useSession'
import { PageLoading } from './ui/PageLoading'

interface ProtectedRouteProps {
  children: ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { session, loading } = useSession()

  if (loading) {
    return <PageLoading fullHeight />
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

