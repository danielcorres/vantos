import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdvisorMilestones } from '../hooks/useAdvisorMilestones'
import { AdvisorMilestoneCard } from './AdvisorMilestoneCard'
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner'

export interface AdvisorMilestonesSectionProps {
  advisorIds: string[]
  nameByAdvisorId?: Map<string, string>
  /** Si true, permite click para navegar al detalle del asesor. */
  linkToDetail?: boolean
  /** Título de la sección */
  title?: string
}

/**
 * Sección reutilizable para dashboards de owner/director y manager.
 * Solo muestra asesores con advisor_status = 'asesor_12_meses'.
 * Si no hay asesores aplicables, no se renderiza (retorna null).
 */
export function AdvisorMilestonesSection({
  advisorIds,
  nameByAdvisorId,
  linkToDetail = false,
  title = 'Hitos de asesores 12 meses',
}: AdvisorMilestonesSectionProps) {
  const navigate = useNavigate()
  const { data, loading, error } = useAdvisorMilestones(advisorIds)

  const entries = useMemo(() => {
    const arr = Array.from(data.values()).filter((e) => e.status.applies)
    // Ordenar: overdue > at_risk > in_progress > completed > not_started
    const order: Record<string, number> = {
      overdue: 0,
      at_risk: 1,
      in_progress: 2,
      completed: 3,
      not_started: 4,
    }
    const currentState = (e: typeof arr[number]) => {
      if (e.status.current_phase === 'done') return 'completed'
      if (e.status.current_phase === 2) return e.status.phase2.state
      return e.status.phase1.state
    }
    arr.sort((a, b) => {
      const sa = order[currentState(a)] ?? 9
      const sb = order[currentState(b)] ?? 9
      if (sa !== sb) return sa - sb
      const na = getName(a.profile.user_id, a.profile, nameByAdvisorId)
      const nb = getName(b.profile.user_id, b.profile, nameByAdvisorId)
      return na.localeCompare(nb)
    })
    return arr
  }, [data, nameByAdvisorId])

  if (advisorIds.length === 0) return null

  if (loading) {
    return (
      <div>
        <h3 className="text-sm font-medium text-muted mb-2">{title}</h3>
        <div className="card flex items-center justify-center p-4">
          <LoadingSpinner label="Cargando hitos..." className="text-muted" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <h3 className="text-sm font-medium text-muted mb-2">{title}</h3>
        <div className="card text-center text-sm text-red-600">{error}</div>
      </div>
    )
  }

  if (entries.length === 0) {
    // No saturar UI: si nadie aplica, no mostrar la sección.
    return null
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted">{title}</h3>
        <span className="text-xs text-muted">{entries.length}</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {entries.map((entry) => {
          const name = getName(entry.profile.user_id, entry.profile, nameByAdvisorId)
          return (
            <AdvisorMilestoneCard
              key={entry.profile.user_id}
              advisorName={name}
              advisorStatus={entry.profile.advisor_status}
              status={entry.status}
              onClick={
                linkToDetail
                  ? () => navigate(`/manager/advisor/${entry.profile.user_id}`)
                  : undefined
              }
            />
          )
        })}
      </div>
    </div>
  )
}

function getName(
  id: string,
  profile: { full_name: string | null; display_name: string | null },
  nameByAdvisorId?: Map<string, string>
): string {
  return (
    nameByAdvisorId?.get(id) ||
    profile.full_name ||
    profile.display_name ||
    id.slice(0, 8)
  )
}
