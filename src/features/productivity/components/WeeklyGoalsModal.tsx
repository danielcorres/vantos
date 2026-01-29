import { useState, useEffect } from 'react'
import { upsertWeeklyGoals } from '../api/goals.api'
import type { StageSlug } from '../types/productivity.types'
import { STAGE_SLUGS_ORDER } from '../types/productivity.types'

const STAGE_LABELS: Record<StageSlug, string> = {
  contactos_nuevos: 'Contactos Nuevos',
  citas_agendadas: 'Citas Agendadas',
  casos_abiertos: 'Casos Abiertos',
  citas_cierre: 'Citas de Cierre',
  solicitudes_ingresadas: 'Solicitudes Ingresadas',
  casos_ganados: 'Casos Ganados',
}

interface WeeklyGoalsModalProps {
  isOpen: boolean
  onClose: () => void
  initialGoals: Record<StageSlug, number>
  onSaved: (goals: Record<StageSlug, number>) => void
}

export function WeeklyGoalsModal({
  isOpen,
  onClose,
  initialGoals,
  onSaved,
}: WeeklyGoalsModalProps) {
  const [goals, setGoals] = useState<Record<StageSlug, number>>(initialGoals)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setGoals(initialGoals)
      setError(null)
    }
  }, [isOpen, initialGoals])

  const handleChange = (slug: StageSlug, value: string) => {
    const parsed = value === '' ? 0 : parseInt(value, 10)
    if (Number.isNaN(parsed) || parsed < 0) return
    setGoals((prev) => ({ ...prev, [slug]: Math.max(0, parsed) }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const normalized = { ...goals }
      for (const slug of STAGE_SLUGS_ORDER) {
        const v = normalized[slug]
        normalized[slug] = typeof v === 'number' && v >= 0 ? Math.floor(v) : 0
      }
      await upsertWeeklyGoals(normalized)
      onSaved(normalized)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="weekly-goals-modal-title"
    >
      <div
        className="bg-bg border border-border rounded-t-2xl sm:rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-border">
          <h2 id="weekly-goals-modal-title" className="text-lg font-semibold text-text">
            Editar metas semanales
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm p-3">
              {error}
            </div>
          )}

          {STAGE_SLUGS_ORDER.map((slug) => (
            <div key={slug}>
              <label htmlFor={`goal-${slug}`} className="block text-xs font-medium text-muted mb-1">
                {STAGE_LABELS[slug]}
              </label>
              <input
                id={`goal-${slug}`}
                type="number"
                min={0}
                step={1}
                value={goals[slug] ?? 0}
                onChange={(e) => handleChange(slug, e.target.value)}
                className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm tabular-nums"
              />
            </div>
          ))}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-muted hover:bg-black/5 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg disabled:opacity-50 transition-colors"
            >
              {loading ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
