import { useMemo, useCallback } from 'react'
import { useAuth } from '../../../shared/auth/AuthProvider'
import { useLeaderSelfAssign, type LeaderKind } from './hooks/useAssignments'
import { AdvisorDualList } from './components/AdvisorDualList'
import { roleLabelEs } from './copy'
import { useNotify } from '../../../shared/utils/notify'

type Props = {
  kind: LeaderKind
}

export function LeaderAssignmentsView({ kind }: Props) {
  const { user, role } = useAuth()
  const notify = useNotify()
  const myId = user?.id ?? null

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    notify.raw(message, type)
  }, [notify])

  const { mine, available, loading, error, rowStates, refetch, claim, release } = useLeaderSelfAssign(
    Boolean(myId),
    kind,
    myId
  )

  const title = useMemo(() => {
    if (kind === 'manager') return 'Mi equipo (Manager)'
    if (kind === 'recruiter') return 'Mi equipo (Recluta)'
    return 'Mi equipo (Seguimiento)'
  }, [kind])

  if (loading && mine.length === 0 && available.length === 0) {
    return (
      <div className="text-center p-8">
        <span className="text-muted">Cargando tu equipo…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center p-8 space-y-4">
        <p className="text-red-600">{error}</p>
        <button type="button" className="btn btn-primary" onClick={() => void refetch()}>
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text">{title}</h1>
        <p className="text-sm text-muted mt-1">
          Reclama asesores sin {roleLabelEs(kind)} asignado o libera los que ya no quieras tener bajo
          tu responsabilidad. Solo puedes asignarte a ti mismo o liberar; para reasignar a otra
          persona, contacta con un {roleLabelEs('director')}.
        </p>
      </div>

      <AdvisorDualList
        titleMine="Mis asesores"
        titleAvailable="Disponibles (sin tu asignación)"
        slotKind={kind}
        mine={mine}
        available={available}
        rowStates={rowStates}
        onClaim={claim}
        onRelease={release}
        onToast={showToast}
      />

      {role && (
        <p className="text-xs text-muted">
          Rol actual: <strong>{roleLabelEs(role)}</strong>
        </p>
      )}
    </div>
  )
}
