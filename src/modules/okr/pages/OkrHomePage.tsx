import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { okrQueries, type PointsProgress } from '../data/okrQueries'
import { DailySummaryCompact } from '../components/DailySummaryCompact'
import { isNetworkError, isAuthError, getErrorMessage } from '../../../lib/supabaseErrorHandler'
import { useAutoRefresh } from '../../../shared/hooks/useAutoRefresh'
import { todayLocalYmd } from '../../../shared/utils/dates'

export function OkrHomePage() {
  const navigate = useNavigate()
  const [progress, setProgress] = useState<PointsProgress | null>(null)
  const [streak, setStreak] = useState<{
    streak_days: number
    is_alive: boolean
    grace_days_left: number
  } | null>(null)
  const [scoresCount, setScoresCount] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const today = todayLocalYmd()

      // Cargar progreso de hoy
      const progressData = await okrQueries.getPointsProgress(today)
      setProgress(progressData)

      // Cargar racha
      try {
        const streakData = await okrQueries.getOkrStreakWithGrace()
        setStreak({
          streak_days: streakData.streak_days,
          is_alive: streakData.is_alive,
          grace_days_left: streakData.grace_days_left,
        })
      } catch (streakErr) {
        console.warn('Error al cargar racha:', streakErr)
        setStreak({ streak_days: 0, is_alive: false, grace_days_left: 0 })
      }

      // Verificar si hay scoring configurado
      const scores = await okrQueries.getMetricScores()
      setScoresCount(scores.length)
    } catch (err: unknown) {
      const errorMsg = getErrorMessage(err)
      setError(errorMsg)

      if (isNetworkError(err)) {
        setError('Supabase local no responde. Corre: supabase start')
      } else if (isAuthError(err)) {
        setError('Error de autenticación. Por favor, recarga la página.')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Auto-refresh al hacer focus o cuando el documento se vuelve visible
  useAutoRefresh(loadData, { enabled: !loading })

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="card p-4">
          <div className="h-8 w-32 bg-bg rounded mb-4 animate-pulse" />
          <div className="h-24 bg-bg rounded mb-3 animate-pulse" />
          <div className="h-10 bg-bg rounded animate-pulse" />
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="card p-4 bg-red-50 border border-red-200">
        <div className="text-sm text-red-700 mb-3">{error}</div>
        <button
          onClick={() => window.location.reload()}
          className="btn btn-primary text-sm"
        >
          Reintentar
        </button>
      </div>
    )
  }

  // Empty state: no hay scoring configurado
  if (scoresCount === 0) {
    return (
      <div className="space-y-4">
        {progress && (
          <DailySummaryCompact progress={progress} streak={streak} />
        )}

        <div className="card p-6 text-center">
          <div className="text-lg font-semibold mb-2">
            Configura tus puntajes primero
          </div>
          <p className="text-sm text-muted mb-4">
            Para empezar a registrar tu actividad, necesitas configurar cuántos puntos vale cada métrica.
          </p>
          <button
            onClick={() => navigate('/okr/scoring')}
            className="btn btn-primary"
          >
            Configurar puntajes
          </button>
        </div>
      </div>
    )
  }

  // Normal state
  return (
    <div className="space-y-4">
      {progress && (
        <DailySummaryCompact progress={progress} streak={streak} />
      )}

      {/* CTA Principal */}
      <div className="card p-4">
        <button
          onClick={() => navigate('/okr/daily?date=today')}
          className="w-full btn btn-primary py-3 text-base font-semibold"
        >
          Registrar actividad de hoy
        </button>
      </div>

      {/* Cards informativas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-4">
          <div className="font-semibold mb-1">OKR Diario</div>
          <div className="text-sm text-muted mb-2">Resumen de tu actividad diaria</div>
          {progress && (
            <div className="text-xs text-muted">
              {progress.current_points} / {progress.base_target} pts
            </div>
          )}
        </div>

        <div className="card p-4">
          <div className="font-semibold mb-1">OKR Semana</div>
          <div className="text-sm text-muted">Resumen de tu progreso semanal</div>
          <div className="text-xs text-muted mt-2">Usa el menú lateral para ver detalles</div>
        </div>
      </div>
    </div>
  )
}
