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
  variant = 'default',
  openExternally = false,
  onExternalClose,
}: {
  leadId: string
  nextActionAt: string | null
  nextActionType: string | null
  onUpdated?: () => void | Promise<void>
  onToast?: (msg: string) => void
  className?: string
  /** "table" = layout de 2 líneas. "kanban" = ligero, 2 líneas. */
  variant?: 'default' | 'table' | 'kanban'
  /** Permite abrir el modal desde fuera (ej. menú de acciones). */
  openExternally?: boolean
  onExternalClose?: () => void
}) {
  const [openModal, setOpenModal] = useState(false)
  const isOpen = openModal || openExternally

  const handleSave = async (next_action_at: string | null, next_action_type: string | null) => {
    try {
      const normalizedType =
        next_action_type && next_action_type.trim() !== '' ? next_action_type : null
      await pipelineApi.updateLead(leadId, { next_action_at, next_action_type: normalizedType })
      onToast?.('Actualizado')
      await onUpdated?.()
      setOpenModal(false)
      onExternalClose?.()
    } catch {
      onToast?.('No se pudo guardar')
    }
  }

  const handleClose = () => {
    setOpenModal(false)
    onExternalClose?.()
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
        variant={variant}
      />
      <NextActionModal
        isOpen={isOpen}
        onClose={handleClose}
        onSave={handleSave}
        title="Define el próximo paso"
        initialNextActionAt={nextActionAt}
        initialNextActionType={nextActionType}
      />
    </div>
  )
}
