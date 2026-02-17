import { useRef, useState, useEffect } from 'react'
import type { Lead } from '../../features/pipeline/pipeline.api'
import { pipelineApi } from '../../features/pipeline/pipeline.api'
import { NextActionModal } from './NextActionModal'

const STAGE_CONTACTOS_NUEVOS = 'Contactos Nuevos'
const STAGE_CASOS_ABIERTOS = 'Casos Abiertos'
const STAGE_CITAS_CIERRE = 'Citas de Cierre'
const STAGE_SOLICITUDES = 'Solicitudes Ingresadas'

const MENU_HEIGHT_FALLBACK = 280

const CONDITION_OPTIONS: { value: string | null; label: string }[] = [
  { value: null, label: 'Ninguna' },
  { value: 'waiting_client', label: 'Esperando cliente' },
  { value: 'docs_pending', label: 'Pendiente docs' },
  { value: 'paused', label: 'En pausa' },
  { value: 'budget', label: 'Sin presupuesto' },
  { value: 'unreachable', label: 'No localizable' },
]

type FieldKey =
  | 'last_contact_outcome'
  | 'quote_status'
  | 'close_outcome'
  | 'requirements_status'
  | 'application_status'
  | 'lead_condition'

function normVal(s: string | null | undefined): string {
  const v = (s ?? '').trim().toLowerCase()
  return v === '' || v === 'none' ? 'none' : v
}

function isSelected(lead: Lead, field: FieldKey, value: string | null): boolean {
  switch (field) {
    case 'last_contact_outcome':
      return normVal(lead.last_contact_outcome ?? null) === (value ?? 'none')
    case 'quote_status':
      return normVal(lead.quote_status ?? null) === (value ?? 'none')
    case 'close_outcome':
      return normVal(lead.close_outcome ?? null) === (value ?? 'none')
    case 'requirements_status':
      if (value === null) return (lead.requirements_status ?? null) === null || normVal(lead.requirements_status) === 'none'
      return (lead.requirements_status ?? '').toLowerCase() === value
    case 'application_status':
      if (value === null) return (lead.application_status ?? null) === null || normVal(lead.application_status) === 'none'
      return (lead.application_status ?? '').toLowerCase() === value
    case 'lead_condition':
      return (lead.lead_condition ?? null) === value
    default:
      return false
  }
}

function CheckIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}

export function LeadQuickActions({
  lead,
  stageName,
  onUpdated,
  onToast,
}: {
  lead: Lead
  stageName?: string
  onUpdated?: () => void | Promise<void>
  onToast?: (msg: string) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [openUp, setOpenUp] = useState(false)
  const [saving, setSaving] = useState(false)
  const [openNextAction, setOpenNextAction] = useState(false)

  useEffect(() => {
    if (!open) return
    const handleDocPointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const t = setTimeout(() => {
      document.addEventListener('pointerdown', handleDocPointerDown)
    }, 0)
    return () => {
      clearTimeout(t)
      document.removeEventListener('pointerdown', handleDocPointerDown)
    }
  }, [open])

  // Auto-flip: recalcular openUp con altura real del menú una vez renderizado
  useEffect(() => {
    if (!open || !containerRef.current) return
    const menuEl = menuRef.current
    const h = menuEl?.offsetHeight ?? MENU_HEIGHT_FALLBACK
    const rect = containerRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    const shouldOpenUp = spaceBelow < h && spaceAbove > spaceBelow
    setOpenUp(shouldOpenUp)
  }, [open])

  const showEstado =
    stageName === STAGE_CONTACTOS_NUEVOS ||
    stageName === STAGE_CASOS_ABIERTOS ||
    stageName === STAGE_CITAS_CIERRE ||
    stageName === STAGE_SOLICITUDES

  const handleSave = async (updates: Parameters<typeof pipelineApi.updateLead>[1]) => {
    setSaving(true)
    try {
      await pipelineApi.updateLead(lead.id, updates)
      onToast?.('Actualizado')
      await onUpdated?.()
      setOpen(false)
    } catch {
      onToast?.('No se pudo actualizar')
      // Mantener menú abierto y botones habilitados (setSaving(false) en finally)
    } finally {
      setSaving(false)
    }
  }

  const stop = (e: React.MouseEvent) => {
    e.stopPropagation()
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        disabled={saving}
        onMouseDown={stop}
        onClick={(e) => {
          stop(e)
          if (!open) {
            const rect = containerRef.current?.getBoundingClientRect()
            if (rect) {
              const spaceBelow = window.innerHeight - rect.bottom
              const spaceAbove = rect.top
              setOpenUp(
                spaceBelow < MENU_HEIGHT_FALLBACK && spaceAbove > spaceBelow
              )
            }
          }
          setOpen((v) => !v)
        }}
        className="text-xs text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded px-2 py-1 border border-transparent hover:border-neutral-200 disabled:opacity-60 disabled:pointer-events-none"
        aria-expanded={open}
        aria-haspopup="true"
      >
        {saving ? 'Guardando…' : 'Actualizar ▾'}
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          onMouseDown={stop}
          onClick={stop}
          className={`absolute left-0 z-50 min-w-[180px] rounded-lg border border-neutral-200 bg-white shadow-lg py-1 ${
            openUp ? 'bottom-full mb-2' : 'top-full mt-2'
          }`}
        >
          <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-400 border-b border-neutral-100">
            Próxima acción
          </div>
          <div className="py-0.5">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                setOpenNextAction(true)
              }}
              disabled={saving}
              className="w-full text-left px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
            >
              Editar próxima acción
            </button>
          </div>
          {showEstado && (
            <>
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-400 border-b border-neutral-100">
                Estado
              </div>
              {stageName === STAGE_CONTACTOS_NUEVOS && (
                <div className="py-0.5">
                  {[
                    { value: 'none', label: 'Sin intento' },
                    { value: 'no_answer', label: 'No respondió' },
                    { value: 'voicemail', label: 'Buzón' },
                    { value: 'connected', label: 'Contestó' },
                  ].map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      role="menuitem"
                      onClick={() => handleSave({ last_contact_outcome: value })}
                      disabled={saving}
                      className="w-full flex items-center justify-between gap-2 text-left px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
                    >
                      <span>{label}</span>
                      {isSelected(lead, 'last_contact_outcome', value) && (
                        <CheckIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
              {stageName === STAGE_CASOS_ABIERTOS && (
                <div className="py-0.5">
                  {[
                    { value: 'none', label: 'En seguimiento' },
                    { value: 'pending', label: 'Cotización pendiente' },
                    { value: 'done', label: 'Cotización realizada' },
                  ].map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      role="menuitem"
                      onClick={() => handleSave({ quote_status: value })}
                      disabled={saving}
                      className="w-full flex items-center justify-between gap-2 text-left px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
                    >
                      <span>{label}</span>
                      {isSelected(lead, 'quote_status', value) && (
                        <CheckIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
              {stageName === STAGE_CITAS_CIERRE && (
                <div className="py-0.5">
                  {[
                    { value: 'none', label: 'Cierre pendiente' },
                    { value: 'done', label: 'Cierre realizado' },
                    { value: 'no_show', label: 'No se presentó' },
                  ].map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      role="menuitem"
                      onClick={() => handleSave({ close_outcome: value })}
                      disabled={saving}
                      className="w-full flex items-center justify-between gap-2 text-left px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
                    >
                      <span>{label}</span>
                      {isSelected(lead, 'close_outcome', value) && (
                        <CheckIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
              {stageName === STAGE_SOLICITUDES && (
                <>
                  <div className="px-3 pt-1.5 pb-0.5 text-[10px] font-medium text-neutral-500">
                    Requisitos
                  </div>
                  <div className="py-0.5">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => handleSave({ requirements_status: null })}
                      disabled={saving}
                      className="w-full flex items-center justify-between gap-2 text-left px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
                    >
                      <span>Ninguno</span>
                      {isSelected(lead, 'requirements_status', null) && (
                        <CheckIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                      )}
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => handleSave({ requirements_status: 'ra' })}
                      disabled={saving}
                      className="w-full flex items-center justify-between gap-2 text-left px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
                    >
                      <span>En RA</span>
                      {isSelected(lead, 'requirements_status', 'ra') && (
                        <CheckIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                      )}
                    </button>
                  </div>
                  <div className="px-3 pt-1.5 pb-0.5 text-[10px] font-medium text-neutral-500">
                    Solicitud
                  </div>
                  <div className="py-0.5">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => handleSave({ application_status: null })}
                      disabled={saving}
                      className="w-full flex items-center justify-between gap-2 text-left px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
                    >
                      <span>Solicitud pendiente</span>
                      {isSelected(lead, 'application_status', null) && (
                        <CheckIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                      )}
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => handleSave({ application_status: 'submitted' })}
                      disabled={saving}
                      className="w-full flex items-center justify-between gap-2 text-left px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
                    >
                      <span>Falta firma</span>
                      {isSelected(lead, 'application_status', 'submitted') && (
                        <CheckIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                      )}
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => handleSave({ application_status: 'signed' })}
                      disabled={saving}
                      className="w-full flex items-center justify-between gap-2 text-left px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
                    >
                      <span>Firmado</span>
                      {isSelected(lead, 'application_status', 'signed') && (
                        <CheckIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                      )}
                    </button>
                  </div>
                </>
              )}
              <div className="border-t border-neutral-100 my-0.5" />
            </>
          )}
          <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-400 border-b border-neutral-100">
            Condición
          </div>
          <div className="py-0.5">
            {CONDITION_OPTIONS.map(({ value, label }) => (
              <button
                key={value ?? 'none'}
                type="button"
                role="menuitem"
                onClick={() => handleSave({ lead_condition: value })}
                disabled={saving}
                className="w-full flex items-center justify-between gap-2 text-left px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
              >
                <span>{label}</span>
                {isSelected(lead, 'lead_condition', value) && (
                  <CheckIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <NextActionModal
        isOpen={openNextAction}
        onClose={() => setOpenNextAction(false)}
        onSave={async (next_action_at, next_action_type) => {
          const normalizedType =
            next_action_type && next_action_type.trim() !== ''
              ? next_action_type
              : null
          await handleSave({ next_action_at, next_action_type: normalizedType })
          setOpenNextAction(false)
        }}
        title="Editar próxima acción"
        initialNextActionAt={lead.next_action_at}
        initialNextActionType={lead.next_action_type}
      />
    </div>
  )
}
