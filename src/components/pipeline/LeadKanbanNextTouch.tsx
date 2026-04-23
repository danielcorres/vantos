import { useNavigate } from 'react-router-dom'
import type { CalendarEvent } from '../../features/calendar/types/calendar.types'
import { getTypeLabel, getStatusLabel, getStatusPillClass } from '../../features/calendar/utils/pillStyles'
import type { SchedulingGuidance } from '../../features/calendar/utils/stageSchedulingGuidance'
import { getNextActionLabel } from '../../shared/utils/nextAction'

type Variant = 'kanban' | 'table'

/** Cita en calendario (fecha + tipo) o botón Agendar. Misma UX en Kanban y vista lista. */
export function LeadKanbanNextTouch({
  leadId,
  nextAppointment,
  schedulingGuidance,
  onSchedule,
  variant = 'kanban',
}: {
  leadId: string
  nextAppointment: CalendarEvent | null | undefined
  /** Si viene, CTA y textos de ayuda alineados con la guía de agenda (misma en todas las etapas). */
  schedulingGuidance?: SchedulingGuidance | null
  onSchedule?: (leadId: string) => void
  variant?: Variant
}) {
  const navigate = useNavigate()
  const appt = nextAppointment ?? null
  const legacy = schedulingGuidance == null

  if (appt) {
    const label = getNextActionLabel(appt.starts_at)
    const typeLabel = getTypeLabel(appt.type)
    const isScheduled = appt.status === 'scheduled'
    const isCompact = variant === 'kanban'
    const showReprogramar =
      isScheduled &&
      onSchedule &&
      !legacy &&
      schedulingGuidance.editEventId != null &&
      schedulingGuidance.editEventId === appt.id

    const chipBorder = isScheduled
      ? 'border-blue-200 bg-blue-50/90 text-blue-900 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-100'
      : 'border-neutral-200 bg-neutral-50/90 text-neutral-800 dark:border-neutral-600 dark:bg-neutral-900/50 dark:text-neutral-100'

    return (
      <div
        className={`flex flex-wrap items-center gap-1.5 min-w-0 max-w-full ${isCompact ? '' : 'flex-col items-stretch sm:flex-row sm:items-center'}`}
        data-stop-rowclick="true"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <span
          className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] ${chipBorder} ${isCompact ? 'min-w-0' : ''}`}
          title="Cita en calendario"
        >
          <span className="font-semibold shrink-0">{typeLabel}</span>
          <span className="tabular-nums truncate">{label}</span>
        </span>
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${getStatusPillClass(appt.status)}`}
        >
          {getStatusLabel(appt.status)}
        </span>
        <button
          type="button"
          onClick={() => navigate(`/calendar?lead=${encodeURIComponent(leadId)}`)}
          className="shrink-0 text-[11px] font-medium text-blue-700 underline-offset-2 hover:underline dark:text-blue-300"
        >
          Calendario
        </button>
        {showReprogramar ? (
          <button
            type="button"
            onClick={() => onSchedule(leadId)}
            className="shrink-0 text-[11px] font-medium text-blue-800 underline-offset-2 hover:underline dark:text-blue-200"
          >
            {schedulingGuidance.buttonLabel}
          </button>
        ) : null}
        {isScheduled && legacy && onSchedule ? (
          <button
            type="button"
            onClick={() => onSchedule(leadId)}
            className="shrink-0 text-[11px] font-medium text-blue-800 underline-offset-2 hover:underline dark:text-blue-200"
          >
            Reprogramar
          </button>
        ) : null}
        {!isScheduled && onSchedule ? (
          <button
            type="button"
            onClick={() => onSchedule(leadId)}
            className="shrink-0 text-[11px] font-medium text-blue-800 underline-offset-2 hover:underline dark:text-blue-200"
          >
            {legacy ? 'Agendar' : schedulingGuidance.buttonLabel}
          </button>
        ) : null}
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
      {onSchedule ? (
        <button
          type="button"
          onClick={() => onSchedule(leadId)}
          className="inline-flex items-center rounded-md border border-dashed border-neutral-300 bg-neutral-50/80 px-2 py-0.5 text-[11px] font-medium text-neutral-700 hover:bg-neutral-100 hover:border-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300"
        >
          {legacy ? 'Agendar' : schedulingGuidance.buttonLabel}
        </button>
      ) : (
        <span className="text-[11px] text-neutral-400">Sin cita</span>
      )}
    </div>
  )
}
