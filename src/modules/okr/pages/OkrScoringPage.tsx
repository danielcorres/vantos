import { useState, useEffect, useCallback, useRef } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../../../lib/supabaseClient'
import { isNetworkError, isAuthError, getErrorMessage } from '../../../lib/supabaseErrorHandler'
import { okrQueries, type OkrTier } from '../data/okrQueries'
import { Toast } from '../../../shared/components/Toast'
import { useUserRole } from '../../../shared/hooks/useUserRole'
import { useAuth } from '../../../shared/auth/AuthProvider'

const IS_DEV = import.meta.env.DEV

type MetricDefinition = {
  key: string
  label: string
}

export function OkrScoringPage() {
  // Hook para obtener auth state
  const { session, user, loading: authLoading, systemOwnerId } = useAuth()
  
  // Hook para obtener rol (siempre se ejecuta primero)
  const { role, loading: roleLoading, error: roleError, retry: retryRole } = useUserRole()
  
  const [metrics, setMetrics] = useState<MetricDefinition[]>([])
  const [scores, setScores] = useState<Record<string, number>>({})
  const [loadingScores, setLoadingScores] = useState(false)
  const [scoresError, setScoresError] = useState<string | null>(null)
  const [dailyTarget, setDailyTarget] = useState<string>('25') // String para evitar warning controlled/uncontrolled
  const [weeklyDays, setWeeklyDays] = useState<string>('5') // String para evitar warning
  const [tiers, setTiers] = useState<OkrTier[]>([])
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [savingDailyTarget, setSavingDailyTarget] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const scoresLoadInProgressRef = useRef(false)

  // Verificar si el usuario puede editar
  const canEdit = role === 'owner' || (user?.id && systemOwnerId && user.id === systemOwnerId)
  const isAdmin = ownerUserId !== null && currentUserId !== null && ownerUserId === currentUserId
  const canInitialize = ownerUserId === null

  // Cargar scores independientemente de role/systemOwnerId
  const loadScores = useCallback(async () => {
    if (!session || !user?.id) return
    if (scoresLoadInProgressRef.current) return

    scoresLoadInProgressRef.current = true
    setLoadingScores(true)
    setScoresError(null)

    try {
      const existingScores = await okrQueries.getMetricScores()
      if (existingScores && existingScores.length > 0) {
        const scoresMap: Record<string, number> = {}
        existingScores.forEach((s) => {
          scoresMap[s.metric_key] = s.points_per_unit
        })
        setScores(scoresMap)
        if (IS_DEV) {
          console.debug('[OkrScoringPage] scores', { len: existingScores.length, role, systemOwnerId })
        }
      } else {
        setScores({})
        if (IS_DEV) {
          console.debug('[OkrScoringPage] scores', { len: 0, role, systemOwnerId })
        }
      }
    } catch (err: unknown) {
      const errorMsg = getErrorMessage(err)
      setScoresError(errorMsg)
      console.error('[OkrScoringPage] Error al cargar scores:', err)
    } finally {
      setLoadingScores(false)
      scoresLoadInProgressRef.current = false
    }
  }, [session, user?.id, role, systemOwnerId])

  const loadData = useCallback(async () => {
    if (!session || !user?.id) {
      return
    }

    setLoading(true)
    try {
      // Usar usuario de auth context
      setCurrentUserId(user.id)

      // Cargar settings global (usar getGlobalOkrSettings para obtener id si existe)
      const settingsWithId = await okrQueries.getGlobalOkrSettings()
      if (settingsWithId) {
        setOwnerUserId(settingsWithId.owner_user_id)
        setDailyTarget(String(settingsWithId.daily_base_target || 25))
        setWeeklyDays(String(settingsWithId.weekly_days || 5))
        setTiers(settingsWithId.tiers || [])
      } else {
        // Si no existe, usar defaults
        const settings = await okrQueries.getOkrSettingsGlobal()
        setOwnerUserId(settings.owner_user_id)
        setDailyTarget(String(settings.daily_base_target || 25))
        setWeeklyDays(String(settings.weekly_days || 5))
        setTiers(settings.tiers || [])
      }

      // Cargar métricas disponibles (desde metric_definitions, excluyendo pipeline.*)
      const { data: metricDefs, error: defsError } = await supabase
        .from('metric_definitions')
        .select('key, label')
        .eq('is_active', true)
        .order('sort_order')

      if (defsError) throw defsError

      // Filtrar en frontend: excluir métricas que empiecen con 'pipeline.'
      const filteredMetrics = (metricDefs || []).filter((m) => !m.key.startsWith('pipeline.'))

      setMetrics(filteredMetrics)
    } catch (err: unknown) {
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
      setLoading(false)
    }
  }, [session, user?.id])

  // Cargar scores siempre que haya sesión (independiente de role)
  useEffect(() => {
    if (authLoading) return
    if (!session || !user?.id) return

    loadScores()
  }, [authLoading, session?.access_token, user?.id, loadScores])

  // Cargar otros datos solo cuando la sesión esté lista y el usuario pueda ver la configuración
  useEffect(() => {
    if (authLoading) return
    if (!session || !user?.id) return
    if (roleLoading) return
    if (role !== 'owner' && !(user?.id && systemOwnerId && user.id === systemOwnerId)) return

    loadData()
  }, [authLoading, session?.access_token, user?.id, roleLoading, role, systemOwnerId, loadData])

  // Debug: log temporal para verificar valores (hook ejecutado siempre, ANTES de early returns)
  useEffect(() => {
    if (IS_DEV) {
      console.log('[OkrScoringPage] Debug acceso:', {
        role,
        systemOwnerId,
        canEdit,
        roleLoading,
        willRedirect: role !== 'owner' && !(user?.id && systemOwnerId && user.id === systemOwnerId),
      })
    }
  }, [role, systemOwnerId, canEdit, roleLoading, user?.id])

  // Protección de ruta: mostrar loading mientras se carga auth o rol (early return DESPUÉS de todos los hooks)
  if (authLoading || roleLoading) {
    return (
      <div className="text-center p-8">
        <span className="text-muted">{authLoading ? 'Cargando sesión...' : 'Cargando rol...'}</span>
        {!authLoading && roleError === 'timeout' && (
          <div className="mt-4">
            <button onClick={retryRole} className="btn btn-primary text-sm">
              Reintentar
            </button>
          </div>
        )}
      </div>
    )
  }

  // Protección de ruta: redirigir si no es owner (early return DESPUÉS de todos los hooks)
  if (role !== 'owner' && !(user?.id && systemOwnerId && user.id === systemOwnerId)) {
    console.log('[OkrScoringPage] Redirigiendo a /okr/daily porque usuario no es owner')
    return <Navigate to="/okr/daily?date=today" replace />
  }

  const handleScoreChange = (metricKey: string, value: string) => {
    const numValue = parseInt(value, 10)
    if (isNaN(numValue) || numValue < 0) return

    setScores((prev) => ({
      ...prev,
      [metricKey]: numValue,
    }))
  }

  const handleTierChange = (index: number, field: keyof OkrTier, value: string | number) => {
    setTiers((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const handleSave = async () => {
    if (!canEdit && !canInitialize) {
      setToast({
        type: 'error',
        message: 'Solo el administrador puede guardar la configuración',
      })
      return
    }

    setSaving(true)
    setToast(null)

    try {
      // Construir array de entries
      const entries = metrics.map((metric) => ({
        metric_key: metric.key,
        points_per_unit: scores[metric.key] ?? 0,
      }))

      // Guardar usando RPC bulk
      await okrQueries.saveMetricScores(entries)

      // Refetch de scores
      await loadScores()

      setToast({ type: 'success', message: 'Guardado ✅' })
    } catch (err: unknown) {
      const errorMsg = getErrorMessage(err)
      setToast({
        type: 'error',
        message: errorMsg,
      })
    } finally {
      setSaving(false)
      setTimeout(() => setToast(null), 3000)
    }
  }

  const handleSaveDailyTarget = async () => {
    if (!canEdit && !canInitialize) {
      setToast({
        type: 'error',
        message: 'Solo el administrador puede guardar la configuración',
      })
      return
    }

    setSavingDailyTarget(true)
    setToast(null)

    try {
      // Convertir string a int, usar 25 como default si está vacío
      const targetValue = dailyTarget.trim() === '' ? 25 : parseInt(dailyTarget, 10)
      if (isNaN(targetValue) || targetValue < 0) {
        throw new Error('La meta diaria debe ser un número entero >= 0')
      }

      const payload = { daily_expected_points: targetValue }
      console.log('Guardando meta diaria:', payload)

      await okrQueries.saveGlobalOkrSettings(payload)

      // Refetch para obtener id actualizado si se creó
      await loadData()

      setToast({ type: 'success', message: 'Meta diaria guardada ✅' })
    } catch (err: unknown) {
      const errorMsg = getErrorMessage(err)
      const details = err && typeof err === 'object' && 'details' in err ? String(err.details) : ''
      const fullMessage = details ? `${errorMsg} (${details})` : errorMsg
      
      console.error('Error guardando meta diaria:', { err, dailyTarget })
      
      setToast({
        type: 'error',
        message: fullMessage,
      })
    } finally {
      setSavingDailyTarget(false)
      setTimeout(() => setToast(null), 3000)
    }
  }

  const handleSaveSettings = async () => {
    if (!canEdit && !canInitialize) {
      setToast({
        type: 'error',
        message: 'Solo el administrador puede guardar la configuración',
      })
      return
    }

    setSavingSettings(true)
    setToast(null)

    try {
      const dailyValue = dailyTarget.trim() === '' ? 25 : parseInt(dailyTarget, 10)
      const weeklyValue = weeklyDays.trim() === '' ? 5 : parseInt(weeklyDays, 10)
      
      if (isNaN(dailyValue) || dailyValue < 0) {
        throw new Error('La meta diaria debe ser un número entero >= 0')
      }
      if (isNaN(weeklyValue) || weeklyValue < 1 || weeklyValue > 7) {
        throw new Error('Los días semanales deben ser un número entre 1 y 7')
      }

      await okrQueries.saveOkrSettingsGlobal({
        daily_base_target: dailyValue,
        weekly_days: weeklyValue,
        tiers: tiers,
      })

      // Refetch
      await loadData()

      setToast({ type: 'success', message: 'Configuración guardada ✅' })
    } catch (err: unknown) {
      const errorMsg = getErrorMessage(err)
      const details = err && typeof err === 'object' && 'details' in err ? String(err.details) : ''
      const fullMessage = details ? `${errorMsg} (${details})` : errorMsg
      
      console.error('Error guardando configuración:', { err, dailyTarget, weeklyDays, tiers })
      
      setToast({
        type: 'error',
        message: fullMessage,
      })
    } finally {
      setSavingSettings(false)
      setTimeout(() => setToast(null), 3000)
    }
  }

  if (loading) {
    return (
      <div className="text-center p-8">
        <span className="text-muted">Cargando...</span>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h2 className="text-xl font-semibold m-0">Configurar OKR</h2>
        {!canEdit && !canInitialize && (
          <div className="text-sm text-muted">Solo lectura (solo el administrador puede editar)</div>
        )}
      </div>

      {/* CTA para inicializar si no hay owner */}
      {canInitialize && (
        <div className="card mb-4 bg-primary/5 border-primary/20">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold mb-1">Configuración no inicializada</h3>
              <p className="text-sm text-muted">
                Inicializa la configuración global de OKR. Al guardar, te convertirás en administrador.
              </p>
            </div>
            <button
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className="btn btn-primary"
            >
              {savingSettings ? 'Inicializando...' : 'Inicializar configuración'}
            </button>
          </div>
        </div>
      )}

      {/* Sección 1: Meta diaria esperada (global) */}
      <div className="card mb-4">
        <h3 className="text-base font-semibold mb-2">Meta diaria esperada</h3>
        <p className="text-sm text-muted mb-3">
          Es el nivel esperado de actividad diaria. Al alcanzarlo, el día se considera cumplido.
        </p>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min="0"
            step="1"
            value={dailyTarget}
            onChange={(e) => {
              // Permitir cualquier string (incluido vacío) para evitar warning
              setDailyTarget(e.target.value)
            }}
            onBlur={(e) => {
              // Al perder foco, normalizar: si está vacío, usar "25"
              const trimmed = e.target.value.trim()
              if (trimmed === '' || isNaN(parseInt(trimmed, 10))) {
                setDailyTarget('25')
              } else {
                const num = parseInt(trimmed, 10)
                if (num < 0) {
                  setDailyTarget('0')
                } else {
                  setDailyTarget(String(num))
                }
              }
            }}
            disabled={savingDailyTarget || (!canEdit && !canInitialize)}
            className="w-24 border border-border rounded-md px-2 py-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <span className="text-sm text-muted">puntos</span>
          {(canEdit || canInitialize) && (
            <button
              onClick={handleSaveDailyTarget}
              disabled={savingDailyTarget}
              className="btn btn-primary text-sm"
            >
              {savingDailyTarget ? 'Guardando...' : 'Guardar meta'}
            </button>
          )}
        </div>
      </div>

      {/* Sección 2: Puntajes por métrica (global) */}
      <div className="card mb-4">
        <h3 className="text-base font-semibold mb-2">Puntajes por métrica</h3>
        <p className="text-sm text-muted mb-4">
          Configura cuántos puntos vale cada unidad de cada métrica. Estos puntos se usarán para calcular el progreso diario.
        </p>

        {loadingScores && (
          <div className="text-center py-4">
            <span className="text-muted text-sm">Cargando puntajes...</span>
          </div>
        )}

        {scoresError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            Error al cargar puntajes: {scoresError}
          </div>
        )}

        {!loadingScores && Object.keys(scores).length === 0 && metrics.length === 0 && (
          <div className="text-center py-4">
            <span className="text-muted text-sm">No hay puntajes configurados</span>
          </div>
        )}

        {!loadingScores && (Object.keys(scores).length > 0 || metrics.length > 0) && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-bg">
                <tr className="border-b-2 border-border">
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted uppercase tracking-wide">
                    Métrica
                  </th>
                  <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted uppercase tracking-wide">
                    Puntos por unidad
                  </th>
                </tr>
              </thead>
              <tbody>
                {metrics.map((metric) => (
                  <tr key={metric.key} className="border-b border-border hover:bg-bg transition-colors">
                    <td className="py-2.5 px-3">
                      <div className="font-medium text-sm">{metric.label}</div>
                      <div className="text-xs text-muted">{metric.key}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={scores[metric.key] ?? 0}
                        onChange={(e) => handleScoreChange(metric.key, e.target.value)}
                        disabled={saving || !canEdit}
                        className="w-24 border border-border rounded-md px-2 py-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {canEdit && (
          <div className="mt-4 text-right">
            <button onClick={handleSave} disabled={saving} className="btn btn-primary">
              {saving ? 'Guardando...' : 'Guardar puntajes'}
            </button>
          </div>
        )}
      </div>

      {/* Sección 3: Niveles motivacionales (tiers) */}
      <div className="card mb-4">
        <h3 className="text-base font-semibold mb-2">Niveles motivacionales</h3>
        <p className="text-sm text-muted mb-4">
          Configura los mensajes motivacionales que se mostrarán según los puntos del día. Los rangos (Min/Max) son en puntos, no porcentajes.
        </p>

        <div className="space-y-3">
          {tiers.map((tier, index) => (
            <div key={tier.key || index} className="border border-border rounded-md p-3">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Label</label>
                  <input
                    type="text"
                    value={tier.label}
                    onChange={(e) => handleTierChange(index, 'label', e.target.value)}
                    disabled={savingSettings || !canEdit}
                    className="w-full border border-border rounded-md px-2 py-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Min pts</label>
                  <input
                    type="number"
                    min="0"
                    max="1000"
                    value={tier.min}
                    onChange={(e) => handleTierChange(index, 'min', parseInt(e.target.value, 10))}
                    disabled={savingSettings || !canEdit}
                    className="w-full border border-border rounded-md px-2 py-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Max pts</label>
                  <input
                    type="number"
                    min="0"
                    max="1000"
                    value={tier.max}
                    onChange={(e) => handleTierChange(index, 'max', parseInt(e.target.value, 10))}
                    disabled={savingSettings || !canEdit}
                    className="w-full border border-border rounded-md px-2 py-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Color</label>
                  <select
                    value={tier.color}
                    onChange={(e) => handleTierChange(index, 'color', e.target.value)}
                    disabled={savingSettings || !canEdit}
                    className="w-full border border-border rounded-md px-2 py-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="slate">Slate</option>
                    <option value="gray">Gray</option>
                    <option value="blue">Blue</option>
                    <option value="green">Green</option>
                    <option value="yellow">Yellow</option>
                    <option value="amber">Amber</option>
                    <option value="orange">Orange</option>
                    <option value="purple">Purple</option>
                  </select>
                </div>
              </div>
              <div className="mt-2">
                <label className="block text-xs font-medium text-muted mb-1">Mensaje</label>
                <input
                  type="text"
                  value={tier.message}
                  onChange={(e) => handleTierChange(index, 'message', e.target.value)}
                  disabled={savingSettings || !isAdmin}
                  className="w-full border border-border rounded-md px-2 py-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>
          ))}
        </div>

        {canEdit && (
          <div className="mt-4 text-right">
            <button onClick={handleSaveSettings} disabled={savingSettings} className="btn btn-primary">
              {savingSettings ? 'Guardando...' : 'Guardar niveles'}
            </button>
          </div>
        )}
      </div>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  )
}
