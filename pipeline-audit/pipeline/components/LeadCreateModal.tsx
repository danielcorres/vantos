import { useState, useEffect } from 'react'
import type { PipelineStage, CreateLeadInput } from '../pipeline.api'
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion'
import { displayStageName } from '../../../shared/utils/stageStyles'
import { NextActionModal } from '../../../components/pipeline/NextActionModal'

interface LeadCreateModalProps {
  stages: PipelineStage[]
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CreateLeadInput) => Promise<void>
  defaultStageId?: string
  /** Llamado cuando el usuario cancela el NextActionModal (no se crea el lead) */
  onCancelNextAction?: () => void
}

const SOURCE_OPTIONS = [
  { value: 'Referido', label: 'Referido' },
  { value: 'Mercado natural', label: 'Mercado natural' },
  { value: 'Frío', label: 'Frío' },
  { value: 'Social media', label: 'Social media' },
] as const

const DEFAULT_SOURCE = 'Referido'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function isValidStageId(id: string): boolean {
  return typeof id === 'string' && id.trim() !== '' && UUID_REGEX.test(id.trim())
}

export function LeadCreateModal({
  stages,
  isOpen,
  onClose,
  onSubmit,
  defaultStageId,
  onCancelNextAction,
}: LeadCreateModalProps) {
  const [fullName, setFullName] = useState('')
  const [source, setSource] = useState(DEFAULT_SOURCE)
  const [stageId, setStageId] = useState(stages[0]?.id ?? '')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showNextAction, setShowNextAction] = useState(false)
  const [pendingCreateData, setPendingCreateData] = useState<Omit<CreateLeadInput, 'next_action_at' | 'next_action_type'> | null>(null)
  const prefersReducedMotion = useReducedMotion()

  useEffect(() => {
    if (isOpen && stages.length > 0) {
      const validDefault = defaultStageId && stages.some((s) => s.id === defaultStageId)
      setStageId(validDefault ? defaultStageId : (stages.find((s) => s.slug === 'contactos_nuevos')?.id ?? stages[0].id))
      setSource(DEFAULT_SOURCE)
    }
  }, [isOpen, stages, defaultStageId])

  const handleSubmit = (e: React.FormEvent) => {
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
    setPendingCreateData({
      full_name: fullName.trim(),
      source: source || undefined,
      notes: notes.trim() || undefined,
      stage_id: stageId,
    })
    setShowNextAction(true)
  }

  const handleNextActionSave = async (next_action_at: string, next_action_type: string | null) => {
    if (!pendingCreateData) return
    if (!isValidStageId(pendingCreateData.stage_id)) {
      setError('Selecciona una etapa válida')
      throw new Error('Selecciona una etapa válida')
    }
    setLoading(true)
    setError(null)
    try {
      const normalizedType =
        next_action_type && next_action_type.trim() !== '' ? next_action_type : undefined
      const payload: CreateLeadInput = {
        ...pendingCreateData,
        next_action_at,
        next_action_type: normalizedType,
      }
      await onSubmit(payload)
      setShowNextAction(false)
      setPendingCreateData(null)
      handleClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al crear el lead'
      setError(msg)
      throw err
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setFullName('')
    setSource(DEFAULT_SOURCE)
    setNotes('')
    setError(null)
    setPendingCreateData(null)
    setShowNextAction(false)
    onClose()
  }

  if (!isOpen) return null

  return (
    <>
      <NextActionModal
        isOpen={showNextAction}
        onClose={() => {
          onCancelNextAction?.()
          setShowNextAction(false)
          setPendingCreateData(null)
        }}
        onSave={handleNextActionSave}
        title="Próxima acción (obligatoria)"
      />
    <div
      className={`fixed inset-0 bg-black/50 flex items-center justify-center p-4 ${showNextAction ? 'z-40' : 'z-50'}`}
      onClick={showNextAction ? undefined : handleClose}
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
            onClick={handleClose}
            className="btn btn-ghost text-sm px-2 py-1"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          {/* Nombre */}
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
              className="w-full px-2.5 py-1.5 text-sm border border-border rounded bg-bg text-text"
              placeholder="Nombre completo"
            />
          </div>

          {/* Fuente */}
          <div>
            <label htmlFor="source" className="block text-xs font-medium text-muted mb-1">
              Fuente
            </label>
            <select
              id="source"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              disabled={loading}
              className="w-full px-2.5 py-1.5 text-sm border border-border rounded bg-bg text-text"
            >
              {SOURCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Etapa */}
          <div>
            <label htmlFor="stage_id" className="block text-xs font-medium text-muted mb-1">
              Etapa
            </label>
            <select
              id="stage_id"
              value={stageId}
              onChange={(e) => setStageId(e.target.value)}
              disabled={loading}
              className="w-full px-2.5 py-1.5 text-sm border border-border rounded bg-bg text-text"
            >
              {stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {displayStageName(stage.name)}
                </option>
              ))}
            </select>
          </div>

          {/* Nota rápida */}
          <div>
            <label htmlFor="notes" className="block text-xs font-medium text-muted mb-1">
              Nota rápida (opcional)
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={loading}
              rows={2}
              className="w-full px-2.5 py-1.5 text-sm border border-border rounded bg-bg text-text resize-none"
              placeholder="Nota breve..."
            />
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
              {loading ? 'Creando...' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </>
  )
}
