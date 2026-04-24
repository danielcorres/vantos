import { Link } from 'react-router-dom'
import { displayStageName } from '../../../shared/utils/stageStyles'
import type { PipelineStage } from '../../pipeline/pipeline.api'
import type { StageSlug } from '../../productivity/types/productivity.types'
import {
  formatPipelineWeeklyTargetDisplay,
  pipelineTargetIsWeeklyPremiumMxn,
  weeklyTargetForPipelineSlug,
} from '../../pipeline/utils/weeklyStageTargets'
import type { WeeklyMinimumTargetsMap } from '../../../modules/okr/dashboard/weeklyMinimumTargets'
import { HUB_CARD, HUB_SECTION_TITLE } from '../hubStyles'
import { PIPELINE_PHASE_1_SLUGS, PIPELINE_PHASE_2_SLUGS } from '../constants'

type Props = {
  stageBySlug: Map<string, PipelineStage>
  countsByStageId: Record<string, number>
  targetsMap: WeeklyMinimumTargetsMap
}

function PhaseColumn({
  title,
  description,
  slugs,
  stageBySlug,
  countsByStageId,
  targetsMap,
}: {
  title: string
  description: string
  slugs: StageSlug[]
  stageBySlug: Map<string, PipelineStage>
  countsByStageId: Record<string, number>
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
          const count = countsByStageId[st.id] ?? 0
          const target = weeklyTargetForPipelineSlug(slug, targetsMap)
          const bajo =
            target != null && !pipelineTargetIsWeeklyPremiumMxn(slug) && count < target
          return (
            <li key={slug}>
              <Link
                to="/pipeline"
                className="group flex flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-white/80 dark:hover:bg-neutral-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300"
              >
                <span className="font-medium text-neutral-800 dark:text-neutral-100">
                  {displayStageName(st.name)}
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  <span
                    className={
                      bajo
                        ? 'tabular-nums font-semibold text-amber-800 dark:text-amber-200/90'
                        : 'tabular-nums text-neutral-700 dark:text-neutral-300'
                    }
                  >
                    {count}
                    {target != null ? (
                      <>
                        {' / '}
                        {formatPipelineWeeklyTargetDisplay(slug, target)}
                        {!pipelineTargetIsWeeklyPremiumMxn(slug) && !bajo ? (
                          <span className="text-emerald-700 dark:text-emerald-400"> ✓</span>
                        ) : null}
                      </>
                    ) : null}
                  </span>
                  {bajo ? (
                    <span className="text-[11px] font-medium text-amber-800 dark:text-amber-200/90">
                      Bajo meta
                    </span>
                  ) : null}
                  <span className="text-[11px] font-medium text-neutral-500 group-hover:text-neutral-800 dark:text-neutral-400 dark:group-hover:text-neutral-200">
                    Pipeline →
                  </span>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function AdvisorHubPipelinePhasesCard({ stageBySlug, countsByStageId, targetsMap }: Props) {
  return (
    <section className={`${HUB_CARD} col-span-12`}>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className={`${HUB_SECTION_TITLE}`}>Embudo vs. meta semanal</h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            Conteo en etapa frente a mínimos OKR de la semana.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/productividad"
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
          title="Fase 1"
          description="Prospección y conversión temprana."
          slugs={PIPELINE_PHASE_1_SLUGS}
          stageBySlug={stageBySlug}
          countsByStageId={countsByStageId}
          targetsMap={targetsMap}
        />
        <PhaseColumn
          title="Fase 2"
          description="Cierre e ingreso de negocio."
          slugs={PIPELINE_PHASE_2_SLUGS}
          stageBySlug={stageBySlug}
          countsByStageId={countsByStageId}
          targetsMap={targetsMap}
        />
      </div>
    </section>
  )
}
