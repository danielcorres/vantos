import { useReducedMotion } from '../../../shared/hooks/useReducedMotion'
import { useAuth } from '../../../shared/auth/AuthProvider'
import { usePolicyForm } from '../hooks/usePolicyForm'
import type { Policy } from '../policies.types'
import { DEFAULT_INSURER } from '../policies.constants'
import { RamoSelect } from './selects/RamoSelect'
import { CurrencySelect } from './selects/CurrencySelect'
import { FrequencySelect } from './selects/FrequencySelect'
import { ReceiptStatusSelect } from './selects/ReceiptStatusSelect'
import { policyFieldClass } from './selects/fieldClasses'

type PolicyFormProps = {
  isOpen: boolean
  onClose: () => void
  editingPolicy: Policy | null
  onSaved: () => void
}

/** Origen de campaña y contabilización: no visible para asesor. */
function useShowPolicyAdvancedFields(): boolean {
  const { role } = useAuth()
  return (
    role === 'manager' ||
    role === 'owner' ||
    role === 'developer' ||
    role === 'super_admin'
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
        className="card w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(ev) => ev.stopPropagation()}
        style={{
          animation: prefersReducedMotion ? 'none' : 'slideUp 200ms ease-out',
        }}
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border/50 dark:border-neutral-800">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" onClick={handleClose} className="btn btn-ghost text-sm px-2 py-1" aria-label="Cerrar">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wide">Datos generales</h3>
            <div>
              <label htmlFor="contractor_name" className="block text-xs font-medium text-muted mb-1">
                Contratante *
              </label>
              <input
                id="contractor_name"
                type="text"
                value={values.contractor_name}
                onChange={(e) => setField('contractor_name', e.target.value)}
                disabled={submitting}
                className={policyFieldClass}
              />
            </div>
            <div>
              <span className="block text-xs font-medium text-muted mb-1">Aseguradora</span>
              <div
                className={`${policyFieldClass} bg-surface/60 dark:bg-neutral-900/60 text-muted`}
                aria-readonly="true"
              >
                {DEFAULT_INSURER}
              </div>
            </div>
            <div>
              <label htmlFor="policy_number" className="block text-xs font-medium text-muted mb-1">
                Número de póliza *
              </label>
              <input
                id="policy_number"
                type="text"
                value={values.policy_number}
                onChange={(e) => setField('policy_number', e.target.value)}
                disabled={submitting}
                className={policyFieldClass}
              />
            </div>
            <RamoSelect
              id="form_ramo"
              label="Ramo *"
              value={values.ramo}
              onChange={(v) => {
                if (v) setField('ramo', v)
              }}
              disabled={submitting}
            />
            <div>
              <label htmlFor="product_name" className="block text-xs font-medium text-muted mb-1">
                Producto *
              </label>
              <input
                id="product_name"
                type="text"
                value={values.product_name}
                onChange={(e) => setField('product_name', e.target.value)}
                disabled={submitting}
                className={policyFieldClass}
              />
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wide">Vigencia</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="start_date" className="block text-xs font-medium text-muted mb-1">
                  Inicio *
                </label>
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
                <label htmlFor="end_date" className="block text-xs font-medium text-muted mb-1">
                  Fin *
                </label>
                <input
                  id="end_date"
                  type="date"
                  value={values.end_date}
                  onChange={(e) => setField('end_date', e.target.value)}
                  disabled={submitting}
                  className={policyFieldClass}
                />
              </div>
            </div>
            <div>
              <label htmlFor="issued_at" className="block text-xs font-medium text-muted mb-1">
                Fecha de emisión
              </label>
              <input
                id="issued_at"
                type="date"
                value={values.issued_at ?? ''}
                onChange={(e) => setField('issued_at', e.target.value ? e.target.value : null)}
                disabled={submitting}
                className={policyFieldClass}
              />
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wide">Prima y pago</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="premium_amount" className="block text-xs font-medium text-muted mb-1">
                  Prima *
                </label>
                <input
                  id="premium_amount"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min={0}
                  value={values.premium_amount || ''}
                  onChange={(e) => setField('premium_amount', Number(e.target.value))}
                  disabled={submitting}
                  className={policyFieldClass}
                />
              </div>
              <CurrencySelect
                label="Moneda *"
                value={values.currency}
                onChange={(c) => setField('currency', c)}
                disabled={submitting}
              />
            </div>
            <FrequencySelect
              label="Frecuencia de pago *"
              value={values.payment_frequency}
              onChange={(f) => setField('payment_frequency', f)}
              disabled={submitting}
            />
            <ReceiptStatusSelect
              id="form_receipt"
              label="Estatus de recibo *"
              value={values.receipt_status}
              onChange={(s) => {
                if (s) setField('receipt_status', s)
              }}
              disabled={submitting}
            />
          </section>

          {showAdvancedSection ? (
            <section className="space-y-3">
              <h3 className="text-xs font-semibold text-muted uppercase tracking-wide">Otros</h3>
              <div>
                <label htmlFor="campaign_source" className="block text-xs font-medium text-muted mb-1">
                  Origen de campaña (opcional)
                </label>
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
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={values.is_countable}
                  onChange={(e) => setField('is_countable', e.target.checked)}
                  disabled={submitting}
                  className="rounded border-border"
                />
                Contabilizar en métricas futuras
              </label>
            </section>
          ) : null}

          {error ? (
            <div className="p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded text-xs text-red-700 dark:text-red-200">
              {error}
            </div>
          ) : null}

          <div className="flex gap-2 justify-end pt-2 border-t border-border/50 dark:border-neutral-800">
            <button type="button" onClick={handleClose} disabled={submitting} className="btn btn-ghost text-xs">
              Cancelar
            </button>
            <button type="submit" disabled={submitting} className="btn btn-primary text-sm font-medium">
              {submitting ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
