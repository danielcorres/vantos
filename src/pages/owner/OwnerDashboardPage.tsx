import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useUserRole } from '../../shared/hooks/useUserRole'
import { useAuth } from '../../shared/auth/AuthProvider'
import { isSystemOwner } from '../../lib/access'
import { useTeamOkrDashboard } from '../../modules/okr/dashboard/useTeamOkrDashboard'
import { useDashboardSnapshot } from '../../modules/okr/dashboard/useDashboardSnapshot'
import { TeamWeeklyLeaderboardTable } from '../../modules/okr/components/TeamWeeklyLeaderboardTable'
import { buildTeamAlerts, getAlertSeverityInfo } from '../../modules/okr/dashboard/teamAlerts'
import { TeamProfileList } from '../../modules/okr/components/TeamProfileList'
import { WeeklyMinimumsModal } from '../../modules/okr/components/WeeklyMinimumsModal'
import {
  type Advisor,
} from './utils/ownerDashboardHelpers'
import { getMetricLabel } from '../../modules/okr/domain/metricLabels'
import { fetchWeeklyMinimumTargetsForOwner, DEFAULT_WEEKLY_MINIMUMS, type WeeklyMinimumTargetsMap } from '../../modules/okr/dashboard/weeklyMinimumTargets'
import { buildAdvisorProfile, type AdvisorProfileResult } from '../../modules/okr/dashboard/advisorProfile'
import { buildMetricBreakdown } from '../../modules/okr/dashboard/advisorDetailHelpers'
import { addDaysYmd } from '../../shared/utils/dates'
import { calcWeekRangeLocal } from '../../modules/okr/utils/weeklyHistoryHelpers'

const IS_DEV = import.meta.env.DEV

type ProfileOption = {
  user_id: string
  full_name: string | null
  display_name: string | null
}

export function OwnerDashboardPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, systemOwnerId } = useAuth()
  const { role: userRole, isOwner, loading: roleLoading, error: roleError, retry: retryRole } = useUserRole()
  
  const isSystemOwnerUser = isSystemOwner(user?.id, systemOwnerId)
  // Permitir acceso a owner, director y seguimiento
  const canAccessDashboard = userRole === 'owner' || userRole === 'director' || userRole === 'seguimiento'
  const [selectedManagerId, setSelectedManagerId] = useState<string | null>(null)
  const [selectedRecruiterId, setSelectedRecruiterId] = useState<string | null>(null)
  const [managers, setManagers] = useState<ProfileOption[]>([])
  const [recruiters, setRecruiters] = useState<ProfileOption[]>([])
  const [weeklyMinimums, setWeeklyMinimums] = useState<WeeklyMinimumTargetsMap>(DEFAULT_WEEKLY_MINIMUMS)
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null)
  const [showMinimumsModal, setShowMinimumsModal] = useState(false)

  // Leer semana desde query param, o usar semana actual por defecto
  const currentWeekRange = calcWeekRangeLocal()
  const weekStartFromUrl = searchParams.get('weekStart')
  const selectedWeekStart = weekStartFromUrl || currentWeekRange.weekStartLocal

  // Validar que la semana seleccionada no sea futura
  const isValidWeek = selectedWeekStart <= currentWeekRange.weekStartLocal
  const weekStartLocalToUse = isValidWeek ? selectedWeekStart : currentWeekRange.weekStartLocal

  // Corregir URL si se intenta acceder a una semana futura
  useEffect(() => {
    if (weekStartFromUrl && !isValidWeek) {
      setSearchParams({}, { replace: true })
    }
  }, [weekStartFromUrl, isValidWeek, setSearchParams])

  // Usar hook compartido para datos del dashboard
  const {
    weekStats,
    historyStats,
    dailyTarget,
    weeklyDays,
    weeklyTarget,
    weekStartLocal,
    weekEndLocal,
    todayLocal: todayLocalFromHook,
    advisorIds,
    scoresMap,
    eventsWeek,
    loading,
    error,
    reload: loadData,
  } = useTeamOkrDashboard({
    mode: 'owner',
    filters: {
      managerId: selectedManagerId,
      recruiterId: selectedRecruiterId,
    },
    weekStartLocal: weekStartLocalToUse,
  })

  // Usar todayLocal del hook para consistencia (aunque debería ser el mismo)
  const todayLocalForDisplay = todayLocalFromHook

  const { copySnapshot } = useDashboardSnapshot()
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Cargar mínimos semanales
  useEffect(() => {
    if (!systemOwnerId || loading) return

    const loadMinimums = async () => {
      try {
        setOwnerUserId(systemOwnerId)

        const { targets } = await fetchWeeklyMinimumTargetsForOwner(supabase, systemOwnerId)
        setWeeklyMinimums(targets)
      } catch (err) {
        console.error('[OwnerDashboardPage] Error loading weekly minimums:', err)
        setWeeklyMinimums(DEFAULT_WEEKLY_MINIMUMS)
      }
    }

    loadMinimums()
  }, [systemOwnerId, loading])

  // Calcular alertas del equipo
  const teamAlerts = useMemo(() => {
    return buildTeamAlerts({
      weekStats,
      historyStats,
      weeklyTarget,
    })
  }, [weekStats, historyStats, weeklyTarget])

  // Calcular perfiles de asesores
  const advisorProfiles = useMemo(() => {
    return weekStats.map((stat) => {
      // Obtener métricas del asesor desde eventsWeek
      const advisorEvents = eventsWeek.filter(
        (e) => e.actor_user_id === stat.advisor.user_id && e.value !== null && e.value > 0
      )

      // Construir breakdown de métricas
      const breakdown = buildMetricBreakdown(
        advisorEvents.map((e) => ({ metric_key: e.metric_key, value: e.value || 0 })),
        scoresMap
      )

      // Crear mapa de métricas
      const metrics: Record<string, number> = {}
      breakdown.forEach((row) => {
        metrics[row.metric_key] = row.units
      })

      // Construir perfil
      const profile = buildAdvisorProfile({
        pointsWeek: stat.weekPoints,
        percentOfGoal: stat.percentOfTarget / 100,
        daysActive: stat.daysWithActivity,
        metrics,
        minimums: weeklyMinimums,
      })

      return {
        advisor: stat.advisor,
        profile,
        metrics,
        weekPoints: stat.weekPoints,
        percentOfTarget: stat.percentOfTarget,
      }
    })
  }, [weekStats, eventsWeek, scoresMap, weeklyMinimums])

  // Contar perfiles
  const profileCounts = useMemo(() => {
    const counts = {
      productive: 0,
      growing: 0,
      intermittent: 0,
      inactive: 0,
    }
    advisorProfiles.forEach((item) => {
      counts[item.profile.key]++
    })
    return counts
  }, [advisorProfiles])

  // Ordenar asesores por perfil (prioridad: inactive > intermittent > growing > productive)
  const sortedAdvisorProfiles = useMemo(() => {
    const order: Record<AdvisorProfileResult['key'], number> = {
      inactive: 0,
      intermittent: 1,
      growing: 2,
      productive: 3,
    }
    return [...advisorProfiles].sort((a, b) => {
      const orderA = order[a.profile.key]
      const orderB = order[b.profile.key]
      if (orderA !== orderB) {
        return orderA - orderB
      }
      // Si mismo perfil, ordenar por puntos desc
      return b.weekPoints - a.weekPoints
    })
  }, [advisorProfiles])

  // Calcular suma de métricas del equipo (reemplaza cards de resumen)
  const teamMetricsTotals = useMemo(() => {
    const totals = new Map<string, number>()

    // Orden de métricas para mostrar
    const metricOrder = [
      'calls',
      'meetings_set',
      'meetings_held',
      'proposals_presented',
      'applications_submitted',
      'referrals',
      'policies_paid',
    ]

    // Sumar todos los eventos de la semana por métrica
    eventsWeek.forEach((event) => {
      if (event.metric_key && event.value !== null && event.value > 0) {
        const current = totals.get(event.metric_key) || 0
        totals.set(event.metric_key, current + event.value)
      }
    })

    // Construir array de métricas con totales
    return metricOrder
      .filter((key) => totals.has(key))
      .map((key) => ({
        metricKey: key,
        label: getMetricLabel(key, 'long'),
        labelShort: getMetricLabel(key, 'short'),
        total: totals.get(key) || 0,
        tooltip: `Suma de ${getMetricLabel(key, 'long').toLowerCase()} realizadas por todo el equipo esta semana`,
      }))
  }, [eventsWeek])

  // Cargar managers y recruiters para los dropdowns
  useEffect(() => {
    const loadFilters = async () => {
      try {
        const [managersRes, recruitersRes] = await Promise.all([
          supabase
            .from('profiles')
            .select('user_id, full_name, display_name')
            .in('role', ['manager', 'owner'])
            .order('full_name', { ascending: true, nullsFirst: false }),
          supabase
            .from('profiles')
            .select('user_id, full_name, display_name')
            .in('role', ['recruiter', 'owner'])
            .order('full_name', { ascending: true, nullsFirst: false }),
        ])

        setManagers(managersRes.data || [])
        setRecruiters(recruitersRes.data || [])
      } catch (err) {
        console.error('[OwnerDashboardPage] Error al cargar filtros:', err)
      }
    }

    if ((isOwner || userRole === 'director' || userRole === 'seguimiento') && !roleLoading) {
      loadFilters()
    }
  }, [isOwner, userRole, roleLoading])

  useEffect(() => {
    if (!roleLoading && !canAccessDashboard) {
      navigate('/', { replace: true })
    }
  }, [canAccessDashboard, roleLoading, navigate])

  const handleMinimumsSave = (newMinimums: WeeklyMinimumTargetsMap) => {
    setWeeklyMinimums(newMinimums)
    setToastMessage('Mínimos semanales actualizados')
    setTimeout(() => setToastMessage(null), 2000)
  }

  // Obtener nombre del asesor
  const getAdvisorName = (advisor: Advisor): string => {
    if (advisor.full_name && advisor.full_name.trim()) {
      return advisor.full_name.trim()
    }
    if (advisor.display_name && advisor.display_name.trim()) {
      return advisor.display_name.trim()
    }
    return `Usuario ${advisor.user_id.slice(0, 8)}`
  }

  // Obtener nombre de perfil para filtros
  const getProfileName = (profile: ProfileOption): string => {
    if (profile.full_name && profile.full_name.trim()) {
      return profile.full_name.trim()
    }
    if (profile.display_name && profile.display_name.trim()) {
      return profile.display_name.trim()
    }
    return `Usuario ${profile.user_id.slice(0, 8)}`
  }

  // Obtener texto del scope actual
  const getScopeText = (): string => {
    if (selectedManagerId && selectedRecruiterId) {
      const manager = managers.find(m => m.user_id === selectedManagerId)
      const recruiter = recruiters.find(r => r.user_id === selectedRecruiterId)
      return `Equipo de ${getProfileName(manager!)} y reclutados por ${getProfileName(recruiter!)}`
    }
    if (selectedManagerId) {
      const manager = managers.find(m => m.user_id === selectedManagerId)
      return `Equipo de ${getProfileName(manager!)}`
    }
    if (selectedRecruiterId) {
      const recruiter = recruiters.find(r => r.user_id === selectedRecruiterId)
      return `Reclutados por ${getProfileName(recruiter!)}`
    }
    return 'Todos'
  }

  const handleClearFilters = () => {
    setSelectedManagerId(null)
    setSelectedRecruiterId(null)
  }

  const handleAdvisorClick = (advisorId: string) => {
    navigate(`/manager/advisor/${advisorId}`)
  }

  const handleCopySnapshot = async () => {
    const success = await copySnapshot(
      'owner',
      weekStartLocal,
      weekEndLocal,
      weeklyTarget,
      dailyTarget,
      weeklyDays,
      advisorIds
    )
    if (success) {
      setToastMessage('Snapshot copiado')
      setTimeout(() => setToastMessage(null), 2000)
    }
  }

  // Navegación de semanas
  const handlePreviousWeek = () => {
    const prevWeekStart = addDaysYmd(weekStartLocal, -7)
    setSearchParams({ weekStart: prevWeekStart })
  }

  const handleCurrentWeek = () => {
    setSearchParams({})
  }

  const handleNextWeek = () => {
    const nextWeekStart = addDaysYmd(weekStartLocal, 7)
    // Validar que no sea futura
    if (nextWeekStart <= currentWeekRange.weekStartLocal) {
      setSearchParams({ weekStart: nextWeekStart })
    }
  }

  // Verificar si se puede navegar a la semana siguiente
  const canNavigateNext = addDaysYmd(weekStartLocal, 7) <= currentWeekRange.weekStartLocal

  // Obtener color y label del estado

  if (roleLoading || loading) {
    return (
      <div className="text-center p-8">
        <span className="text-muted">Cargando...</span>
        {roleError === 'timeout' && !roleLoading && (
          <div className="mt-4">
            <button onClick={retryRole} className="btn btn-primary text-sm">
              Reintentar
            </button>
          </div>
        )}
      </div>
    )
  }

  if (!canAccessDashboard) {
    return (
      <div className="text-center p-8">
        <div className="text-lg font-semibold mb-2">No autorizado</div>
        <div className="text-sm text-muted">Solo owner, director y seguimiento pueden acceder a esta vista.</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card p-4 bg-red-50 border border-red-200">
        <div className="text-sm text-red-700">{error}</div>
        <button onClick={loadData} className="btn btn-primary mt-3 text-sm">
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold mb-1">Dashboard Owner</h1>
            <p className="text-sm text-muted">Desempeño semanal y consistencia histórica de asesores</p>
          </div>
          <div className="flex items-center gap-2">
          {isSystemOwnerUser && (
            <div className="group relative">
              <button
                onClick={() => setShowMinimumsModal(true)}
                className="px-3 py-1.5 text-xs border border-border rounded bg-bg text-text hover:bg-black/5 transition-colors flex items-center gap-1.5"
              >
                <span>Mínimos</span>
                <span className="text-[10px] text-muted">ⓘ</span>
              </button>
              <div className="absolute right-0 top-full mt-1 w-48 p-2 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none z-20 shadow-lg">
                Editar mínimos semanales por asesor
                <div className="absolute right-4 top-0 -translate-y-full w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-black"></div>
              </div>
            </div>
          )}
          {IS_DEV && (
            <button
              onClick={handleCopySnapshot}
              className="px-3 py-1.5 text-xs border border-border rounded bg-bg text-text hover:bg-black/5 transition-colors"
            >
              Copiar snapshot
            </button>
          )}
          </div>
        </div>
        {/* Controles de navegación de semana */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 border border-border rounded bg-bg">
            <button
              onClick={handlePreviousWeek}
              className="px-2 py-1 text-sm hover:bg-black/5 transition-colors rounded"
              title="Semana anterior"
            >
              ◀
            </button>
            <button
              onClick={handleCurrentWeek}
              className="px-2 py-1 text-xs hover:bg-black/5 transition-colors rounded whitespace-nowrap"
              title="Ir a semana actual"
            >
              Semana actual
            </button>
            <button
              onClick={handleNextWeek}
              disabled={!canNavigateNext}
              className="px-2 py-1 text-sm hover:bg-black/5 transition-colors rounded disabled:opacity-50 disabled:cursor-not-allowed"
              title={canNavigateNext ? "Semana siguiente" : "No se puede navegar a semanas futuras"}
            >
              ▶
            </button>
          </div>
          <div className="text-xs text-muted whitespace-nowrap">
            Semana: {weekStartLocal} - {weekEndLocal}
          </div>
        </div>
      </div>

      {/* Toast para snapshot */}
      {toastMessage && (
        <div className="fixed top-4 right-4 px-4 py-2 bg-green-50 border border-green-200 rounded text-sm text-green-700 z-50">
          {toastMessage}
        </div>
      )}

      {/* B) Alertas del equipo - Compacto, no dominante */}
      {teamAlerts.length > 0 && (
        <div className="card p-2">
          <div className="mb-1.5">
            <h3 className="text-xs font-medium text-muted">Alertas del equipo</h3>
          </div>
          <div className="space-y-1">
            {teamAlerts.map((alert) => {
              const severityInfo = getAlertSeverityInfo(alert.severity)
              return (
                <div
                  key={alert.key}
                  className={`flex items-center gap-2 px-2 py-1 rounded text-xs ${severityInfo.bg} ${severityInfo.color}`}
                >
                  <span>{severityInfo.icon}</span>
                  <span>{alert.text}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="card p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-muted mb-1">Manager</label>
            <select
              value={selectedManagerId || ''}
              onChange={(e) => setSelectedManagerId(e.target.value || null)}
              className="w-full px-3 py-2 text-sm border border-border rounded bg-bg text-text"
            >
              <option value="">Todos</option>
              {managers.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {getProfileName(m)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-muted mb-1">Recruiter</label>
            <select
              value={selectedRecruiterId || ''}
              onChange={(e) => setSelectedRecruiterId(e.target.value || null)}
              className="w-full px-3 py-2 text-sm border border-border rounded bg-bg text-text"
            >
              <option value="">Todos</option>
              {recruiters.map((r) => (
                <option key={r.user_id} value={r.user_id}>
                  {getProfileName(r)}
                </option>
              ))}
            </select>
          </div>
          {(selectedManagerId || selectedRecruiterId) && (
            <button
              onClick={handleClearFilters}
              className="px-4 py-2 text-sm border border-border rounded bg-bg text-text hover:bg-black/5 transition-colors"
            >
              Limpiar filtros
            </button>
          )}
        </div>
        <div className="mt-3 text-sm text-muted">
          Mostrando: <span className="font-medium text-text">{getScopeText()}</span>
        </div>
      </div>

      {/* A) Suma de métricas del equipo - Reemplaza cards de resumen */}
      {teamMetricsTotals.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted">Actividad total del equipo (semana actual)</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            {/* Primera fila: 4 columnas */}
            {teamMetricsTotals.slice(0, 4).map((metric) => (
              <div key={metric.metricKey} className="card p-2.5 group relative">
                <div className="flex items-start justify-between mb-1.5">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-muted mb-1">{metric.labelShort}</div>
                    <div className="text-lg font-black">{metric.total.toLocaleString()}</div>
                  </div>
                  <div className="w-3 h-3 flex items-center justify-center bg-black/5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-help flex-shrink-0 ml-1">
                    <span className="text-[8px] text-muted">ⓘ</span>
                  </div>
                  <div className="absolute right-0 top-full mt-1 w-56 p-2 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none z-20 shadow-lg">
                    {metric.tooltip}
                    <div className="absolute right-4 top-0 -translate-y-full w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-black"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {/* Segunda fila: 3 columnas (si hay más de 4 métricas) */}
          {teamMetricsTotals.length > 4 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {teamMetricsTotals.slice(4).map((metric) => (
                <div key={metric.metricKey} className="card p-2.5 group relative">
                  <div className="flex items-start justify-between mb-1.5">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-muted mb-1">{metric.labelShort}</div>
                      <div className="text-lg font-black">{metric.total.toLocaleString()}</div>
                    </div>
                    <div className="w-3 h-3 flex items-center justify-center bg-black/5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-help flex-shrink-0 ml-1">
                      <span className="text-[8px] text-muted">ⓘ</span>
                    </div>
                    <div className="absolute right-0 top-full mt-1 w-56 p-2 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none z-20 shadow-lg">
                      {metric.tooltip}
                      <div className="absolute right-4 top-0 -translate-y-full w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-black"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* C) Tabla Leaderboard Semanal - Principal */}
      <TeamWeeklyLeaderboardTable
        weekStats={weekStats}
        weeklyTarget={weeklyTarget}
        weeklyDays={weeklyDays}
        weekStartLocal={weekStartLocal}
        weekEndLocal={weekEndLocal}
        todayLocal={todayLocalForDisplay}
        scoresMap={scoresMap}
        eventsWeek={eventsWeek}
        onAdvisorClick={handleAdvisorClick}
        defaultSort="points"
        getAdvisorName={getAdvisorName}
        weeklyMinimums={weeklyMinimums}
      />

      {/* D) Perfil del equipo - Reemplaza Consistencia 12 semanas */}
      <div className="card p-0 overflow-hidden">
        <div className="p-3 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">Perfil del equipo</h2>
              <p className="text-xs text-muted mt-0.5">Diagnóstico rápido para dirigir la semana</p>
            </div>
            <div className="group relative">
              <div className="w-5 h-5 flex items-center justify-center bg-black/5 rounded-full cursor-help">
                <span className="text-[10px] text-muted">ⓘ</span>
              </div>
              <div className="absolute right-0 top-full mt-1 w-64 p-2 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none z-20 shadow-lg whitespace-pre-line">
                Productivo: actividad + conversión{'\n'}
                En crecimiento: actividad sólida; falta convertir{'\n'}
                Intermitente: ritmo irregular{'\n'}
                Inactivo: sin actividad registrada
                <div className="absolute right-4 top-0 -translate-y-full w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-black"></div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Mini-cards con conteo por perfil */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="card p-3 bg-green-50 border border-green-200">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">🔥</span>
                <span className="text-xs font-medium text-green-700">Productivo</span>
              </div>
              <div className="text-xl font-black text-green-700">{profileCounts.productive}</div>
            </div>
            <div className="card p-3 bg-blue-50 border border-blue-200">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">🚀</span>
                <span className="text-xs font-medium text-blue-700">En crecimiento</span>
              </div>
              <div className="text-xl font-black text-blue-700">{profileCounts.growing}</div>
            </div>
            <div className="card p-3 bg-amber-50 border border-amber-200">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">⚖️</span>
                <span className="text-xs font-medium text-amber-700">Intermitente</span>
              </div>
              <div className="text-xl font-black text-amber-700">{profileCounts.intermittent}</div>
            </div>
            <div className="card p-3 bg-red-50 border border-red-200">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">🚨</span>
                <span className="text-xs font-medium text-red-700">Inactivo</span>
              </div>
              <div className="text-xl font-black text-red-700">{profileCounts.inactive}</div>
            </div>
          </div>

          {/* Lista de asesores */}
          <TeamProfileList
            advisorProfiles={sortedAdvisorProfiles}
            getAdvisorName={getAdvisorName}
            onAdvisorClick={handleAdvisorClick}
            weeklyMinimums={weeklyMinimums}
          />
        </div>
      </div>

      {/* Modal de mínimos semanales - Solo para System Owner */}
      {isSystemOwnerUser && ownerUserId && (
        <WeeklyMinimumsModal
          isOpen={showMinimumsModal}
          onClose={() => setShowMinimumsModal(false)}
          ownerUserId={ownerUserId}
          currentMinimums={weeklyMinimums}
          onSave={handleMinimumsSave}
        />
      )}
    </div>
  )
}
