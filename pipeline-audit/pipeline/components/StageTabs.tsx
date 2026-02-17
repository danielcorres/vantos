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
      className="inline-flex flex-wrap gap-0.5 rounded-lg border border-neutral-200 bg-neutral-100 p-0.5"
      role="tablist"
      aria-label="Filtrar por etapa"
    >
      <button
        type="button"
        role="tab"
        aria-selected={selectedStageTab === 'all'}
        onClick={() => onSelect('all')}
        className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors ${
          selectedStageTab === 'all'
            ? 'bg-white font-medium text-neutral-900 ring-1 ring-neutral-200 shadow-sm'
            : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200/60 hover:text-neutral-700'
        }`}
      >
        Todos
        <span className="tabular-nums text-xs text-neutral-500">
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
            className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors ${
              selected
                ? 'bg-white font-medium text-neutral-900 ring-1 ring-neutral-200 shadow-sm'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200/60 hover:text-neutral-700'
            }`}
          >
            {displayStageName(stage.name)}
            <span className="tabular-nums text-xs text-neutral-500">
              {count}
            </span>
          </button>
        )
      })}
    </div>
  )
}
