import { displayStageName } from '../../shared/utils/stageStyles'

export type PipelineStageLite = { id: string; name: string; position: number }

/** Progreso visual: ● etapa actual, ○ resto (orden por position). */
export function LeadProgressDots({
  stages,
  currentStageId,
  className = '',
}: {
  stages: PipelineStageLite[]
  currentStageId: string | null | undefined
  className?: string
}) {
  const sorted = [...stages].sort((a, b) => a.position - b.position)
  if (!sorted.length) return <span className="text-neutral-300">—</span>
  return (
    <span className={`inline-flex items-center gap-0.5 text-neutral-400 ${className}`} aria-hidden>
      {sorted.map((s) => (
        <span
          key={s.id}
          className={s.id === currentStageId ? 'text-neutral-700' : ''}
          title={displayStageName(s.name)}
        >
          {s.id === currentStageId ? '●' : '○'}
        </span>
      ))}
    </span>
  )
}
