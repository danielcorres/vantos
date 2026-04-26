interface CampaignProgressBarProps {
  percent: number
  color?: string
  showLabel?: boolean
}

export function CampaignProgressBar({
  percent,
  color = '#3B82F6',
  showLabel = false,
}: CampaignProgressBarProps) {
  const clipped = Math.min(100, Math.max(0, percent))

  return (
    <div className="relative w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${clipped}%`, backgroundColor: color }}
      />
      {showLabel && (
        <span className="absolute right-0 top-3 text-xs text-muted">
          {clipped}%
        </span>
      )}
    </div>
  )
}
