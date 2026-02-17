import { useState } from 'react'
import { pipelineApi } from '../../features/pipeline/pipeline.api'
import { NextActionChip } from './NextActionChip'
import { NextActionModal } from './NextActionModal'

/** Tipo para completar: contact | meeting. null si no aplica. */
function getCompletionActionType(t: string | null | undefined): 'contact' | 'meeting' | null {
  const v = (t ?? '').trim().toLowerCase()
  if (v === 'contact' || v === 'call' || v === 'follow_up') return 'contact'
  if (v === 'meeting' || v === 'presentation') return 'meeting'
  return null
}

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
  const [saving, setSaving] = useState(false)
  const [modalAfterComplete, setModalAfterComplete] = useState(false)

  const handleEdit = () => {
    setModalAfterComplete(false)
    setOpenModal(true)
  }

  const handleHecho = async () => {
    const actionType = getCompletionActionType(nextActionType)
    if (!actionType) {
      onToast?.('Define primero el tipo de próximo paso')
      setModalAfterComplete(false)
      setOpenModal(true)
      return
    }
    setSaving(true)
    try {
      await pipelineApi.logNextActionCompletion(leadId, actionType)
      onToast?.('Listo. Define el siguiente paso.')
      setModalAfterComplete(true)
      setOpenModal(true)
    } catch {
      onToast?.('No se pudo registrar')
    } finally {
      setSaving(false)
    }
  }

  const handleSave = async (next_action_at: string, next_action_type: string | null) => {
    setSaving(true)
    try {
      const normalizedType =
        next_action_type && next_action_type.trim() !== '' ? next_action_type : null
      await pipelineApi.updateLead(leadId, { next_action_at, next_action_type: normalizedType })
      onToast?.('Actualizado')
      await onUpdated?.()
      setOpenModal(false)
      setModalAfterComplete(false)
    } catch {
      onToast?.('No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 shrink-0 ${className}`}
      data-stop-rowclick="true"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <NextActionChip
        nextActionAt={nextActionAt}
        nextActionType={nextActionType}
        onClick={handleEdit}
      />
      <button
        type="button"
        data-stop-rowclick="true"
        disabled={saving}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          handleHecho()
        }}
        className="text-xs text-neutral-500 hover:text-neutral-800 hover:underline disabled:opacity-50 disabled:pointer-events-none shrink-0"
      >
        Hecho
      </button>
      <NextActionModal
        isOpen={openModal}
        onClose={() => {
          setOpenModal(false)
          setModalAfterComplete(false)
        }}
        onSave={handleSave}
        title={modalAfterComplete ? 'Define el siguiente paso' : 'Define el próximo paso'}
        initialNextActionAt={modalAfterComplete ? undefined : nextActionAt}
        initialNextActionType={modalAfterComplete ? undefined : nextActionType}
      />
    </div>
  )
}
