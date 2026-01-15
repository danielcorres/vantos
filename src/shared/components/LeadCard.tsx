import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { pipelineApi } from '../../features/pipeline/pipeline.api'
import { generateIdempotencyKey } from '../../features/pipeline/pipeline.store'
import { formatDate } from '../utils/focusHelpers'

type Stage = {
  id: string
  name: string
  position: number
}

type LeadCardProps = {
  leadId: string
  leadName: string | null
  stageId?: string | null
  stageName?: string | null
  slaStatus?: 'breach' | 'warn' | 'ok' | 'none' | null
  slaDaysLeft?: number | null
  slaDueAt?: string | null
  daysInStage?: number | null
  stages?: Stage[]
  onMoveSuccess?: () => void
  compact?: boolean
}

// Helper: Format date to human readable
function formatHumanDate(dateString: string | null | undefined): string {
  if (!dateString) return ''
  try {
    const date = new Date(dateString)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const diffDays = Math.floor((today.getTime() - dateOnly.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Hoy'
    if (diffDays === 1) return 'Ayer'
    if (diffDays > 1 && diffDays <= 7) return `Hace ${diffDays} días`
    return formatDate(dateString)
  } catch {
    return formatDate(dateString)
  }
}

function getSlaBadgeClass(status: LeadCardProps['slaStatus']): string {
  if (status === 'breach') return 'badge badge-overdue'
  if (status === 'warn') return 'badge badge-warn'
  if (status === 'ok') return 'badge badge-ok'
  return 'badge badge-none'
}

function getSlaBadgeLabel(status: LeadCardProps['slaStatus']): string {
  if (!status || status === 'none') return 'Sin SLA'
  if (status === 'breach') return 'Vencido'
  if (status === 'warn') return 'Por vencer'
  if (status === 'ok') return 'En tiempo'
  return 'Sin SLA'
}

function getSlaBorderClass(status: LeadCardProps['slaStatus']): string {
  if (status === 'breach') return 'border-l-[3px] border-l-danger'
  if (status === 'warn') return 'border-l-[3px] border-l-warning'
  if (status === 'ok') return 'border-l-[3px] border-l-success'
  return 'border-l-[3px] border-l-border'
}

export function LeadCard({
  leadId,
  leadName,
  stageId,
  stageName,
  slaStatus,
  slaDueAt,
  stages = [],
  onMoveSuccess,
}: LeadCardProps) {
  const navigate = useNavigate()
  const [selectedStageId, setSelectedStageId] = useState(stageId || '')
  const [moving, setMoving] = useState(false)
  const [moveMessage, setMoveMessage] = useState<string | null>(null)

  const handleMoveStage = async () => {
    if (!stageId || !selectedStageId || selectedStageId === stageId) return

    setMoving(true)
    setMoveMessage(null)

    try {
      const idempotencyKey = generateIdempotencyKey(leadId, stageId, selectedStageId)
      await pipelineApi.moveLeadStage(leadId, selectedStageId, idempotencyKey)

      setMoveMessage('✓')
      setTimeout(() => {
        setMoveMessage(null)
        onMoveSuccess?.()
      }, 1000)
    } catch (err) {
      setMoveMessage('Error')
      setTimeout(() => setMoveMessage(null), 2000)
    } finally {
      setMoving(false)
    }
  }

  const displayName = leadName || `Lead ${leadId.slice(0, 8)}...`

  return (
    <div className={`card ${getSlaBorderClass(slaStatus)}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold leading-tight m-0 mb-1">
            {displayName}
          </h3>
          {stageName && (
            <div className="text-xs text-muted">{stageName}</div>
          )}
        </div>
        <div className={getSlaBadgeClass(slaStatus)}>
          {getSlaBadgeLabel(slaStatus)}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mb-2.5 flex-wrap">
        <button
          onClick={() => navigate(`/leads/${leadId}`)}
          className="btn btn-primary text-xs px-3 py-1.5 flex-1 sm:flex-none"
        >
          Abrir
        </button>
        <button
          onClick={() => navigate(`/pipeline?lead=${leadId}`)}
          className="btn btn-ghost text-xs px-3 py-1.5 flex-1 sm:flex-none"
        >
          Pipeline
        </button>
      </div>

      {/* Move Stage (if available) */}
      {stageId && stages.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-muted whitespace-nowrap">Etapa:</span>
          <select
            value={selectedStageId}
            onChange={(e) => setSelectedStageId(e.target.value)}
            disabled={moving}
            className="select flex-1 min-w-[120px]"
          >
            {stages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
          </select>
          <button
            onClick={handleMoveStage}
            disabled={moving || !selectedStageId || selectedStageId === stageId}
            className="btn btn-primary text-xs px-2.5 py-1 whitespace-nowrap"
          >
            {moving ? '...' : moveMessage || '✓'}
          </button>
        </div>
      )}

      {/* Due Date (compact) */}
      {slaDueAt && (
        <div
          className="mt-2 text-[11px] text-muted"
          title={formatDate(slaDueAt)}
        >
          Vence: {formatHumanDate(slaDueAt)}
        </div>
      )}
    </div>
  )
}
