/**
 * Rango semanal: lunes 00:00 local -> lunes siguiente 00:00 local (fin exclusivo).
 * Usado para listEventsInRange({ from, to }).
 */

export function getWeekRangeFromDate(date: Date): { from: string; to: string } {
  const d = new Date(date)
  const day = d.getDay() // 0 = Domingo, 1 = Lunes, ...
  const diff = day === 0 ? -6 : 1 - day // días hacia atrás hasta el lunes
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  const from = d.toISOString()
  const nextMonday = new Date(d)
  nextMonday.setDate(nextMonday.getDate() + 7)
  const to = nextMonday.toISOString()
  return { from, to }
}
