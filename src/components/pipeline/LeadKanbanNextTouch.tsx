import { useNavigate } from 'react-router-dom'
import type { AppointmentType, CalendarEvent } from '../../features/calendar/types/calendar.types'
import { getTypeLabel } from '../../features/calendar/utils/pillStyles'
import { getNextActionLabel } from '../../shared/utils/nextAction'
import { NextActionActions } from './NextActionActions'

type Variant = 'kanban' | 'table'

/**
 * Kanban: cita programada o botón Agendar (calendario).
 * Tabla: prioriza cita; si no hay, muestra próximo paso del pipeline (NextActionActions).
 */
export function LeadKanbanNextTouch({
  leadId,
  nextActionAt,
  nextActionType,
  nextAppointment,
  onUpdated,
  onToast,
  onSchedule,
  variant = 'kanban',
  openExternally,
  onExternalClose,
}: {
  leadId: string
  /** Solo se usa en variant `table`. */
  nextActionAt?: string | null
  nextActionType?: string | null
  nextAppointment: CalendarEvent | null | undefined
  onUpdated?: () => void | Promise<void>
  onToast?: (msg: string) => void
  /** Kanban: abrir modal de cita ligado al lead. */
  onSchedule?: (leadId: string, initialType?: AppointmentType | null) => void
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

  if (variant === 'table') {
    return (
      <div
        className="flex flex-col gap-1.5 min-w-0 max-w-full"
        data-stop-rowclick="true"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {onSchedule ? (
          <button
            type="button"
            onClick={() => onSchedule(leadId, null)}
            className="self-start rounded-md border border-dashed border-neutral-300 bg-neutral-50/80 px-2 py-0.5 text-[11px] font-medium text-neutral-700 hover:bg-neutral-100"
          >
            Agendar
          </button>
        ) : null}
        <NextActionActions
          leadId={leadId}
          nextActionAt={nextActionAt ?? null}
          nextActionType={nextActionType ?? null}
          onUpdated={onUpdated}
          onToast={onToast}
          variant="table"
          openExternally={openExternally}
          onExternalClose={onExternalClose}
        />
      </div>
    )
  }

  return (
    <div
      className="flex flex-wrap items-center gap-1.5 min-w-0 max-w-full"
      data-stop-rowclick="true"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => onSchedule?.(leadId, null)}
        className="inline-flex items-center rounded-md border border-dashed border-neutral-300 bg-neutral-50/80 px-2 py-0.5 text-[11px] font-medium text-neutral-700 hover:bg-neutral-100 hover:border-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300"
      >
        Agendar
      </button>
    </div>
  )
}
