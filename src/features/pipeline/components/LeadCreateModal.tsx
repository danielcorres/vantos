import { useState, useEffect } from 'react'
import type { PipelineStage, CreateLeadInput, Lead } from '../pipeline.api'
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion'
import { displayStageName } from '../../../shared/utils/stageStyles'

interface LeadCreateModalProps {
  stages: PipelineStage[]
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CreateLeadInput) => Promise<Lead>
  /** Tras crear el lead con éxito (antes de cerrar el modal). */
  onLeadCreated?: (lead: Lead) => void
  defaultStageId?: string
  /** Al abrir, prellenar nombre (ej. texto del buscador en otra pantalla). */
  initialFullName?: string
  /** Clases del overlay fijo (p. ej. z-[60] para apilar sobre otro modal). */
  overlayClassName?: string
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function isValidStageId(id: string): boolean {
  return typeof id === 'string' && id.trim() !== '' && UUID_REGEX.test(id.trim())
}

export function LeadCreateModal({
  stages,
  isOpen,
  onClose,
  onSubmit,
  onLeadCreated,
  defaultStageId,
  initialFullName,
  overlayClassName,
}: LeadCreateModalProps) {
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [stageId, setStageId] = useState(stages[0]?.id ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const prefersReducedMotion = useReducedMotion()

  useEffect(() => {
    if (isOpen && stages.length > 0) {
      const validDefault = defaultStageId && stages.some((s) => s.id === defaultStageId)
      setStageId(validDefault ? defaultStageId : (stages.find((s) => s.slug === 'contactos_nuevos')?.id ?? stages[0].id))
    }
  }, [isOpen, stages, defaultStageId])

  useEffect(() => {
    if (!isOpen) return
    setFullName((initialFullName ?? '').trim())
    setPhone('')
  }, [isOpen, initialFullName])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim()) {
      setError('El nombre es requerido')
      return
    }
    if (!isValidStageId(stageId)) {
      setError('Selecciona una etapa válida')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const payload: CreateLeadInput = {
        full_name: fullName.trim(),
        phone: phone.trim() || undefined,
        stage_id: stageId,
      }
      const lead = await onSubmit(payload)
      onLeadCreated?.(lead)
      handleClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al crear el lead'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setFullName('')
    setPhone('')
    setError(null)
    onClose()
  }

  if (!isOpen) return null

  const overlayZ = overlayClassName?.trim() || 'z-50'

  return (
    <div
      className={`fixed inset-0 bg-black/50 flex items-center justify-center p-4 ${overlayZ}`}
      onClick={handleClose}
      style={{
        animation: prefersReducedMotion ? 'none' : 'fadeIn 150ms ease-out',
      }}
    >
      <div
        className="card w-full max-w-md max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        style={{
          animation: prefersReducedMotion ? 'none' : 'slideUp 200ms ease-out',
        }}
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border/50">
          <h2 className="text-lg font-semibold">Nuevo lead</h2>
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-xl text-muted hover:bg-black/5 active:bg-black/10 transition-colors"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div>
            <label htmlFor="full_name" className="block text-xs font-medium text-muted mb-1">
              Nombre *
            </label>
            <input
              id="full_name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              disabled={loading}
              className="w-full px-3 py-2.5 text-sm border border-border rounded bg-bg text-text"
              placeholder="Nombre completo"
            />
          </div>

          <div>
            <label htmlFor="create_phone" className="block text-xs font-medium text-muted mb-1">
              Teléfono
            </label>
            <input
              id="create_phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2.5 text-sm border border-border rounded bg-bg text-text"
              placeholder="10 dígitos"
            />
          </div>

          <div>
            <label htmlFor="stage_id" className="block text-xs font-medium text-muted mb-1">
              Etapa
            </label>
            <select
              id="stage_id"
              value={stageId}
              onChange={(e) => setStageId(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2.5 text-sm border border-border rounded bg-bg text-text"
            >
              {stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {displayStageName(stage.name)}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              {error}
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="btn btn-ghost text-xs"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary text-sm font-medium"
            >
              {loading ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
