import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import confetti from 'canvas-confetti'
import { okrQueries, type PointsProgress } from '../data/okrQueries'
import { DailySummaryCompact } from '../components/DailySummaryCompact'
import { isNetworkError, isAuthError, getErrorMessage } from '../../../lib/supabaseErrorHandler'
import { useAutoRefresh } from '../../../shared/hooks/useAutoRefresh'
import { todayLocalYmd } from '../../../shared/utils/dates'
import { useAuth } from '../../../shared/auth/AuthProvider'
import { useUserRole } from '../../../shared/hooks/useUserRole'
import { AdvisorMilestonesSection } from '../../advisors/ui/AdvisorMilestonesSection'
import { getMyProfile, type Profile } from '../../../lib/profile'

function deriveWelcomeName(profile: Profile | null, emailFallback?: string | null): string {
  const first = profile?.first_name?.trim()
  if (first) return first
  const full = profile?.full_name?.trim()
  if (full) {
    const part = full.split(/\s+/)[0]
    return part || full
  }
  const disp = profile?.display_name?.trim()
  if (disp) {
    const part = disp.split(/\s+/)[0]
    return part || disp
  }
  if (emailFallback) {
    const local = emailFallback.split('@')[0]?.trim()
    if (local) return local
  }
  return 'allí'
}

function isBirthdayToday(birthDate: string | null | undefined, todayYmd: string): boolean {
  if (!birthDate || birthDate.length < 10) return false
  return birthDate.slice(5, 10) === todayYmd.slice(5, 10)
}

function WelcomeHeader({ name, isBirthday }: { name: string; isBirthday: boolean }) {
  if (!name) return null
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold text-text tracking-tight">Hola, {name}</h1>
      {isBirthday && (
        <div
          className="rounded-xl border border-amber-200/80 bg-gradient-to-br from-amber-50 via-rose-50 to-violet-50 px-4 py-4 shadow-sm"
          role="status"
          aria-live="polite"
        >
          <p className="text-center text-lg font-bold text-text">¡Feliz Cumpleaños! {name}</p>
        </div>
      )}
    </div>
  )
}

export function OkrHomePage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { role, loading: roleLoading } = useUserRole()
  const confettiFiredRef = useRef(false)

  const showAdvisorMilestones = useMemo(
    () => Boolean(user?.id) && role === 'advisor' && !roleLoading,
    [user?.id, role, roleLoading]
  )
  const [welcomeName, setWelcomeName] = useState('')
  const [isBirthday, setIsBirthday] = useState(false)
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

    const today = todayLocalYmd()

    let prof: Profile | null = null
    try {
      prof = await getMyProfile()
    } catch {
      // No bloquear inicio si el perfil falla
    }
    setWelcomeName(deriveWelcomeName(prof, user?.email ?? null))
    setIsBirthday(isBirthdayToday(prof?.birth_date, today))

    try {
      const progressData = await okrQueries.getPointsProgress(today)
      setProgress(progressData)

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
  }, [user?.email])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (!isBirthday || !welcomeName || confettiFiredRef.current) return
    confettiFiredRef.current = true
    const prefersReduced =
      typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) return
    void confetti({
      particleCount: 130,
      spread: 72,
      origin: { y: 0.65 },
      ticks: 200,
    })
  }, [isBirthday, welcomeName])

  useAutoRefresh(loadData, { enabled: !loading })

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

  if (error) {
    return (
      <div className="space-y-4">
        <WelcomeHeader name={welcomeName} isBirthday={isBirthday} />
        <div className="card p-4 bg-red-50 border border-red-200">
          <div className="text-sm text-red-700 mb-3">{error}</div>
          <button
            onClick={() => window.location.reload()}
            className="btn btn-primary text-sm"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  if (scoresCount === 0) {
    return (
      <div className="space-y-4">
        <WelcomeHeader name={welcomeName} isBirthday={isBirthday} />

        {progress && (
          <DailySummaryCompact progress={progress} streak={streak} />
        )}

        {showAdvisorMilestones && user && (
          <AdvisorMilestonesSection
            advisorIds={[user.id]}
            title="Tus hitos"
            linkToDetail={false}
          />
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

  return (
    <div className="space-y-4">
      <WelcomeHeader name={welcomeName} isBirthday={isBirthday} />

      {progress && (
        <DailySummaryCompact progress={progress} streak={streak} />
      )}

      {showAdvisorMilestones && user && (
        <AdvisorMilestonesSection
          advisorIds={[user.id]}
          title="Tus hitos"
          linkToDetail={false}
        />
      )}

      <div className="card p-4">
        <button
          onClick={() => navigate('/okr/daily?date=today')}
          className="w-full btn btn-primary py-3 text-base font-semibold"
        >
          Registrar actividad de hoy
        </button>
      </div>

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
