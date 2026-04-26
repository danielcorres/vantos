import {
  getAdvisorCampaignMonthLabel,
  getLevelConditions,
  formatValue,
} from '../utils/campaignProgress'
import { CampaignRewardBadge } from './CampaignRewardBadge'
import type { DashboardEntry, Campaign, DashboardLevelSummary } from '../domain/types'

interface CareerCampaignCardProps {
  entry: DashboardEntry
  campaign: Campaign
  levels: DashboardLevelSummary[]
}

export function CareerCampaignCard({ entry, campaign, levels }: CareerCampaignCardProps) {
  const monthLabel = getAdvisorCampaignMonthLabel(entry)
  const sortedLevels = [...levels].sort((a, b) => a.level_order - b.level_order)

  return (
    <div className="bg-surface dark:bg-neutral-800 border border-border dark:border-neutral-700 rounded-xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {campaign.color && (
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: campaign.color }}
            />
          )}
          <div>
            <h3 className="text-sm font-semibold text-text dark:text-neutral-100">{campaign.name}</h3>
            {monthLabel && (
              <p className="text-xs text-muted">{monthLabel}</p>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-xl font-bold text-text dark:text-neutral-100">
            {formatValue(entry.value)}
          </div>
          <div className="text-xs text-muted">{campaign.unit_label}</div>
        </div>
      </div>

      {/* Timeline de niveles */}
      <div className="space-y-2">
        {sortedLevels.map((level, idx) => {
          const reached = entry.value >= level.target_value
          const isCurrent = entry.current_level?.id === level.id
          const conditions = getLevelConditions(level)

          return (
            <div
              key={level.id}
              className={`flex items-start gap-3 p-2.5 rounded-lg border transition-colors ${
                isCurrent
                  ? 'border-primary/40 bg-primary/5 dark:bg-white/5'
                  : reached
                  ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/20'
                  : 'border-border dark:border-neutral-700 bg-transparent'
              }`}
            >
              {/* Indicador */}
              <div className={`mt-0.5 w-5 h-5 rounded-full shrink-0 flex items-center justify-center border-2 ${
                reached
                  ? 'border-emerald-500 bg-emerald-500'
                  : isCurrent
                  ? 'border-primary bg-white dark:bg-neutral-800'
                  : 'border-zinc-300 dark:border-zinc-600 bg-transparent'
              }`}>
                {reached && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>

              {/* Contenido */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-sm font-medium ${reached ? 'text-emerald-700 dark:text-emerald-300' : 'text-text dark:text-neutral-100'}`}>
                    {idx + 1}. {level.name}
                    {level.target_month && <span className="ml-1 text-xs font-normal text-muted">· Mes {level.target_month}</span>}
                  </span>
                  <span className="text-xs text-muted shrink-0">
                    Meta: {formatValue(level.target_value, campaign.unit_label)}
                  </span>
                </div>

                {level.reward_title && level.reward_is_active && (
                  <p className="text-xs text-muted mt-0.5 truncate" title={level.reward_title}>
                    Premio: {level.reward_title}
                  </p>
                )}

                {conditions.filter(c => c.required).length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {conditions.filter(c => c.required).map(c => (
                      <span key={c.key} className="inline-flex items-center text-xs px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700">
                        {c.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Premio actual */}
      {entry.award_status && (
        <CampaignRewardBadge
          status={entry.award_status}
          rewardTitle={entry.current_level?.reward_title}
        />
      )}
    </div>
  )
}
