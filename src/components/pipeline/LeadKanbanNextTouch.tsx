import { useNavigate } from 'react-router-dom'
import type { CalendarEvent } from '../../features/calendar/types/calendar.types'
import { getTypeLabel } from '../../features/calendar/utils/pillStyles'
import { getNextActionLabel } from '../../shared/utils/nextAction'
import { NextActionActions } from './NextActionActions'

type Variant = 'kanban' | 'table'

/**
 * Una sola fila: prioriza próxima cita del calendario; si no hay, muestra próximo paso del pipeline.
 * Citas: enlace al calendario con lead pre-cargado. Próximo paso: edición con NextActionActions.
 */
export function LeadKanbanNextTouch({
  leadId,
  nextActionAt,
  nextActionType,
  nextAppointment,
  onUpdated,
  onToast,
  variant = 'kanban',
  openExternally,
  onExternalClose,
}: {
  leadId: string
  nextActionAt: string | null
  nextActionType: string | null
  nextAppointment: CalendarEvent | null | undefined
  onUpdated?: () => void | Promise<void>
  onToast?: (msg: string) => void
  variant?: Variant
  openExternally?: boolean
  onExternalClose?: () => void
}) {
  const navigate = useNavigate()
  const appt = nextAppointment?.status === 'scheduled' ? nextAppointment : null

  if (appt) {
    const label = getNextActionLabel(appt.starts_at)
    const typeLabel = getTypeLabel(appt.type)
    const isCompact = variant === 'kanban'

    return (
      <div
        className={`flex flex-wrap items-center gap-1.5 min-w-0 max-w-full ${isCompact ? '' : 'flex-col items-stretch sm:flex-row sm:items-center'}`}
        data-stop-rowclick="true"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <span
          className={`inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50/90 px-1.5 py-0.5 text-[11px] text-blue-900 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-100 ${isCompact ? 'min-w-0' : ''}`}
          title="Cita en calendario. Editar horario en Calendario."
        >
          <span className="font-semibold shrink-0">{typeLabel}</span>
          <span className="tabular-nums truncate">{label}</span>
        </span>
        <button
          type="button"
          onClick={() => navigate(`/calendar?lead=${encodeURIComponent(leadId)}`)}
          className="shrink-0 text-[11px] font-medium text-blue-700 underline-offset-2 hover:underline dark:text-blue-300"
        >
          Calendario
        </button>
      </div>
    )
  }

  return (
    <NextActionActions
      leadId={leadId}
      nextActionAt={nextActionAt}
      nextActionType={nextActionType}
      onUpdated={onUpdated}
      onToast={onToast}
      variant={variant === 'table' ? 'table' : 'kanban'}
      openExternally={openExternally}
      onExternalClose={onExternalClose}
    />
  )
}
