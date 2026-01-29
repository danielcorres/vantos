import type { StageSlug } from '../../productivity/types/productivity.types'
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion'

interface ScheduleFirstMeetingModalProps {
  isOpen: boolean
  onClose: () => void
  /** Slug de la etapa que el usuario eligió como "intent" (citas_agendadas | citas_cierre | otro). */
  intentSlug: StageSlug | null
  onAgendar: () => void
  /** Llamado al elegir "Ahora no" (antes de onClose), para mostrar toast u otro feedback. */
  onDecline?: () => void
}

export function ScheduleFirstMeetingModal({
  isOpen,
  onClose,
  intentSlug,
  onAgendar,
  onDecline,
}: ScheduleFirstMeetingModalProps) {
  const prefersReducedMotion = useReducedMotion()

  if (!isOpen) return null

  const isCitasAgendadas = intentSlug === 'citas_agendadas'
  const isCitasCierre = intentSlug === 'citas_cierre'
  const title = isCitasCierre ? '¿Agendar cita de cierre?' : '¿Agendar primera cita?'
  // Copy por intent (FASE A): citas_agendadas vs citas_cierre
  const hint =
    isCitasAgendadas
      ? "Para que cuente en 'Citas agendadas', agenda la cita. ¿La agendamos ahora?"
      : isCitasCierre
        ? "Para que cuente en 'Citas de cierre', agenda la cita de cierre. ¿La agendamos ahora?"
        : null

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-end justify-center md:items-center z-50 p-0 md:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="schedule-first-meeting-title"
      style={{
        animation: prefersReducedMotion ? 'none' : 'fadeIn 150ms ease-out',
      }}
    >
      <div
        className="w-full md:max-w-sm md:rounded-xl rounded-t-xl bg-bg border border-border shadow-xl p-4 space-y-4"
        onClick={(e) => e.stopPropagation()}
        style={{
          animation: prefersReducedMotion ? 'none' : 'slideUp 200ms ease-out',
        }}
      >
        <h2 id="schedule-first-meeting-title" className="text-lg font-semibold text-text">
          {title}
        </h2>
        {hint && (
          <p className="text-sm text-muted">
            {hint}
          </p>
        )}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              onAgendar()
              onClose()
            }}
            className="w-full px-3 py-2.5 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary/90"
          >
            Agendar
          </button>
          <button
            type="button"
            onClick={() => {
              onDecline?.()
              onClose()
            }}
            className="w-full px-3 py-2.5 text-sm font-medium rounded-lg border border-border bg-bg hover:bg-black/5 text-text"
          >
            Ahora no
          </button>
        </div>
      </div>
    </div>
  )
}
