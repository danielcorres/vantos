import type { PointsProgress, OkrTier } from '../data/okrQueries'

type DailyGoalProgressProps = {
  progress: PointsProgress
  tiers?: OkrTier[]
}

export function DailyGoalProgress({ progress, tiers = [] }: DailyGoalProgressProps) {
  const { current_points, base_target, stretch_target, extra_points } = progress

  // Calcular progreso (nunca más de 100%) - SOLO para la barra visual
  const progressPercent = Math.min(Math.floor((current_points / base_target) * 100), 100)

  // Obtener tier basado en PUNTOS (no porcentaje)
  const getTier = (): OkrTier | null => {
    if (tiers.length === 0) {
      // Fallback si no hay tiers (basado en puntos)
      if (current_points === 0) {
        return {
          key: 'warmup',
          min: 0,
          max: 24,
          label: 'Primera acción',
          message: 'Haz la primera acción: 1 llamada.',
          tone: 'neutral',
          color: 'slate',
        }
      }
      if (current_points >= base_target) {
        return {
          key: 'expected',
          min: base_target,
          max: base_target * 2,
          label: 'Meta cumplida',
          message: 'Excelente. Ya estás en el estándar del día.',
          tone: 'success',
          color: 'green',
        }
      }
      return {
        key: 'momentum',
        min: 1,
        max: base_target - 1,
        label: 'En camino',
        message: `A ${base_target - current_points} pts del día esperado.`,
        tone: 'info',
        color: 'blue',
      }
    }

    // Buscar tier que contenga current_points (tiers están en puntos)
    for (const tier of tiers) {
      if (current_points >= tier.min && current_points <= tier.max) {
        return tier
      }
    }

    // Si no se encuentra ningún tier que contenga current_points:
    // - Si current_points es menor que el mínimo de todos los tiers, usar el tier más bajo
    // - Si current_points es mayor que el máximo de todos los tiers, usar el tier más alto
    const sortedTiers = [...tiers].sort((a, b) => a.min - b.min)
    const minTier = sortedTiers[0]
    const maxTier = sortedTiers[sortedTiers.length - 1]

    if (current_points < minTier.min) {
      return minTier
    }
    if (current_points > maxTier.max) {
      return maxTier
    }

    // Fallback: usar el primer tier
    return tiers[0] || null
  }

  const tier = getTier()

  // Colores según tier
  const getBarColor = () => {
    if (!tier) return '#6b7280'
    const colorMap: Record<string, string> = {
      slate: '#64748b',
      gray: '#6b7280',
      blue: '#3b82f6',
      green: '#22c55e',
      yellow: '#eab308',
      amber: '#f59e0b',
      orange: '#f97316',
      purple: '#9333ea',
    }
    return colorMap[tier.color] || '#6b7280'
  }

  const getTierColorClass = () => {
    if (!tier) return 'text-gray-600'
    const classMap: Record<string, string> = {
      slate: 'text-slate-600',
      gray: 'text-gray-600',
      blue: 'text-blue-600',
      green: 'text-green-600',
      yellow: 'text-yellow-600',
      amber: 'text-amber-600',
      orange: 'text-orange-600',
      purple: 'text-purple-600',
    }
    return classMap[tier.color] || 'text-gray-600'
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-sm font-semibold mb-1">Progreso del día</div>
          <div className="flex items-center gap-2">
            <div className="text-2xl font-black">{current_points} pts</div>
            {current_points >= base_target && (
              <span className="text-lg">✅</span>
            )}
            {current_points >= base_target * 2 && (
              <span className="text-lg">🔥</span>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted mb-1">Meta esperada</div>
          <div className="text-lg font-semibold">{base_target} pts</div>
        </div>
      </div>

      {/* Barra de progreso */}
      <div className="relative h-10 bg-bg rounded-lg overflow-hidden mb-3 shadow-inner">
        {/* Barra de progreso (nunca más de 100%) */}
        <div
          className="absolute left-0 top-0 h-full transition-all duration-500 ease-out"
          style={{
            width: `${progressPercent}%`,
            background: getBarColor(),
          }}
        />
        {/* Texto sobre la barra */}
        <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-text">
          {current_points >= base_target ? (
            <span className="flex items-center gap-1.5">
              <span>✓</span>
              <span>Meta esperada cumplida</span>
            </span>
          ) : (
            <span>
              {progressPercent}%
            </span>
          )}
        </div>
      </div>

      {/* Mensaje motivacional basado en tier */}
      {tier && (
        <div className="mb-2">
          <div className={`text-sm font-semibold mb-1 ${getTierColorClass()}`}>
            {tier.label}
          </div>
          <div className={`text-xs ${getTierColorClass()}`}>
            {tier.message}
          </div>
        </div>
      )}

      {/* Info adicional */}
      <div className="flex items-center justify-between text-xs text-muted">
        <span>Techo: {stretch_target} pts</span>
        {extra_points > 0 && (
          <span className="text-primary font-semibold">+{extra_points} pts extra</span>
        )}
      </div>
    </div>
  )
}
