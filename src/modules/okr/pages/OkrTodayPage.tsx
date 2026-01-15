import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../../lib/supabaseClient'
import { isNetworkError, isAuthError, getErrorMessage } from '../../../lib/supabaseErrorHandler'
import { okrQueries } from '../data/okrQueries'
import { DailyGoalProgress } from '../components/DailyGoalProgress'
import { Toast } from '../../../shared/components/Toast'
import { todayLocalYmd, timestampToYmdInTz, addDaysYmd, TZ_MTY } from '../../../shared/utils/dates'

interface TodaySummary {
  metric_key: string
  label: string
  unit: string
  sort_order: number
  total_value_today: number
  points_per_unit: number
  total_points_today: number
}

export function OkrTodayPage() {
  const navigate = useNavigate()
  const [data, setData] = useState<TodaySummary[]>([])
  const [totalPoints, setTotalPoints] = useState(0)
  const [streak, setStreak] = useState(0)
  const [progress, setProgress] = useState<{ current_points: number; base_target: number; stretch_target: number; extra_points: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const dateLocal = todayLocalYmd()

      // Cargar progreso del día
      try {
        const progressData = await okrQueries.getPointsProgress(dateLocal)
        setProgress({
          current_points: progressData.current_points,
          base_target: progressData.base_target,
          stretch_target: progressData.stretch_target,
          extra_points: progressData.extra_points,
        })
      } catch (progressErr) {
        // Si falla el progreso, continuar con el resto
        console.warn('Error al cargar progreso:', progressErr)
      }

      const { data: summary, error: err } = await supabase
        .from('okr_today_summary')
        .select('*')
        .order('sort_order')

      if (err) throw err

      setData(summary || [])
      const total = (summary || []).reduce((sum, item) => sum + item.total_points_today, 0)
      setTotalPoints(total)

      // Calcular racha: días consecutivos con actividad
      const { data: events } = await supabase
        .from('activity_events')
        .select('happened_at')
        .eq('is_void', false)
        .order('happened_at', { ascending: false })
        .limit(100)

      if (events) {
        let currentStreak = 0
        const todayStr = todayLocalYmd()
        
        const uniqueDays = new Set<string>()
        events.forEach((e) => {
          const dayStr = timestampToYmdInTz(e.happened_at, TZ_MTY)
          uniqueDays.add(dayStr)
        })

        const sortedDays = Array.from(uniqueDays).sort().reverse()
        for (let i = 0; i < sortedDays.length; i++) {
          const dayStr = sortedDays[i]
          const expectedDayStr = addDaysYmd(todayStr, -i)
          
          if (dayStr === expectedDayStr) {
            currentStreak++
          } else {
            break
          }
        }
        setStreak(currentStreak)
      }
    } catch (err: unknown) {
      const errorMsg = getErrorMessage(err)
      setError(errorMsg)

      // Si es error de red, mostrar mensaje específico
      if (isNetworkError(err)) {
        setToast({
          type: 'error',
          message: 'Supabase local no responde. Corre: supabase start',
        })
      } else if (isAuthError(err)) {
        setToast({
          type: 'error',
          message: 'Error de autenticación. Por favor, recarga la página.',
        })
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleAddOne = async (metricKey: string) => {
    setBusy(true)
    setError(null)
    try {
      const { error: err } = await supabase.rpc('log_activity_event', {
        p_metric_key: metricKey,
        p_value: 1,
        p_happened_at: new Date().toISOString(),
        p_source: 'manual',
        p_idempotency_key: null,
        p_metadata: null,
      })

      if (err) throw err
      await load()
      setToast({ type: 'success', message: 'Registrado ✅' })
    } catch (err: any) {
      const errorMessage = err.message || 'Error al registrar actividad'
      setError(errorMessage)
      setToast({ type: 'error', message: errorMessage })
    } finally {
      setBusy(false)
    }
  }

  const handleUndo = async () => {
    setBusy(true)
    setError(null)
    try {
      const { error: err } = await supabase.rpc('void_last_event_today', {
        p_reason: 'undo',
      })

      if (err) throw err
      await load()
      setToast({ type: 'success', message: 'Deshecho ✅' })
    } catch (err: any) {
      const errorMessage = err.message || 'Error al deshacer'
      setError(errorMessage)
      setToast({ type: 'error', message: errorMessage })
    } finally {
      setBusy(false)
    }
  }

  // Helper para formatear unit: reemplaza "count" por contexto apropiado
  const formatUnit = (unit: string, context: 'display' | 'label' = 'display'): string => {
    if (unit.toLowerCase() === 'count') {
      return context === 'label' ? 'Total' : ''
    }
    return unit
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px' }}>Cargando...</div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h2 className="text-xl font-semibold m-0">Hoy</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="card p-2.5 min-w-[100px]">
            <div className="text-xs text-muted mb-1">Puntos de hoy</div>
            <div className="text-2xl font-black">{totalPoints}</div>
          </div>
          <div className="card p-2.5 min-w-[100px]">
            <div className="text-xs text-muted mb-1">Racha de días 🔥</div>
            <div className="text-2xl font-black">{streak}</div>
          </div>
          <button
            onClick={() => navigate('/okr/daily?date=today')}
            className="btn btn-primary text-sm"
          >
            Capturar día
          </button>
          <button
            onClick={() => navigate('/okr/scoring')}
            className="btn btn-ghost text-sm"
          >
            Configurar puntajes
          </button>
          <button
            onClick={handleUndo}
            disabled={busy}
            className="btn btn-ghost text-sm"
          >
            Deshacer último
          </button>
        </div>
      </div>

      {/* Resumen del día (progreso) */}
      {progress && (
        <div className="mb-5">
          <DailyGoalProgress
            progress={{
              date_local: todayLocalYmd(),
              current_points: progress.current_points,
              base_target: progress.base_target,
              stretch_target: progress.stretch_target,
              extra_points: progress.extra_points,
            }}
          />
        </div>
      )}

      {error && (
        <div className="card p-4 mb-4 border border-danger bg-red-50">
          <div className="font-semibold text-danger mb-2">Error</div>
          <div className="text-sm text-text mb-3">{error}</div>
          <button
            onClick={() => {
              setError(null)
              load()
            }}
            className="btn btn-primary text-sm"
          >
            Reintentar
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {data.map((item) => (
          <div key={item.metric_key} className="card">
            <div className="metric-card">
              <div className="metric-card-content">
                <div className="metric-card-label">{item.label}</div>
                <div className="metric-card-subtext">
                  Hoy: {item.total_value_today}{formatUnit(item.unit) ? ` ${formatUnit(item.unit)}` : ''}
                </div>
                <div className="metric-card-subtext">
                  {item.points_per_unit} pts{formatUnit(item.unit) ? `/${formatUnit(item.unit)}` : ''} • Total: {item.total_points_today} pts
                </div>
              </div>
              <button
                onClick={() => handleAddOne(item.metric_key)}
                disabled={busy}
                className="plus-btn"
              >
                +1
              </button>
            </div>
          </div>
        ))}
      </div>

      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}
