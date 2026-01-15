/**
 * Modal para editar mínimos semanales por asesor (solo Owner)
 */

import { useState, useEffect } from 'react'
import { METRIC_MINIMUM_CONFIGS } from '../settings/metricMinimumConfig'
import { DEFAULT_WEEKLY_MINIMUMS, type WeeklyMinimumTargetsMap } from '../dashboard/weeklyMinimumTargets'
import { saveWeeklyMinimumTargets } from '../settings/weeklyMinimumTargetsApi'
import { supabase } from '../../../lib/supabaseClient'

export interface WeeklyMinimumsModalProps {
  isOpen: boolean
  onClose: () => void
  ownerUserId: string
  currentMinimums: WeeklyMinimumTargetsMap
  onSave: (newMinimums: WeeklyMinimumTargetsMap) => void
}

export function WeeklyMinimumsModal({
  isOpen,
  onClose,
  ownerUserId,
  currentMinimums,
  onSave,
}: WeeklyMinimumsModalProps) {
  const [values, setValues] = useState<WeeklyMinimumTargetsMap>(currentMinimums)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sincronizar valores cuando cambia currentMinimums
  useEffect(() => {
    if (isOpen) {
      setValues({ ...currentMinimums })
      setError(null)
    }
  }, [isOpen, currentMinimums])

  const handleValueChange = (metricKey: string, value: string) => {
    const numValue = parseInt(value, 10)
    if (isNaN(numValue) || numValue < 0) {
      return
    }
    setValues((prev) => ({ ...prev, [metricKey]: numValue }))
    setError(null)
  }

  const handleRestoreDefaults = () => {
    setValues({ ...DEFAULT_WEEKLY_MINIMUMS })
    setError(null)
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setError(null)

      await saveWeeklyMinimumTargets(supabase, ownerUserId, values)
      onSave(values)
      onClose()
    } catch (err) {
      console.error('[WeeklyMinimumsModal] Error al guardar:', err)
      setError(err instanceof Error ? err.message : 'Error al guardar configuración')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-surface border border-border rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Mínimos semanales por asesor</h2>
              <p className="text-xs text-muted mt-0.5">Configura los mínimos operativos por métrica</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-black/5 transition-colors"
              disabled={saving}
            >
              <span className="text-xl text-muted">×</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-3">
            {METRIC_MINIMUM_CONFIGS.map((config) => {
              const value = values[config.key] ?? 0
              return (
                <div key={config.key} className="flex items-center justify-between p-3 border border-border rounded">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">{config.label}</span>
                      <div className="group relative">
                        <div className="w-4 h-4 flex items-center justify-center bg-black/5 rounded-full cursor-help">
                          <span className="text-[8px] text-muted">ⓘ</span>
                        </div>
                        <div className="absolute left-0 top-full mt-1 w-48 p-2 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none z-20 shadow-lg">
                          {config.tooltip}
                          <div className="absolute left-4 top-0 -translate-y-full w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-black"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="w-32">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={value}
                      onChange={(e) => handleValueChange(config.key, e.target.value)}
                      disabled={saving}
                      className="w-full px-3 py-1.5 text-sm border border-border rounded-md bg-bg text-text text-right font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex items-center justify-between">
          <button
            onClick={handleRestoreDefaults}
            disabled={saving}
            className="btn btn-secondary text-sm"
          >
            Restaurar defaults
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="btn btn-secondary text-sm"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn btn-primary text-sm"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
