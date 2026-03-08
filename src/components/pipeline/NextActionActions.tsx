import { useState } from 'react'
import { pipelineApi } from '../../features/pipeline/pipeline.api'
import { NextActionChip } from './NextActionChip'
import { NextActionModal } from './NextActionModal'

export function NextActionActions({
  leadId,
  nextActionAt,
  nextActionType,
  onUpdated,
  onToast,
  className = '',
}: {
  leadId: string
  nextActionAt: string | null
  nextActionType: string | null
  onUpdated?: () => void | Promise<void>
  onToast?: (msg: string) => void
  className?: string
}) {
  const [openModal, setOpenModal] = useState(false)

  const handleSave = async (next_action_at: string | null, next_action_type: string | null) => {
    try {
      const normalizedType =
        next_action_type && next_action_type.trim() !== '' ? next_action_type : null
      await pipelineApi.updateLead(leadId, { next_action_at, next_action_type: normalizedType })
      onToast?.('Actualizado')
      await onUpdated?.()
      setOpenModal(false)
    } catch {
      onToast?.('No se pudo guardar')
    }
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 min-w-0 max-w-full ${className}`}
      data-stop-rowclick="true"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <NextActionChip
        nextActionAt={nextActionAt}
        nextActionType={nextActionType}
        onClick={() => setOpenModal(true)}
      />
      <NextActionModal
        isOpen={openModal}
        onClose={() => setOpenModal(false)}
        onSave={handleSave}
        title="Define el próximo paso"
        initialNextActionAt={nextActionAt}
        initialNextActionType={nextActionType}
      />
    </div>
  )
}
