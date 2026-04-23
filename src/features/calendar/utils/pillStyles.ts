import type { AppointmentType, AppointmentStatus } from '../types/calendar.types'

const TYPE_CLASS: Record<AppointmentType, string> = {
  call: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200',
  message: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200',
  meeting: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  other: 'bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-200',
}

const STATUS_CLASS: Record<AppointmentStatus, string> = {
  scheduled: 'bg-slate-100 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300',
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200',
  no_show: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  canceled: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200',
}

const TYPE_LABEL: Record<AppointmentType, string> = {
  call: 'Llamada',
  message: 'Mensaje',
  meeting: 'Reunión',
  other: 'Otro',
}

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  scheduled: 'Programada',
  completed: 'Realizada',
  no_show: 'No asistió',
  canceled: 'Cancelada',
}

export function getTypePillClass(type: AppointmentType): string {
  return TYPE_CLASS[type]
}

export function getStatusPillClass(status: AppointmentStatus): string {
  return STATUS_CLASS[status]
}

export function getTypeLabel(type: AppointmentType): string {
  return TYPE_LABEL[type]
}

export function getStatusLabel(status: AppointmentStatus): string {
  return STATUS_LABEL[status]
}

/**
 * Formato corto para hint "Próxima cita: Mar 10:00 · Cierre".
 * Devuelve solo la parte fecha/hora: "Mar 10:00".
 */
export function formatNextAppointmentShort(startsAt: string): string {
  const d = new Date(startsAt)
  const dayShort = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][d.getDay()]
  const time = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  return `${dayShort} ${time}`
}
