import type { WeeklyRhythmCoach as WeeklyRhythmCoachType } from '../utils/weeklyRhythmCoach'

interface WeeklyRhythmCoachProps {
  coach: WeeklyRhythmCoachType
}

/**
 * Componente para mostrar ritmo semanal predictivo
 * Muestra proyección y sugerencias accionables
 */
export function WeeklyRhythmCoach({ coach }: WeeklyRhythmCoachProps) {
  if (!coach.statusMessage) {
    return null
  }

  return (
    <div className="mt-2 mb-3 rounded-lg border border-border bg-bg px-3 py-2">
      {coach.statusMessage && (
        <div className="text-sm text-slate-700">
          {coach.statusMessage}
        </div>
      )}
      {coach.actionMessage && (
        <div className="text-sm font-semibold text-slate-900 mt-1">
          {coach.actionMessage}
        </div>
      )}
    </div>
  )
}
