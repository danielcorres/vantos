import type { ReactNode } from 'react'
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion'
import { useAuth } from '../../../shared/auth/AuthProvider'
import { usePolicyForm } from '../hooks/usePolicyForm'
import type { Policy } from '../policies.types'
import { DEFAULT_INSURER } from '../policies.constants'
import { RamoPillGroup } from './RamoPillGroup'
import { PremiumCurrencyField } from './PremiumCurrencyField'
import { FrequencySelect } from './selects/FrequencySelect'
import { ReceiptStatusSelect } from './selects/ReceiptStatusSelect'
import { policyFieldClass } from './selects/fieldClasses'

type PolicyFormProps = {
  isOpen: boolean
  onClose: () => void
  editingPolicy: Policy | null
  onSaved: () => void
}

function useShowPolicyAdvancedFields(): boolean {
  const { role } = useAuth()
  return role === 'manager' || role === 'owner' || role === 'developer'
}

function FormFieldLabel({
  htmlFor,
  required,
  help,
  children,
}: {
  htmlFor?: string
  required?: boolean
  help?: string
  children: ReactNode
}) {
  const labelBody = (
    <>
      {children}
      {required ? <span className="text-text dark:text-neutral-200"> *</span> : null}
    </>
  )
  return (
    <div className="flex items-center gap-1 mb-1.5">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="text-xs font-medium text-muted">
          {labelBody}
        </label>
      ) : (
        <span className="text-xs font-medium text-muted">{labelBody}</span>
      )}
      {help ? (
        <button
          type="button"
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border text-[10px] font-semibold text-muted hover:bg-bg dark:border-neutral-600 dark:hover:bg-neutral-800"
          title={help}
          aria-label={help}
        >
          ?
        </button>
      ) : null}
    </div>
  )
}

export function PolicyForm({ isOpen, onClose, editingPolicy, onSaved }: PolicyFormProps) {
  const showAdvancedSection = useShowPolicyAdvancedFields()
  const prefersReducedMotion = useReducedMotion()
  const { values, setField, submitting, error, submit, reset } = usePolicyForm({
    editingPolicy,
    onSaved,
  })

  const title = editingPolicy ? 'Editar póliza' : 'Nueva póliza'

  if (!isOpen) return null

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await submit()
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      onClick={handleClose}
      style={{
        animation: prefersReducedMotion ? 'none' : 'fadeIn 150ms ease-out',
      }}
    >
      <div
        className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(ev) => ev.stopPropagation()}
        style={{
          animation: prefersReducedMotion ? 'none' : 'slideUp 200ms ease-out',
        }}
      >
        <div className="flex items-center justify-between px-4 sm:px-5 pt-4 pb-3 border-b border-border/50 dark:border-neutral-800">
          <h2 className="text-lg font-semibold text-text">{title}</h2>
          <button type="button" onClick={handleClose} className="btn btn-ghost text-sm px-2 py-1" aria-label="Cerrar">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-5">
          <p className="text-xs font-medium text-muted sm:col-span-2">Datos generales</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
            <div>
              <FormFieldLabel htmlFor="contractor_name" required>
                Contratante
              </FormFieldLabel>
              <input
                id="contractor_name"
                type="text"
                value={values.contractor_name}
                onChange={(e) => setField('contractor_name', e.target.value)}
                disabled={submitting}
                className={policyFieldClass}
                placeholder="Nombre del cliente"
              />
            </div>
            <div>
              <FormFieldLabel htmlFor="policy_number" required>
                Número de póliza
              </FormFieldLabel>
              <input
                id="policy_number"
                type="text"
                value={values.policy_number}
                onChange={(e) => setField('policy_number', e.target.value)}
                disabled={submitting}
                className={policyFieldClass}
                placeholder="Ej. 669428518"
              />
            </div>

            <div>
              <FormFieldLabel>Aseguradora</FormFieldLabel>
              <div
                className={`${policyFieldClass} bg-surface/60 text-muted dark:bg-neutral-900/60 dark:text-neutral-400`}
                aria-readonly="true"
              >
                {DEFAULT_INSURER}
              </div>
            </div>
            <div>
              <RamoPillGroup
                id="form_ramo"
                label="Ramo"
                value={values.ramo}
                onChange={(r) => setField('ramo', r)}
                disabled={submitting}
              />
            </div>
          </div>

          <hr className="border-border/60 dark:border-neutral-800" />

          <p className="text-xs font-medium text-muted">Vigencia</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
            <div>
              <FormFieldLabel
                htmlFor="start_date"
                required
                help="Fecha en que inicia la cobertura. Puedes usar el selector de fecha del navegador."
              >
                Inicio de vigencia
              </FormFieldLabel>
              <input
                id="start_date"
                type="date"
                value={values.start_date}
                onChange={(e) => setField('start_date', e.target.value)}
                disabled={submitting}
                className={policyFieldClass}
              />
            </div>
            <div>
              <FormFieldLabel
                htmlFor="end_date"
                required
                help="Fecha de término de la cobertura. Debe ser igual o posterior al inicio."
              >
                Fin de vigencia
              </FormFieldLabel>
              <input
                id="end_date"
                type="date"
                value={values.end_date}
                onChange={(e) => setField('end_date', e.target.value)}
                disabled={submitting}
                className={policyFieldClass}
              />
            </div>
            <div className="sm:col-span-2">
              <FormFieldLabel
                htmlFor="issued_at"
                help="Opcional. Fecha en que la aseguradora emitió la póliza."
              >
                Fecha de emisión
              </FormFieldLabel>
              <input
                id="issued_at"
                type="date"
                value={values.issued_at ?? ''}
                onChange={(e) => setField('issued_at', e.target.value ? e.target.value : null)}
                disabled={submitting}
                className={`${policyFieldClass} max-w-full sm:max-w-xs`}
              />
            </div>
          </div>

          <hr className="border-border/60 dark:border-neutral-800" />

          <p className="text-xs font-medium text-muted">Prima y pago</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
            <div>
              <PremiumCurrencyField
                label="Prima total"
                help="Monto de la prima según el documento. Elige la moneda (MXN, USD o UDI) a la derecha."
                amount={values.premium_amount}
                currency={values.currency}
                onAmountChange={(n) => setField('premium_amount', n)}
                onCurrencyChange={(c) => setField('currency', c)}
                disabled={submitting}
              />
            </div>
            <div>
              <FrequencySelect
                id="form_frequency"
                label="Periodo de pago *"
                value={values.payment_frequency}
                onChange={(f) => setField('payment_frequency', f)}
                disabled={submitting}
              />
            </div>
          </div>

          <hr className="border-border/60 dark:border-neutral-800" />

          <p className="text-xs font-medium text-muted">Producto y recibo</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
            <div>
              <FormFieldLabel htmlFor="product_name" required>
                Producto
              </FormFieldLabel>
              <input
                id="product_name"
                type="text"
                value={values.product_name}
                onChange={(e) => setField('product_name', e.target.value)}
                disabled={submitting}
                className={policyFieldClass}
                placeholder="Nombre del producto"
              />
            </div>
            <div>
              <ReceiptStatusSelect
                id="form_receipt"
                label="Estatus de recibo *"
                value={values.receipt_status}
                onChange={(s) => {
                  if (s) setField('receipt_status', s)
                }}
                disabled={submitting}
              />
            </div>
          </div>

          {showAdvancedSection ? (
            <>
              <hr className="border-border/60 dark:border-neutral-800" />
              <p className="text-xs font-medium text-muted">Otros</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
                <div className="sm:col-span-2">
                  <FormFieldLabel htmlFor="campaign_source">Origen de campaña (opcional)</FormFieldLabel>
                  <input
                    id="campaign_source"
                    type="text"
                    value={values.campaign_source ?? ''}
                    onChange={(e) =>
                      setField('campaign_source', e.target.value.trim() ? e.target.value : null)
                    }
                    disabled={submitting}
                    className={policyFieldClass}
                    placeholder="Para uso futuro"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="flex items-center gap-2 text-sm text-text cursor-pointer dark:text-neutral-200">
                    <input
                      type="checkbox"
                      checked={values.is_countable}
                      onChange={(e) => setField('is_countable', e.target.checked)}
                      disabled={submitting}
                      className="rounded border-border dark:border-neutral-600"
                    />
                    Contabilizar en métricas futuras
                  </label>
                </div>
              </div>
            </>
          ) : null}

          {error ? (
            <div className="p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded text-xs text-red-700 dark:text-red-200">
              {error}
            </div>
          ) : null}

          <div className="flex flex-col gap-2 border-t border-border/50 dark:border-neutral-800 pt-4">
            <button type="button" onClick={handleClose} disabled={submitting} className="btn btn-ghost text-sm self-start">
              Cancelar
            </button>
            <button type="submit" disabled={submitting} className="btn btn-primary w-full py-2.5 text-sm font-medium">
              {submitting ? 'Guardando…' : 'Guardar póliza →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
