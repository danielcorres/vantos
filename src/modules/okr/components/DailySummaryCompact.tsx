import type { PointsProgress } from '../data/okrQueries'

type DailySummaryCompactProps = {
  progress: PointsProgress
  streak?: {
    streak_days: number
    is_alive: boolean
    grace_days_left: number
  } | null
}

export function DailySummaryCompact({ progress, streak }: DailySummaryCompactProps) {
  const { current_points, base_target } = progress
  const progressPercent = Math.min((current_points / base_target) * 100, 100)

  // Color de barra
  const getBarColor = () => {
    if (current_points >= base_target) return '#22c55e' // green
    if (current_points >= base_target * 0.7) return '#eab308' // yellow
    if (current_points >= 10) return '#f97316' // orange
    return '#6b7280' // gray
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold">Hoy</h2>
        {streak && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted">Racha</span>
            {streak.is_alive ? (
              <span className="text-sm">🔥</span>
            ) : (
              <span className="text-sm text-danger">💔</span>
            )}
            <span className="text-sm font-bold">{streak.streak_days}</span>
          </div>
        )}
      </div>

      {/* Mensaje de racha */}
      {streak && (
        <div className="mb-3">
          {streak.is_alive && streak.grace_days_left === 1 && (
            <div className="text-xs text-warning font-medium p-2 bg-yellow-50 border border-yellow-200 rounded">
              Solo hay un día de tolerancia. Registra para no romper tu racha.
            </div>
          )}
          {streak.is_alive && streak.grace_days_left === 0 && (
            <div className="text-xs text-green-600 font-medium">
              Vas al día. Mantén la racha.
            </div>
          )}
          {!streak.is_alive && (
            <div className="text-xs text-danger font-medium p-2 bg-red-50 border border-red-200 rounded">
              Racha rota. Reinicia hoy.
            </div>
          )}
        </div>
      )}

      {/* Progress info */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-3xl font-black">{current_points} pts</div>
          <div className="text-xs text-muted mt-0.5">Meta: {base_target} pts</div>
        </div>
        {current_points >= base_target && (
          <span className="text-2xl">✅</span>
        )}
      </div>

      {/* Barra compacta */}
      <div className="relative h-8 bg-bg rounded-md overflow-hidden mb-3 shadow-inner">
        <div
          className="absolute left-0 top-0 h-full transition-all duration-300"
          style={{
            width: `${progressPercent}%`,
            background: getBarColor(),
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-text">
          {current_points >= base_target ? (
            'Meta cumplida ✓'
          ) : (
            `${Math.round(progressPercent)}%`
          )}
        </div>
      </div>

    </div>
  )
}
