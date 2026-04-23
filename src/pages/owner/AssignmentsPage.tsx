import { useAuth } from '../../shared/auth/AuthProvider'
import { DirectorAssignmentsView } from './assignments/DirectorAssignmentsView'
import { LeaderAssignmentsView } from './assignments/LeaderAssignmentsView'
import type { LeaderKind } from './assignments/hooks/useAssignments'

function isDirectorMode(role: string | null): boolean {
  return role === 'owner' || role === 'director'
}

function leaderKindFromRole(role: string | null): LeaderKind | null {
  if (role === 'manager') return 'manager'
  if (role === 'recruiter') return 'recruiter'
  if (role === 'seguimiento') return 'seguimiento'
  return null
}

export function AssignmentsPage() {
  const { role, loading: authLoading } = useAuth()

  if (authLoading) {
    return (
      <div className="text-center p-8">
        <span className="text-muted">Cargando…</span>
      </div>
    )
  }

  if (isDirectorMode(role)) {
    return <DirectorAssignmentsView />
  }

  const lk = leaderKindFromRole(role)
  if (lk) {
    return <LeaderAssignmentsView kind={lk} />
  }

  return (
    <div className="text-center p-8">
      <p className="text-red-600">No tienes permisos para ver esta página.</p>
    </div>
  )
}
