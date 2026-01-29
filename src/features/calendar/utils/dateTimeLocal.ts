/**
 * Helpers para input datetime-local (HTML no usa timezone).
 * Convierten entre ISO string y valor del input 'YYYY-MM-DDTHH:mm'.
 */

/**
 * ISO string -> valor para input datetime-local (YYYY-MM-DDTHH:mm) en hora local del navegador.
 */
export function toDateTimeLocal(isoString: string): string {
  const d = new Date(isoString)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day}T${hh}:${mm}`
}

/**
 * Valor del input datetime-local (YYYY-MM-DDTHH:mm) -> ISO string.
 * El valor se interpreta en hora local del navegador.
 */
export function fromDateTimeLocal(value: string): string {
  if (!value || value.length < 16) return ''
  return new Date(value).toISOString()
}
