import type { PolicyFilters as PolicyFiltersType } from '../policies.types'
import { RamoSelect } from './selects/RamoSelect'
import { ReceiptStatusSelect } from './selects/ReceiptStatusSelect'
import { policyFieldClass } from './selects/fieldClasses'

type PolicyFiltersProps = {
  filters: PolicyFiltersType
  onChange: (next: PolicyFiltersType) => void
}

export function PolicyFilters({ filters, onChange }: PolicyFiltersProps) {
  return (
    <div className="card p-4 space-y-3">
      <h2 className="text-sm font-semibold text-text">Filtros</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <RamoSelect
          id="filter_ramo"
          label="Ramo"
          value={filters.ramo ?? ''}
          onChange={(ramo) => onChange({ ...filters, ramo: ramo || undefined })}
          allowEmpty
        />
        <ReceiptStatusSelect
          id="filter_receipt"
          label="Estatus de recibo"
          value={filters.receipt_status ?? ''}
          onChange={(receipt_status) =>
            onChange({ ...filters, receipt_status: receipt_status || undefined })
          }
          allowEmpty
        />
        <div className="sm:col-span-2 lg:col-span-1">
          <span className="block text-xs font-medium text-muted mb-1">Inicio de vigencia (desde)</span>
          <input
            type="date"
            value={filters.start_date_from ?? ''}
            onChange={(e) =>
              onChange({
                ...filters,
                start_date_from: e.target.value || undefined,
              })
            }
            className={policyFieldClass}
          />
        </div>
        <div className="sm:col-span-2 lg:col-span-1">
          <span className="block text-xs font-medium text-muted mb-1">Inicio de vigencia (hasta)</span>
          <input
            type="date"
            value={filters.start_date_to ?? ''}
            onChange={(e) =>
              onChange({
                ...filters,
                start_date_to: e.target.value || undefined,
              })
            }
            className={policyFieldClass}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-ghost text-xs"
          onClick={() => onChange({})}
        >
          Limpiar filtros
        </button>
      </div>
    </div>
  )
}
