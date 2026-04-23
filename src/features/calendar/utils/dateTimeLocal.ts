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

/** Parte `datetime-local` en `YYYY-MM-DD` y `HH:mm` (hora local). */
export function splitDateTimeLocal(dateTimeLocal: string): { date: string; time: string } {
  if (!dateTimeLocal || dateTimeLocal.length < 16) return { date: '', time: '' }
  const [date, rest] = dateTimeLocal.split('T')
  const time = (rest ?? '').slice(0, 5)
  return { date: date ?? '', time: time.length === 5 ? time : '' }
}

/** Une fecha + hora al formato `datetime-local`. */
export function joinDateTimeLocal(date: string, time: string): string {
  const d = (date ?? '').trim()
  const t = (time ?? '').trim()
  if (!d) return ''
  const tt = t.length >= 5 ? t.slice(0, 5) : '09:00'
  return `${d}T${tt}`
}
