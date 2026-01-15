/**
 * Página de configuración de mínimos semanales por asesor
 * Solo accesible para owner/admin
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../shared/auth/AuthProvider'
import { useUserRole } from '../../../shared/hooks/useUserRole'
import { supabase } from '../../../lib/supabaseClient'
import { loadWeeklyMinimumTargets, saveWeeklyMinimumTargets } from './weeklyMinimumTargetsApi'
import { DEFAULT_WEEKLY_MINIMUMS, type WeeklyMinimumTargetsMap } from '../dashboard/weeklyMinimumTargets'
import { METRIC_MINIMUM_CONFIGS } from './metricMinimumConfig'

export function WeeklyMinimumTargetsPage() {
  const navigate = useNavigate()
  const { systemOwnerId } = useAuth()
  const { loading: roleLoading, isOwner } = useUserRole()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [source, setSource] = useState<'db' | 'default'>('default')
  const [values, setValues] = useState<WeeklyMinimumTargetsMap>(DEFAULT_WEEKLY_MINIMUMS)
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null)

  // Cargar datos iniciales
  useEffect(() => {
    if (roleLoading || !systemOwnerId) return

    const loadData = async () => {
      try {
        setLoading(true)
        setError(null)

        setOwnerUserId(systemOwnerId)

        // Cargar mínimos
        const { map, source: loadedSource } = await loadWeeklyMinimumTargets(supabase, systemOwnerId)
        setValues(map)
        setSource(loadedSource)
      } catch (err) {
        console.error('[WeeklyMinimumTargetsPage] Error al cargar:', err)
        setError(err instanceof Error ? err.message : 'Error al cargar configuración')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [systemOwnerId, roleLoading])

  // Verificar permisos
  useEffect(() => {
    if (!roleLoading && !isOwner) {
      // No redirigir automáticamente, mostrar mensaje
    }
  }, [isOwner, roleLoading])

  const handleValueChange = (metricKey: string, value: string) => {
    const numValue = parseInt(value, 10)
    if (isNaN(numValue) || numValue < 0) {
      return
    }
    setValues((prev) => ({ ...prev, [metricKey]: numValue }))
    setError(null)
    setSuccessMessage(null)
  }

  const handleRestoreDefaults = () => {
    setValues({ ...DEFAULT_WEEKLY_MINIMUMS })
    setError(null)
    setSuccessMessage(null)
  }

  const handleSave = async () => {
    if (!ownerUserId) {
      setError('No se puede guardar: owner_user_id no disponible')
      return
    }

    try {
      setSaving(true)
      setError(null)
      setSuccessMessage(null)

      await saveWeeklyMinimumTargets(supabase, ownerUserId, values)

      // Recargar para actualizar source
      const { map, source: newSource } = await loadWeeklyMinimumTargets(supabase, ownerUserId)
      setValues(map)
      setSource(newSource)
      setSuccessMessage('Mínimos semanales guardados correctamente')
    } catch (err) {
      console.error('[WeeklyMinimumTargetsPage] Error al guardar:', err)
      setError(err instanceof Error ? err.message : 'Error al guardar configuración')
    } finally {
      setSaving(false)
    }
  }

  if (roleLoading || loading) {
    return (
      <div className="space-y-4">
        <div className="text-center p-8">
          <span className="text-muted">Cargando...</span>
        </div>
      </div>
    )
  }

  if (!isOwner) {
    return (
      <div className="space-y-4">
        <div className="card p-6 text-center">
          <h2 className="text-lg font-semibold mb-2">No tienes acceso a esta configuración</h2>
          <p className="text-sm text-muted mb-4">Solo los administradores pueden editar mínimos semanales.</p>
          <button
            onClick={() => navigate('/')}
            className="btn btn-primary text-sm"
          >
            Volver
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold mb-1">Mínimos semanales por asesor</h1>
        <p className="text-sm text-muted">
          Estos mínimos alimentan el Dashboard Manager (comparación por asesor y por equipo).
        </p>
        <div className="mt-2">
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${
              source === 'db'
                ? 'bg-green-50 text-green-700'
                : 'bg-amber-50 text-amber-700'
            }`}
          >
            Fuente actual: {source === 'db' ? 'DB' : 'Default'}
          </span>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="card p-4 bg-red-50 border border-red-200">
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}

      {/* Success message */}
      {successMessage && (
        <div className="card p-4 bg-green-50 border border-green-200">
          <div className="text-sm text-green-700">{successMessage}</div>
        </div>
      )}

      {/* Tabla editable */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-bg border-b-2 border-border">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted uppercase">Métrica</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-muted uppercase">Mínimo por asesor</th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-muted uppercase w-12">Ayuda</th>
              </tr>
            </thead>
            <tbody>
              {METRIC_MINIMUM_CONFIGS.map((config, index) => {
                const value = values[config.key] ?? 0
                return (
                  <tr
                    key={config.key}
                    className={`border-b border-border ${index % 2 === 0 ? 'bg-bg' : 'bg-surface'}`}
                  >
                    <td className="py-3 px-4 font-medium">{config.label}</td>
                    <td className="py-3 px-4">
                      <div className="flex justify-end">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={value}
                          onChange={(e) => handleValueChange(config.key, e.target.value)}
                          className="w-24 px-2 py-1.5 border border-border rounded-md bg-surface text-text text-sm text-right font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="group relative inline-block">
                        <div className="w-5 h-5 flex items-center justify-center bg-black/5 rounded-full cursor-help">
                          <span className="text-[10px] text-muted">ⓘ</span>
                        </div>
                        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-48 p-2 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none z-20 shadow-lg">
                          {config.tooltip}
                          <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-black"></div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer de acciones */}
      <div className="flex items-center justify-between">
        <button
          onClick={handleRestoreDefaults}
          disabled={saving}
          className="btn btn-secondary text-sm"
        >
          Restaurar defaults
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="btn btn-secondary text-sm"
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn btn-primary text-sm"
          >
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}
