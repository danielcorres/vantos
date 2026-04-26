import {
  getProgressPercent,
  getRemainingToNextLevel,
  getCurrentLevelLabel,
  getNextLevelLabel,
  formatValue,
} from '../utils/campaignProgress'
import { CampaignProgressBar } from './CampaignProgressBar'
import { CampaignRewardBadge } from './CampaignRewardBadge'
import { CampaignConditionsList } from './CampaignConditionsList'
import type { DashboardEntry, Campaign } from '../domain/types'

interface CampaignCardProps {
  entry: DashboardEntry
  campaign: Campaign
}

export function CampaignCard({ entry, campaign }: CampaignCardProps) {
  const percent = getProgressPercent(entry)
  const remaining = getRemainingToNextLevel(entry)
  const currentLevelLabel = getCurrentLevelLabel(entry)
  const nextLevelLabel = getNextLevelLabel(entry)

  return (
    <div className="bg-surface dark:bg-neutral-800 border border-border dark:border-neutral-700 rounded-xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {campaign.color && (
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: campaign.color }}
            />
          )}
          <h3 className="text-sm font-semibold text-text dark:text-neutral-100 truncate">
            {campaign.name}
          </h3>
        </div>
        {entry.ranking_position && (
          <span className="shrink-0 text-xs font-medium text-muted">
            #{entry.ranking_position} de {entry.ranking_total}
          </span>
        )}
      </div>

      {/* Valor actual */}
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-bold text-text dark:text-neutral-100">
          {formatValue(entry.value)}
        </span>
        <span className="text-sm text-muted">{campaign.unit_label}</span>
      </div>

      {/* Barra de progreso */}
      <CampaignProgressBar percent={percent} color={campaign.color ?? '#3B82F6'} />

      {/* Niveles */}
      <div className="flex items-center justify-between text-xs text-muted">
        <span>Nivel: <span className="font-medium text-text dark:text-neutral-200">{currentLevelLabel}</span></span>
        {nextLevelLabel && remaining > 0 && (
          <span>
            Faltan <span className="font-medium text-text dark:text-neutral-200">
              {formatValue(remaining, campaign.unit_label)}
            </span> para <span className="font-medium">{nextLevelLabel}</span>
          </span>
        )}
        {entry.is_max_reached && (
          <span className="text-emerald-600 font-medium">¡Nivel máximo alcanzado!</span>
        )}
      </div>

      {/* Condiciones del nivel actual */}
      {entry.current_level && (
        <CampaignConditionsList level={entry.current_level} />
      )}

      {/* Premio */}
      {entry.award_status && (
        <CampaignRewardBadge
          status={entry.award_status}
          rewardTitle={entry.current_level?.reward_title}
        />
      )}
    </div>
  )
}
