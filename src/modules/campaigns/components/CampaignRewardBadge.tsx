import { getAwardStatusLabel, getAwardStatusColor } from '../utils/campaignProgress'
import type { AwardStatus } from '../domain/types'

interface CampaignRewardBadgeProps {
  status: AwardStatus | null | undefined
  rewardTitle?: string | null
}

export function CampaignRewardBadge({ status, rewardTitle }: CampaignRewardBadgeProps) {
  if (!status) return null

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getAwardStatusColor(status)}`}>
        {getAwardStatusLabel(status)}
      </span>
      {rewardTitle && (
        <span className="text-xs text-muted truncate max-w-[180px]" title={rewardTitle}>
          {rewardTitle}
        </span>
      )}
    </div>
  )
}
