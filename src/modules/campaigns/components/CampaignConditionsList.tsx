import { getLevelConditions, levelHasConditions } from '../utils/campaignProgress'
import type { DashboardLevelSummary } from '../domain/types'

interface CampaignConditionsListProps {
  level: DashboardLevelSummary
}

export function CampaignConditionsList({ level }: CampaignConditionsListProps) {
  if (!levelHasConditions(level)) return null
  const conditions = getLevelConditions(level)

  return (
    <div className="mt-2 space-y-1">
      <p className="text-xs font-medium text-muted uppercase tracking-wide">Condiciones</p>
      <ul className="space-y-1">
        {conditions.filter(c => c.required).map(c => (
          <li key={c.key} className="flex items-start gap-1.5 text-xs text-text dark:text-neutral-200">
            <span className="mt-0.5 shrink-0 w-3.5 h-3.5 rounded-full border border-amber-400 bg-amber-50 flex items-center justify-center">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            </span>
            <span>{c.description ?? c.label}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
