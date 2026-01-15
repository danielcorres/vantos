import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../../lib/supabaseClient'
import { isNetworkError, isAuthError, getErrorMessage } from '../../../lib/supabaseErrorHandler'
import { okrQueries, type DailyEntry, type PointsProgress, type OkrTier } from '../data/okrQueries'
import { DailyGoalProgress } from '../components/DailyGoalProgress'
import { Toast } from '../../../shared/components/Toast'
import { useAutoRefresh } from '../../../shared/hooks/useAutoRefresh'
import { timeAgo } from '../../../shared/utils/timeAgo'
import { todayLocalYmd, addDaysYmd } from '../../../shared/utils/dates'
import { useAuth } from '../../../shared/auth/AuthProvider'
import { METRIC_LABELS } from '../domain/metricLabels'

const IS_DEV = import.meta.env.DEV
import {
  buildScoresMap,
  calcWeekRangeLocal,
  computeAdvisorWeekStats,
} from '../../../pages/owner/utils/ownerDashboardHelpers'
import {
  calculateAdvisorInsight,
} from '../dashboard/teamDashboardInsights'
import { buildTodayPlanForAdvisor } from '../dashboard/todayActionPlan'

type MetricDefinition = {
  key: string
  label: string
  sort_order: number
}

export function OkrDailyLogPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const dateParam = searchParams.get('date')
    if (dateParam === 'today') return todayLocalYmd()
    if (dateParam) return dateParam
    return todayLocalYmd()
  })

  const [metrics, setMetrics] = useState<MetricDefinition[]>([])
  const [entries, setEntries] = useState<Record<string, number>>({})
  const [scores, setScores] = useState<Record<string, number>>({})
  const [progress, setProgress] = useState<PointsProgress | null>(null)
  const [tiers, setTiers] = useState<OkrTier[]>([])
  const [streak, setStreak] = useState<{
    streak_days: number
    last_logged_date: string | null
    is_alive: boolean
    grace_days_left: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [todayPlan, setTodayPlan] = useState<{ label: string; items: Array<{ metric_key: string; units: number }> } | null>(null)

  const loadData = useCallback(async () => {
    let isMounted = true
    
    setLoading(true)
    try {
      // Cargar métricas disponibles
      const { data: metricDefs, error: defsError } = await supabase
        .from('metric_definitions')
        .select('key, label, sort_order')
        .eq('is_active', true)
        .order('sort_order')

      if (defsError) throw defsError

      // Filtrar en frontend: excluir métricas que empiecen con 'pipeline.'
      let filteredMetrics = (metricDefs || []).filter(
        (m) => !m.key.startsWith('pipeline.')
      )
      
      // Fallback: si no hay métricas de DB, usar keys de METRIC_LABELS
      if (filteredMetrics.length === 0) {
        filteredMetrics = Object.keys(METRIC_LABELS).map((key) => ({
          key,
          label: METRIC_LABELS[key],
          sort_order: 0,
        }))
      }
      
      if (!isMounted) return

      setMetrics(filteredMetrics)

      // Cargar scores (no bloquear si falla)
      try {
        const existingScores = await okrQueries.getMetricScores()
        const scoresMap: Record<string, number> = {}
        existingScores.forEach((s) => {
          scoresMap[s.metric_key] = s.points_per_unit
        })
        
        if (!isMounted) return
        
        setScores(scoresMap)
        if (IS_DEV) {
          console.debug('[OkrDailyLogPage] scores', { len: existingScores.length })
        }
      } catch (scoresErr) {
        console.warn('[OkrDailyLogPage] Error al cargar scores (continuando sin scores):', scoresErr)
        if (!isMounted) return
        setScores({})
        if (IS_DEV) {
          console.debug('[OkrDailyLogPage] scores', { len: 0 })
        }
      }

      // Cargar entradas del día
      const dailyEntries = await okrQueries.getDailyEntries(selectedDate)
      
      if (!isMounted) return
      
      setEntries(dailyEntries)
      setHasChanges(false)

      // Cargar progreso
      const progressData = await okrQueries.getPointsProgress(selectedDate)
      
      if (!isMounted) return
      
      setProgress(progressData)

      // Cargar settings global (para tiers)
      try {
        const settings = await okrQueries.getOkrSettingsGlobal()
        setTiers(settings.tiers || [])
      } catch (settingsErr) {
        console.warn('Error al cargar settings global:', settingsErr)
        // Continuar sin tiers (DailyGoalProgress tiene fallback)
      }

      // Cargar racha con tolerancia desde backend
      try {
        const streakData = await okrQueries.getOkrStreakWithGrace()
        setStreak(streakData)
      } catch (streakErr) {
        // Si falla la racha, continuar con el resto
        console.warn('Error al cargar racha:', streakErr)
        setStreak({
          streak_days: 0,
          last_logged_date: null,
          is_alive: false,
          grace_days_left: 0,
        })
      }
    } catch (err: unknown) {
      if (!isMounted) return
      
      const errorMsg = getErrorMessage(err)
      setToast({
        type: 'error',
        message: errorMsg,
      })

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
      if (isMounted) {
        setLoading(false)
      }
    }
  }, [selectedDate])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Auto-refresh al hacer focus o cuando el documento se vuelve visible
  useAutoRefresh(loadData, { enabled: !loading && !saving })

  // Calcular plan de sugerencia para hoy (solo si es hoy y hay usuario)
  useEffect(() => {
    if (!user?.id || selectedDate !== todayLocalYmd() || loading) {
      setTodayPlan(null)
      return
    }

    let mounted = true

    const calculateTodayPlan = async () => {
      try {
        // Obtener settings y scores
        const [settings, scoresData] = await Promise.all([
          okrQueries.getOkrSettingsGlobal(),
          okrQueries.getMetricScores(),
        ])

        if (!mounted) return

        const scoresMap = buildScoresMap(scoresData)
        const weeklyTarget = settings.daily_base_target * settings.weekly_days
        const { weekStartLocal, weekEndLocal } = calcWeekRangeLocal()

        // Cargar eventos de la semana actual para el usuario
        const [startYear, startMonth, startDay] = weekStartLocal.split('-').map(Number)
        const nextWeekStart = addDaysYmd(weekStartLocal, 7)
        const [nextYear, nextMonth, nextDay] = nextWeekStart.split('-').map(Number)

        const weekStartUTC = new Date(Date.UTC(startYear, startMonth - 1, startDay, 0, 0, 0))
        const nextWeekUTC = new Date(Date.UTC(nextYear, nextMonth - 1, nextDay, 0, 0, 0))

        const { data: eventsWeek } = await supabase
          .from('activity_events')
          .select('recorded_at, metric_key, value, actor_user_id')
          .eq('actor_user_id', user.id)
          .eq('is_void', false)
          .eq('source', 'manual')
          .gte('recorded_at', weekStartUTC.toISOString())
          .lt('recorded_at', nextWeekUTC.toISOString())
          .order('recorded_at', { ascending: true })

        if (!mounted) return

        // Calcular stats de la semana
        const stats = computeAdvisorWeekStats(
          (eventsWeek || []).map((e) => ({
            recorded_at: e.recorded_at,
            metric_key: e.metric_key,
            value: e.value,
            actor_user_id: e.actor_user_id,
          })),
          user.id,
          scoresMap,
          weeklyTarget,
          settings.weekly_days,
          todayLocalYmd(),
          weekStartLocal,
          weekEndLocal
        )

        if (!mounted || !stats) {
          setTodayPlan(null)
          return
        }

        // Calcular insight
        const insight = calculateAdvisorInsight(
          stats,
          weeklyTarget,
          settings.weekly_days,
          weekStartLocal,
          todayLocalYmd()
        )

        // Construir plan
        const plan = buildTodayPlanForAdvisor({
          requiredDailyAvg: insight.requiredDailyAvg,
          riskReason: insight.riskReason,
          scoresMap,
        })

        if (mounted) {
          setTodayPlan({
            label: plan.label,
            items: plan.items.map((item) => ({
              metric_key: item.metric_key,
              units: item.units,
            })),
          })
        }
      } catch (err) {
        console.error('[OkrDailyLogPage] Error al calcular plan de sugerencia:', err)
        if (mounted) {
          setTodayPlan(null)
        }
      }
    }

    calculateTodayPlan()

    return () => {
      mounted = false
    }
  }, [user?.id, selectedDate, loading, scores])

  const handleApplySuggestion = useCallback(() => {
    if (!todayPlan || todayPlan.items.length === 0) {
      setToast({
        type: 'error',
        message: 'Sin métricas configuradas para la sugerencia',
      })
      return
    }

    // Pre-llenar entries con las unidades sugeridas
    const newEntries: Record<string, number> = { ...entries }
    todayPlan.items.forEach((item) => {
      newEntries[item.metric_key] = item.units
    })

    setEntries(newEntries)
    setHasChanges(true)
    setToast({
      type: 'success',
      message: `Sugerencia aplicada: ${todayPlan.label}`,
    })
  }, [todayPlan, entries])

  const handleEntryChange = (metricKey: string, value: string) => {
    // Convertir usando parseInt como especificado
    const n = parseInt(String(value), 10)
    const finalValue = Number.isFinite(n) && n >= 0 ? n : 0

    setEntries((prev) => ({
      ...prev,
      [metricKey]: finalValue,
    }))
    setHasChanges(true)
  }

  const handleSave = async () => {
    setSaving(true)
    setToast(null)

    try {
      // Preparar entries (incluir todas las métricas, incluso con 0)
      // Usar metrics si existe, sino usar keys de METRIC_LABELS como fallback
      const metricKeys = metrics.length > 0 
        ? metrics.map(m => m.key)
        : Object.keys(METRIC_LABELS)
      
      const entriesToSave: DailyEntry[] = metricKeys.map((metricKey) => {
        const raw = entries[metricKey] ?? 0
        const n = parseInt(String(raw), 10)
        const value = Number.isFinite(n) && n >= 0 ? n : 0
        return {
          metric_key: metricKey,
          value: value,
        }
      })

      await okrQueries.saveDailyEntries(selectedDate, entriesToSave)

      // Refetch específico de entradas y progreso (no recargar todo)
      const dailyEntries = await okrQueries.getDailyEntries(selectedDate)
      setEntries(dailyEntries)
      setHasChanges(false)

      const progressData = await okrQueries.getPointsProgress(selectedDate)
      setProgress(progressData)

      // Refetch de racha después de guardar
      try {
        const streakData = await okrQueries.getOkrStreakWithGrace()
        setStreak(streakData)
      } catch (streakErr) {
        console.warn('Error al actualizar racha:', streakErr)
      }

      // Guardar timestamp de último guardado
      setLastSavedAt(new Date())
      setSaveError(null)
      setToast({ type: 'success', message: 'Guardado ✅' })
    } catch (err: unknown) {
      // Logging útil para debugging
      console.error('Error saving daily entries:', err)

      const errorMsg = getErrorMessage(err)
      setSaveError(errorMsg)
      setToast({
        type: 'error',
        message: 'Error al guardar',
      })

      // Si es error de red, mostrar mensaje específico
      if (isNetworkError(err)) {
        setSaveError('No se pudo conectar. Reintenta.')
        setToast({
          type: 'error',
          message: 'Supabase local no responde. Corre: supabase start',
        })
      } else if (isAuthError(err)) {
        setSaveError('Error de autenticación')
        setToast({
          type: 'error',
          message: 'Error de autenticación. Por favor, recarga la página.',
        })
      }
    } finally {
      setSaving(false)
      setTimeout(() => setToast(null), 2000)
    }
  }

  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate)
    setSearchParams({ date: newDate === todayLocalYmd() ? 'today' : newDate })
  }

  const handlePreviousDay = () => {
    const prevDate = addDaysYmd(selectedDate, -1)
    handleDateChange(prevDate)
  }

  const handleNextDay = () => {
    const nextDate = addDaysYmd(selectedDate, 1)
    const today = todayLocalYmd()
    if (nextDate <= today) {
      handleDateChange(nextDate)
    }
  }

  const calculatePoints = (metricKey: string, value: number): number => {
    return value * (scores[metricKey] ?? 0)
  }

  // Usar metrics si existe, sino usar keys de METRIC_LABELS como fallback
  const metricKeys = metrics.length > 0 
    ? metrics.map(m => m.key)
    : Object.keys(METRIC_LABELS)
  
  const totalPoints = metricKeys.reduce((sum, metricKey) => {
    return sum + calculatePoints(metricKey, entries[metricKey] ?? 0)
  }, 0)

  if (loading) {
    return (
      <div className="text-center p-8">
        <span className="text-muted">Cargando...</span>
      </div>
    )
  }

  // Formatear fecha para mostrar
  const formatDateDisplay = (dateStr: string): string => {
    const today = todayLocalYmd()
    const yesterday = addDaysYmd(today, -1)
    if (dateStr === today) return 'Hoy'
    if (dateStr === yesterday) return 'Ayer'
    // Parsear fecha YYYY-MM-DD para formatear
    const [y, m, d] = dateStr.split('-').map(Number)
    const date = new Date(y, m - 1, d)
    return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-1">OKR Diario</h1>
          <p className="text-sm text-muted">Captura y progreso</p>
        </div>
        {todayPlan && selectedDate === todayLocalYmd() && (
          <button
            onClick={handleApplySuggestion}
            className="btn btn-secondary btn-sm"
            title={`Aplicar sugerencia: ${todayPlan.label}`}
          >
            Aplicar sugerencia
          </button>
        )}
      </div>

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Progress Card */}
        {progress && (
          <div className="md:col-span-2">
            <DailyGoalProgress progress={progress} tiers={tiers} />
          </div>
        )}

        {/* Streak & Date Card */}
        <div className="card p-4 space-y-3">
          {/* Date Selector Compact */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={handlePreviousDay}
                className="p-1.5 text-text hover:bg-black/5 rounded transition-colors"
                aria-label="Día anterior"
              >
                ←
              </button>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                max={todayLocalYmd()}
                className="flex-1 border border-border rounded-md px-2 py-1 text-sm"
              />
              <button
                onClick={handleNextDay}
                disabled={selectedDate >= todayLocalYmd()}
                className="p-1.5 text-text hover:bg-black/5 rounded transition-colors disabled:opacity-50"
                aria-label="Día siguiente"
              >
                →
              </button>
            </div>
            <div className="text-xs text-muted">{formatDateDisplay(selectedDate)}</div>
          </div>

          {/* Streak */}
          {streak && (
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-xs font-semibold text-muted">Racha</span>
                {streak.is_alive ? (
                  <span className="text-sm">🔥</span>
                ) : (
                  <span className="text-sm text-danger">💔</span>
                )}
              </div>
              <div className="text-2xl font-black">{streak.streak_days} días</div>
              <div className="text-xs text-muted mb-1">Tolerancia: 1 día</div>

              {/* Mensajes de racha */}
              {streak.is_alive && streak.grace_days_left === 1 && (
                <div className="text-xs text-warning font-medium mt-1 p-2 bg-yellow-50 border border-yellow-200 rounded">
                  Hoy es día de tolerancia. Registra para no romperla.
                </div>
              )}
              {streak.is_alive && streak.grace_days_left === 0 && (
                <div className="text-xs text-green-600 font-medium mt-1">
                  Vas al día. Mantén la racha.
                </div>
              )}
              {!streak.is_alive && (
                <div className="text-xs text-danger font-medium mt-1 p-2 bg-red-50 border border-red-200 rounded">
                  Racha rota. Reinicia hoy.
                </div>
              )}
            </div>
          )}

          {/* Estado guardado */}
          <div className="border-t border-border pt-3">
            {saveError ? (
              <div className="text-xs text-danger mb-2">
                <div className="font-medium mb-1">Error al guardar</div>
                <div className="text-muted">{saveError}</div>
                <button
                  onClick={handleSave}
                  disabled={saving || !hasChanges}
                  className="mt-2 text-xs text-primary hover:underline"
                >
                  Reintentar
                </button>
              </div>
            ) : hasChanges ? (
              <div className="text-xs text-warning font-medium">
                Pendiente
              </div>
            ) : lastSavedAt ? (
              <div className="text-xs text-muted">
                <div className="flex items-center gap-1">
                  <span>✅ Guardado</span>
                  <span>{timeAgo(lastSavedAt)}</span>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-500px)] overflow-y-auto">
          <table className="w-full">
            <thead className="bg-bg sticky top-0 z-10 border-b-2 border-border">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted uppercase tracking-wide">
                  Métrica
                </th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-muted uppercase tracking-wide">
                  Pts/u
                </th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-muted uppercase tracking-wide">
                  Cantidad
                </th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-muted uppercase tracking-wide">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {metricKeys.map((metricKey, index) => {
                const metric = metrics.find(m => m.key === metricKey) || {
                  key: metricKey,
                  label: METRIC_LABELS[metricKey] || metricKey,
                  sort_order: 0,
                }
                const value = entries[metricKey] ?? 0
                const points = calculatePoints(metricKey, value)
                const hasValue = value > 0

                return (
                  <tr
                    key={metricKey}
                    className={`border-b border-border transition-colors ${
                      index % 2 === 0 ? 'bg-surface' : 'bg-bg'
                    } ${hasValue ? 'bg-primary/5' : ''} hover:bg-primary/10`}
                  >
                    <td className="py-2.5 px-4">
                      <div className="font-medium text-sm">{metric.label}</div>
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <span className="text-xs text-muted">{scores[metricKey] ?? 0}</span>
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="flex justify-end">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={value}
                          onChange={(e) => handleEntryChange(metricKey, e.target.value)}
                          disabled={saving}
                          className="w-20 border border-border rounded-md px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <span className="text-sm font-bold">{points} pts</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer Sticky (Mobile) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-border p-4 shadow-lg z-40">
        <div className="flex items-center justify-between mb-2">
          <div>
            <span className="text-sm font-semibold">Total: </span>
            <span className="text-xl font-black">{totalPoints} pts</span>
          </div>
          {lastSavedAt && !hasChanges && !saveError && (
            <div className="text-xs text-muted">
              Guardado {timeAgo(lastSavedAt)}
            </div>
          )}
        </div>
        {saveError && (
          <div className="text-xs text-danger mb-2">
            Error: {saveError}
          </div>
        )}
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className="w-full btn btn-primary py-2.5"
        >
          {saving ? 'Guardando...' : hasChanges ? 'Guardar' : 'Guardado ✅'}
        </button>
      </div>

      {/* Desktop Save Button */}
      <div className="hidden md:flex justify-end sticky bottom-4 z-30">
        <div className="card p-4 flex items-center gap-4 shadow-lg">
          <div className="text-right">
            <div className="text-xs text-muted mb-1">
              Total calculado
              {progress && Math.abs(totalPoints - progress.current_points) > 0.1 && (
                <span className="text-warning ml-1" title="Diferencia con backend">
                  ⚠️
                </span>
              )}
            </div>
            <div className="text-2xl font-black">{totalPoints} pts</div>
            {progress && (
              <div className="text-xs text-muted mt-0.5">
                Backend: {progress.current_points} pts
              </div>
            )}
            {lastSavedAt && !hasChanges && !saveError && (
              <div className="text-xs text-muted mt-1">
                Guardado {timeAgo(lastSavedAt)}
              </div>
            )}
            {hasChanges && (
              <div className="text-xs text-warning mt-1 font-medium">
                Pendiente
              </div>
            )}
            {saveError && (
              <div className="text-xs text-danger mt-1">
                Error: {saveError}
              </div>
            )}
          </div>
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="btn btn-primary px-6 py-2.5"
          >
            {saving ? 'Guardando...' : hasChanges ? 'Guardar' : 'Guardado ✅'}
          </button>
        </div>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}
