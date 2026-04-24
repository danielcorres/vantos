import { Link } from 'react-router-dom'
import type { Lead, PipelineStage } from '../../pipeline/pipeline.api'
import { displayStageName } from '../../../shared/utils/stageStyles'
import { diffDaysFloor } from '../../../shared/utils/dates'
import { HUB_CARD, HUB_SECTION_TITLE } from '../hubStyles'

type Props = {
  leads: Lead[]
  /** Total de activos sin próxima cita (puede ser mayor que leads.length). */
  totalSinCita: number
  stages: PipelineStage[]
  onAgendar: (leadId: string) => void
}

export function AdvisorHubUrgentLeadsCard({ leads, totalSinCita, stages, onAgendar }: Props) {
  const hasMore = totalSinCita > leads.length

  return (
    <section
      className={`${HUB_CARD} col-span-12 w-full min-w-0 md:col-span-5 flex flex-col min-h-0 md:min-h-[11rem] !border-amber-200/90 !bg-amber-50/55 shadow-amber-900/[0.06] dark:!border-amber-800/55 dark:!bg-amber-950/30 dark:shadow-none`}
    >
      <h2 className={`${HUB_SECTION_TITLE} mb-2`}>Contactos listos para agendar</h2>
      {totalSinCita > 0 ? (
        <p className="mb-3 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
          Prioriza agendar: un embudo de <span className="font-medium text-neutral-800 dark:text-neutral-200">Contactos</span> con
          volumen evita que se enfríe el seguimiento.
        </p>
      ) : (
        <p className="mb-3 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
          Mantén la etapa <span className="font-medium text-neutral-800 dark:text-neutral-200">Contactos</span> con volumen: un
          embudo lleno evita que se enfríe el seguimiento.
        </p>
      )}
      {totalSinCita === 0 ? (
        <p className="flex-1 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
          No hay contactos pendientes de agendar en este momento.
        </p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <ul className="max-h-[min(22rem,45vh)] min-h-0 space-y-3 overflow-y-auto pr-0.5">
            {leads.map((lead) => {
              const stName = stages.find((s) => s.id === lead.stage_id)?.name ?? '—'
              const dias = diffDaysFloor(lead.stage_changed_at, new Date())
              return (
                <li
                  key={lead.id}
                  className="flex flex-col gap-2 rounded-xl border border-amber-100 bg-white/85 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between dark:border-amber-900/40 dark:bg-neutral-950/40"
                >
                  <div className="min-w-0 break-words text-sm text-neutral-700 dark:text-neutral-200">
                    <span className="font-medium">{lead.full_name}</span>
                    <span className="text-neutral-400 dark:text-neutral-500"> · </span>
                    <span>{displayStageName(stName)}</span>
                    <span className="text-neutral-400 dark:text-neutral-500"> · </span>
                    <span className="font-medium text-yellow-800 dark:text-yellow-200">{dias} días sin cita</span>
                  </div>
                  <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                    <button
                      type="button"
                      onClick={() => onAgendar(lead.id)}
                      className="w-full rounded-xl bg-amber-500 px-3 py-2 text-xs font-semibold text-neutral-900 shadow-sm hover:bg-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-amber-50 dark:bg-amber-500 dark:text-neutral-950 dark:hover:bg-amber-400 dark:focus-visible:ring-amber-400 dark:focus-visible:ring-offset-amber-950/50 sm:w-auto sm:py-1.5"
                    >
                      Agendar
                    </button>
                    <Link
                      to={`/leads/${lead.id}`}
                      className="inline-flex w-full items-center justify-center rounded-xl border border-amber-200/80 bg-white/90 px-3 py-2 text-xs font-medium text-neutral-800 hover:bg-amber-50/80 sm:w-auto sm:border-0 sm:bg-transparent sm:py-0 sm:underline sm:underline-offset-2 dark:border-amber-800/50 dark:bg-transparent dark:text-neutral-100 dark:hover:bg-transparent sm:dark:border-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60"
                    >
                      Ver lead
                    </Link>
                  </div>
                </li>
              )
            })}
          </ul>
          {hasMore ? (
            <p className="text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
              Hay {totalSinCita} contactos listos para agendar; aquí los {leads.length} más prioritarios.{' '}
              <Link
                to="/pipeline"
                className="font-medium text-neutral-800 underline-offset-2 hover:underline dark:text-neutral-200"
              >
                Ir al pipeline
              </Link>
            </p>
          ) : null}
        </div>
      )}
    </section>
  )
}
