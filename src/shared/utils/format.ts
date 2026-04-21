// TODO: Implementar utilidades de formateo
export function formatNumber(value: number): string {
  // TODO: Implementar
  return value.toString()
}

export function formatDate(date: Date): string {
  // TODO: Implementar
  return date.toISOString()
}

/** Formatea un número como moneda en MXN. */
export function formatCurrencyMXN(value: number | string | null | undefined): string {
  if (value == null || value === '') return '—'
  const n = typeof value === 'string' ? parseFloat(value) : value
  if (Number.isNaN(n)) return '—'
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n)
}
