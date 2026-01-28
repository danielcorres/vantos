import { displayStageName } from '../../../shared/utils/stageStyles'
import type { Lead } from '../pipeline.api'

type Stage = { id: string; name: string; position: number }

type StageTabsProps = {
  stages: Stage[]
  leads: Lead[]
  selectedStageTab: 'all' | string
  onSelect: (tab: 'all' | string) => void
}

export function StageTabs({ stages, leads, selectedStageTab, onSelect }: StageTabsProps) {
  return (
    <div
      className="inline-flex flex-wrap rounded-lg border border-border bg-neutral-100/80 p-0.5 gap-0.5"
      role="tablist"
      aria-label="Filtrar por etapa"
    >
      <button
        type="button"
        role="tab"
        aria-selected={selectedStageTab === 'all'}
        onClick={() => onSelect('all')}
        className={`px-3 py-1.5 text-sm rounded-md inline-flex items-center gap-1.5 ${
          selectedStageTab === 'all'
            ? 'bg-white text-neutral-900 ring-1 ring-neutral-200 font-medium'
            : 'bg-neutral-100 text-neutral-600 ring-1 ring-neutral-200 hover:bg-neutral-200/60'
        }`}
      >
        Todos
        <span className="rounded-full text-xs px-2 py-0.5 bg-neutral-200 text-neutral-700 ring-1 ring-neutral-300 tabular-nums">
          {leads.length}
        </span>
      </button>
      {stages.map((stage) => {
        const count = leads.filter((l) => l.stage_id === stage.id).length
        const selected = selectedStageTab === stage.id
        return (
          <button
            key={stage.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onSelect(stage.id)}
            className={`px-3 py-1.5 text-sm rounded-md inline-flex items-center gap-1.5 ${
              selected
                ? 'bg-white text-neutral-900 ring-1 ring-neutral-200 font-medium'
                : 'bg-neutral-100 text-neutral-600 ring-1 ring-neutral-200 hover:bg-neutral-200/60'
            }`}
          >
            {displayStageName(stage.name)}
            <span className="rounded-full text-xs px-2 py-0.5 bg-neutral-200 text-neutral-700 ring-1 ring-neutral-300 tabular-nums">
              {count}
            </span>
          </button>
        )
      })}
    </div>
  )
}
