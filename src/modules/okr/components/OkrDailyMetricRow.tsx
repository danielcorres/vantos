import { memo } from 'react'

export type OkrDailyMetricRowProps = {
  variant: 'card' | 'table'
  metricKey: string
  label: string
  pointsPerUnit: number
  value: number
  points: number
  inputDisplay: string
  saving: boolean
  rowIndex?: number
  onEntryChange: (metricKey: string, raw: string) => void
  onEntryBlur: (metricKey: string) => void
  onIncrement: (metricKey: string) => void
  onDecrement: (metricKey: string) => void
}

export const OkrDailyMetricRow = memo(function OkrDailyMetricRow({
  variant,
  metricKey,
  label,
  pointsPerUnit,
  value,
  points,
  inputDisplay,
  saving,
  rowIndex = 0,
  onEntryChange,
  onEntryBlur,
  onIncrement,
  onDecrement,
}: OkrDailyMetricRowProps) {
  const hasValue = value > 0

  const controls = (
    <div className="flex items-center gap-1.5 justify-end">
      <button
        type="button"
        onClick={() => onDecrement(metricKey)}
        disabled={saving || value === 0}
        className="w-11 h-11 flex items-center justify-center border border-border rounded-md text-text hover:bg-black/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        aria-label={`Decrementar ${label}`}
      >
        −
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={inputDisplay}
        onChange={(e) => onEntryChange(metricKey, e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={() => onEntryBlur(metricKey)}
        disabled={saving}
        className="scheme-light w-20 border border-border rounded-md bg-surface px-2 py-1.5 text-base text-right text-text focus:outline-none focus:ring-2 focus:ring-primary"
        placeholder="0"
        aria-label={`Cantidad para ${label}`}
      />
      <button
        type="button"
        onClick={() => onIncrement(metricKey)}
        disabled={saving}
        className="w-11 h-11 flex items-center justify-center border border-border rounded-md text-text hover:bg-black/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        aria-label={`Incrementar ${label}`}
      >
        +
      </button>
    </div>
  )

  if (variant === 'card') {
    return (
      <div
        className={`p-3 rounded-lg border border-border transition-colors ${
          hasValue ? 'bg-primary/5 border-primary/20' : 'bg-surface'
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex-1">
            <div className="font-medium text-sm mb-1">{label}</div>
            <div className="text-xs text-muted">Pts/u: {pointsPerUnit}</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold mb-1">{points} pts</div>
            {controls}
          </div>
        </div>
      </div>
    )
  }

  return (
    <tr
      className={`border-b border-border transition-colors ${
        rowIndex % 2 === 0 ? 'bg-surface' : 'bg-bg'
      } ${hasValue ? 'bg-primary/5' : ''} hover:bg-primary/10`}
    >
      <td className="py-2.5 px-4">
        <div className="font-medium text-sm">{label}</div>
      </td>
      <td className="py-2.5 px-4 text-right">
        <span className="text-xs text-muted">{pointsPerUnit}</span>
      </td>
      <td className="py-2.5 px-4">{controls}</td>
      <td className="py-2.5 px-4 text-right">
        <span className="text-sm font-bold">{points} pts</span>
      </td>
    </tr>
  )
})
