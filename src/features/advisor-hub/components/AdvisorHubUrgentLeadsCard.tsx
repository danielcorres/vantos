import { Link } from 'react-router-dom'
import type { Lead, PipelineStage } from '../../pipeline/pipeline.api'
import { displayStageName } from '../../../shared/utils/stageStyles'
import { diffDaysFloor } from '../../../shared/utils/dates'
import { HUB_CARD, HUB_SECTION_TITLE } from '../hubStyles'

type Props = {
  leads: Lead[]
  stages: PipelineStage[]
  onAgendar: (leadId: string) => void
}

export function AdvisorHubUrgentLeadsCard({ leads, stages, onAgendar }: Props) {
  return (
    <section className={`${HUB_CARD} md:col-span-5 flex flex-col min-h-[11rem]`}>
      <h2 className={`${HUB_SECTION_TITLE} mb-4`}>Leads sin cita (urgentes)</h2>
      {leads.length === 0 ? (
        <p className="flex-1 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
          Todos los leads activos tienen al menos una cita programada.
        </p>
      ) : (
        <ul className="space-y-3">
          {leads.map((lead) => {
            const stName = stages.find((s) => s.id === lead.stage_id)?.name ?? '—'
            const dias = diffDaysFloor(lead.stage_changed_at, new Date())
            return (
              <li
                key={lead.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-100 bg-neutral-50/50 px-3 py-2.5 dark:border-neutral-800/80 dark:bg-neutral-900/35"
              >
                <div className="min-w-0 text-sm text-neutral-700 dark:text-neutral-200">
                  <span className="font-medium">{lead.full_name}</span>
                  <span className="text-neutral-400 dark:text-neutral-500"> · </span>
                  <span>{displayStageName(stName)}</span>
                  <span className="text-neutral-400 dark:text-neutral-500"> · </span>
                  <span className="font-medium text-amber-800 dark:text-amber-200/90">{dias} días sin cita</span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onAgendar(lead.id)}
                    className="rounded-xl bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
                  >
                    Agendar
                  </button>
                  <Link
                    to={`/leads/${lead.id}`}
                    className="text-xs font-medium text-neutral-700 underline-offset-2 hover:underline dark:text-neutral-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 rounded-sm"
                  >
                    Ver lead
                  </Link>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
