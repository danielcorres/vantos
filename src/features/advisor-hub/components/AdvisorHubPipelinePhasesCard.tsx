import { Info } from 'lucide-react'
import { Link } from 'react-router-dom'
import { displayStageName } from '../../../shared/utils/stageStyles'
import type { PipelineStage } from '../../pipeline/pipeline.api'
import type { StageSlug } from '../../productivity/types/productivity.types'
import {
  formatPipelineWeeklyTargetDisplay,
  weeklyTargetForPipelineSlug,
} from '../../pipeline/utils/weeklyStageTargets'
import type { WeeklyMinimumTargetsMap } from '../../../modules/okr/dashboard/weeklyMinimumTargets'
import { HUB_CARD, HUB_SECTION_TITLE } from '../hubStyles'
import { PIPELINE_PHASE_1_SLUGS, PIPELINE_PHASE_2_SLUGS } from '../constants'

const EMBUDO_HUB_INFO_TITLE =
  'Ventana America/Monterrey (lunes a domingo). El número y la barra comparan entradas a la etapa en esa semana con el mínimo OKR. «En pipeline ahora» es el inventario de leads activos en la columna al cargar la página. Fuente de entradas: historial de movimientos entre etapas (misma lógica que Productividad). Para mantener estos conteos alineados, al retroceder un lead solo se permite ir a la etapa inmediatamente anterior (no saltar varias columnas hacia atrás de una vez).'

type Props = {
  stageBySlug: Map<string, PipelineStage>
  /** Leads activos actualmente en cada etapa (conteo por stage_id). */
  inventoryCountsByStageId: Record<string, number>
  /** Entradas a etapa en la semana (lun–dom), misma fuente que Productividad / lead_stage_history. */
  weeklyEntryCountsBySlug: Record<StageSlug, number>
  /** Lunes de la semana en YYYY-MM-DD (alineado con Productividad y filtro de Pipeline). */
  hubWeekStartYmd: string
  targetsMap: WeeklyMinimumTargetsMap
}

function PhaseColumn({
  title,
  description,
  slugs,
  stageBySlug,
  inventoryCountsByStageId,
  weeklyEntryCountsBySlug,
  hubWeekStartYmd,
  targetsMap,
}: {
  title: string
  description: string
  slugs: StageSlug[]
  stageBySlug: Map<string, PipelineStage>
  inventoryCountsByStageId: Record<string, number>
  weeklyEntryCountsBySlug: Record<StageSlug, number>
  hubWeekStartYmd: string
  targetsMap: WeeklyMinimumTargetsMap
}) {
  return (
    <div className="min-w-0 flex flex-col gap-3 rounded-xl border border-neutral-100 bg-neutral-50/40 p-3 sm:p-4 dark:border-neutral-800/60 dark:bg-neutral-900/30">
      <div>
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{title}</h3>
        <p className="mt-0.5 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">{description}</p>
      </div>
      <ul className="space-y-1">
        {slugs.map((slug) => {
          const st = stageBySlug.get(slug)
          if (!st) return null
          const weeklyCount = weeklyEntryCountsBySlug[slug] ?? 0
          const inventoryCount = inventoryCountsByStageId[st.id] ?? 0
          const target = weeklyTargetForPipelineSlug(slug, targetsMap)
          const metaCumplida = target == null || weeklyCount >= target
          const pendiente = target != null && weeklyCount < target
          const barPct = target != null && target > 0 ? Math.min(100, (weeklyCount / target) * 100) : 0
          return (
            <li key={slug}>
              <Link
                to={`/pipeline?stage=${encodeURIComponent(slug)}&weekStart=${encodeURIComponent(hubWeekStartYmd)}`}
                className={`group block rounded-lg px-2 py-2 text-sm transition-colors hover:bg-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 dark:hover:bg-neutral-800/60 ${
                  pendiente ? 'bg-sky-50/90 dark:bg-sky-950/25' : ''
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 font-medium text-neutral-800 dark:text-neutral-100">
                    {displayStageName(st.name)}
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
                    <span className="flex flex-wrap items-center justify-end gap-2">
                      <span
                        className={
                          pendiente
                            ? 'tabular-nums font-semibold text-sky-700 dark:text-sky-300'
                            : target != null
                              ? 'tabular-nums font-semibold text-emerald-700 dark:text-emerald-400'
                              : 'tabular-nums text-neutral-700 dark:text-neutral-300'
                        }
                      >
                        {weeklyCount}
                        {target != null ? (
                          <>
                            {' / '}
                            {formatPipelineWeeklyTargetDisplay(slug, target)}
                            {metaCumplida ? <span className="text-emerald-700 dark:text-emerald-400"> ✓</span> : null}
                          </>
                        ) : null}
                      </span>
                      {pendiente ? (
                        <span className="rounded-md bg-sky-100/90 px-1.5 py-0.5 text-[11px] font-medium text-sky-800 dark:bg-sky-900/40 dark:text-sky-200">
                          Pendiente
                        </span>
                      ) : null}
                      <span className="text-[11px] font-medium text-neutral-500 group-hover:text-neutral-800 dark:text-neutral-400 dark:group-hover:text-neutral-200">
                        Pipeline →
                      </span>
                    </span>
                    <span className="tabular-nums text-[11px] text-neutral-500 dark:text-neutral-400">
                      En pipeline ahora: {inventoryCount}
                    </span>
                  </span>
                </div>
                {target != null ? (
                  <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-neutral-200/90 dark:bg-neutral-800">
                    <div
                      className={`h-full rounded-full transition-[width] duration-300 ${
                        metaCumplida ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-sky-500 dark:bg-sky-400'
                      }`}
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                ) : null}
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function AdvisorHubPipelinePhasesCard({
  stageBySlug,
  inventoryCountsByStageId,
  weeklyEntryCountsBySlug,
  hubWeekStartYmd,
  targetsMap,
}: Props) {
  return (
    <section className={`${HUB_CARD} col-span-12`}>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            <h2 className={HUB_SECTION_TITLE}>Embudo vs. meta semanal</h2>
            <button
              type="button"
              className="inline-flex shrink-0 rounded-full p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
              aria-label={EMBUDO_HUB_INFO_TITLE}
              title={EMBUDO_HUB_INFO_TITLE}
            >
              <Info className="h-4 w-4" strokeWidth={2} aria-hidden />
            </button>
          </div>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            Entradas semanales vs. meta OKR e inventario por etapa.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={`/productividad?weekStart=${encodeURIComponent(hubWeekStartYmd)}`}
            className="inline-flex items-center rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
          >
            Productividad
          </Link>
          <Link
            to="/pipeline"
            className="inline-flex items-center rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
          >
            Pipeline
          </Link>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <PhaseColumn
          title="Áreas de Prospección y Conversión"
          description="Contactos nuevos, citas agendadas y casos abiertos."
          slugs={PIPELINE_PHASE_1_SLUGS}
          stageBySlug={stageBySlug}
          inventoryCountsByStageId={inventoryCountsByStageId}
          weeklyEntryCountsBySlug={weeklyEntryCountsBySlug}
          hubWeekStartYmd={hubWeekStartYmd}
          targetsMap={targetsMap}
        />
        <PhaseColumn
          title="Alta Productividad y Resultados"
          description="Citas de cierre, solicitudes ingresadas y pólizas pagadas."
          slugs={PIPELINE_PHASE_2_SLUGS}
          stageBySlug={stageBySlug}
          inventoryCountsByStageId={inventoryCountsByStageId}
          weeklyEntryCountsBySlug={weeklyEntryCountsBySlug}
          hubWeekStartYmd={hubWeekStartYmd}
          targetsMap={targetsMap}
        />
      </div>
    </section>
  )
}
