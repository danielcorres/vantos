import type { ElementType } from 'react'
import type {
  AdvisorMilestoneStatus,
  MilestoneState,
  Phase1Status,
  Phase2Status,
} from '../domain/advisorMilestones'

export interface AdvisorMilestoneCardProps {
  advisorName: string
  advisorStatus: string | null
  status: AdvisorMilestoneStatus
  onClick?: () => void
  compact?: boolean
}

const STATE_STYLES: Record<MilestoneState, { chip: string; bar: string; text: string }> = {
  not_started: {
    chip: 'bg-black/5 text-muted',
    bar: 'bg-black/30',
    text: 'text-muted',
  },
  in_progress: {
    chip: 'bg-black/5 text-text',
    bar: 'bg-black/50',
    text: 'text-text',
  },
  at_risk: {
    chip: 'bg-amber-50 text-amber-700',
    bar: 'bg-amber-500',
    text: 'text-amber-700',
  },
  overdue: {
    chip: 'bg-red-50 text-red-700',
    bar: 'bg-red-500',
    text: 'text-red-700',
  },
  completed: {
    chip: 'bg-emerald-50 text-emerald-700',
    bar: 'bg-emerald-500',
    text: 'text-emerald-700',
  },
}

const STATE_LABEL: Record<MilestoneState, string> = {
  not_started: 'Sin iniciar',
  in_progress: 'En curso',
  at_risk: 'En riesgo',
  overdue: 'Vencido',
  completed: 'Completado',
}

const ADVISOR_STATUS_LABEL: Record<string, string> = {
  asesor_12_meses: 'Asesor 12 meses',
  nueva_generacion: 'Nueva generación',
  consolidado: 'Consolidado',
}

function formatAdvisorStatus(s: string | null): string {
  if (!s) return '—'
  return ADVISOR_STATUS_LABEL[s] ?? s
}

function formatCountdown(phase: { state: MilestoneState; days_remaining: number | null; days_overdue: number | null }): string {
  if (phase.state === 'completed') return 'Completado'
  if (phase.state === 'not_started') return 'Pendiente de iniciar'
  if (phase.state === 'overdue') {
    const d = phase.days_overdue ?? 0
    return d === 1 ? 'Vencido hace 1 día' : `Vencido hace ${d} días`
  }
  const d = phase.days_remaining ?? 0
  return d === 1 ? '1 día restante' : `${d} días restantes`
}

export function AdvisorMilestoneCard({
  advisorName,
  advisorStatus,
  status,
  onClick,
  compact = false,
}: AdvisorMilestoneCardProps) {
  if (!status.applies) return null

  const isPhase1 = status.current_phase === 1
  const isPhase2 = status.current_phase === 2
  const isDone = status.current_phase === 'done'

  const phase1 = status.phase1
  const phase2 = status.phase2

  const activeState: MilestoneState = isDone
    ? 'completed'
    : isPhase2
      ? phase2.state
      : phase1.state

  const styles = STATE_STYLES[activeState]

  const Wrapper = (onClick ? 'button' : 'div') as ElementType
  const wrapperProps = onClick
    ? {
        onClick,
        type: 'button' as const,
        className: 'card w-full text-left hover:bg-black/5 transition-colors',
      }
    : { className: 'card' }

  return (
    <Wrapper {...wrapperProps}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-text truncate">{advisorName}</div>
          <div className="text-xs text-muted truncate">{formatAdvisorStatus(advisorStatus)}</div>
        </div>
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles.chip}`}>
          {STATE_LABEL[activeState]}
        </span>
      </div>

      <Phase1Row phase={phase1} highlighted={isPhase1} />

      {!compact && (
        <>
          <div className="h-px bg-border my-2" />
          <Phase2Row phase={phase2} highlighted={isPhase2 || isDone} />
        </>
      )}
    </Wrapper>
  )
}

function Phase1Row({ phase, highlighted }: { phase: Phase1Status; highlighted: boolean }) {
  const styles = STATE_STYLES[phase.state]
  const pct = Math.round(phase.progress_ratio * 100)
  return (
    <div className={highlighted ? '' : 'opacity-70'}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="text-xs text-muted">Fase 1 · 6 pólizas (90 días desde alta de clave)</div>
        <div className={`text-xs font-medium ${styles.text}`}>{formatCountdown(phase)}</div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-black/10 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${styles.bar}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="text-xs font-semibold text-text tabular-nums shrink-0">
          {phase.policies_count}/{phase.policies_target}
        </div>
      </div>
    </div>
  )
}

function Phase2Row({ phase, highlighted }: { phase: Phase2Status; highlighted: boolean }) {
  const styles = STATE_STYLES[phase.state]
  const pct = Math.round(phase.progress_ratio * 100)
  return (
    <div className={highlighted ? '' : 'opacity-70'}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="text-xs text-muted">Fase 2 · 12 pólizas acumuladas (90 días desde conexión)</div>
        <div className={`text-xs font-medium ${styles.text}`}>{formatCountdown(phase)}</div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-black/10 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${styles.bar}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="text-xs font-semibold text-text tabular-nums shrink-0">
          {phase.policies_count}/{phase.policies_target}
        </div>
      </div>
    </div>
  )
}
