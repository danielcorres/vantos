import { Link } from 'react-router-dom'
import type { AdvisorMilestoneStatus, MilestoneState } from '../../../modules/advisors/domain/advisorMilestones'
import { formatDateMX } from '../../../shared/utils/dates'
import { HUB_CARD, HUB_SECTION_TITLE } from '../hubStyles'

function milestoneStateLabel(state: MilestoneState): string {
  switch (state) {
    case 'completed':
      return 'Completado'
    case 'overdue':
      return 'Vencido'
    case 'at_risk':
      return 'En riesgo'
    case 'in_progress':
      return 'En curso'
    case 'not_started':
    default:
      return 'Sin iniciar'
  }
}

function ProgressBar({ ratio, state }: { ratio: number; state: MilestoneState }) {
  const pct = Math.round(Math.min(1, Math.max(0, ratio)) * 100)
  const full = ratio >= 1 || state === 'completed'
  const bar = full ? 'bg-emerald-600 dark:bg-emerald-400' : 'bg-sky-600 dark:bg-sky-400'
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
      <div className={`h-full rounded-full transition-[width] duration-500 ${bar}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

type Props = {
  status: AdvisorMilestoneStatus
  loadError: string | null
}

export function AdvisorHubMilestones12mCard({ status, loadError }: Props) {
  const { phase1, phase2, current_phase } = status

  return (
    <section className={`${HUB_CARD} col-span-12`}>
      <div className="mb-4 flex flex-col gap-2 border-b border-neutral-100 pb-4 dark:border-neutral-800/80 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className={`${HUB_SECTION_TITLE}`}>Hitos pólizas de vida (12 meses)</h2>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
            Fase 1: 6 pólizas en 90 días desde alta de clave. Fase 2: 12 acumuladas en la ventana definida. Datos según tu
            perfil y registro de pólizas.
          </p>
        </div>
        {current_phase === 'done' ? (
          <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200">
            Hitos completados
          </span>
        ) : null}
      </div>

      {loadError ? (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
          {loadError}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Fase 1</h3>
            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              {milestoneStateLabel(phase1.state)}
            </span>
          </div>
          <p className="text-2xl font-semibold tabular-nums tracking-tight text-neutral-900 dark:text-neutral-50">
            {phase1.policies_count}
            <span className="text-base font-normal text-neutral-400 dark:text-neutral-500">
              {' '}
              / {phase1.policies_target}
            </span>
          </p>
          <ProgressBar ratio={phase1.progress_ratio} state={phase1.state} />
          {phase1.deadline_ymd ? (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Plazo: {formatDateMX(phase1.deadline_ymd)}
              {phase1.days_remaining != null && phase1.state !== 'completed' && phase1.state !== 'overdue' ? (
                <> · {phase1.days_remaining} días restantes</>
              ) : null}
              {phase1.days_overdue != null && phase1.days_overdue > 0 ? (
                <> · {phase1.days_overdue} días de retraso</>
              ) : null}
            </p>
          ) : null}
        </div>

        <div className="space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Fase 2</h3>
            <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              {milestoneStateLabel(phase2.state)}
            </span>
          </div>
          <p className="text-2xl font-semibold tabular-nums tracking-tight text-neutral-900 dark:text-neutral-50">
            {phase2.policies_count}
            <span className="text-base font-normal text-neutral-400 dark:text-neutral-500">
              {' '}
              / {phase2.policies_target}
            </span>
          </p>
          <ProgressBar ratio={phase2.progress_ratio} state={phase2.state} />
          {phase2.deadline_ymd ? (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Plazo: {formatDateMX(phase2.deadline_ymd)}
              {phase2.days_remaining != null && phase2.state !== 'completed' && phase2.state !== 'overdue' ? (
                <> · {phase2.days_remaining} días restantes</>
              ) : null}
              {phase2.days_overdue != null && phase2.days_overdue > 0 ? (
                <> · {phase2.days_overdue} días de retraso</>
              ) : null}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-6 border-t border-neutral-100 pt-5 dark:border-neutral-800/80">
        <h3 className={`${HUB_SECTION_TITLE} mb-3`}>Seguimiento avanzado</h3>
        <div className="flex flex-wrap gap-2">
          {[
            { to: '/productividad', label: 'Productividad' },
            { to: '/week', label: 'OKR semana' },
            { to: '/calendar', label: 'Calendario' },
            { to: '/pipeline', label: 'Pipeline' },
            { to: '/profile', label: 'Mi perfil' },
          ].map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="inline-flex items-center rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-800 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
