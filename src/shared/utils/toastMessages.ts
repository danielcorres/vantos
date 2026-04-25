export type ToastMessageKey =
  | 'lead.created'
  | 'lead.updated'
  | 'lead.archived'
  | 'lead.restored'
  | 'appointment.created'
  | 'appointment.updated'
  | 'appointment.deleted'
  | 'stage.updated'
  | 'assignment.updated'
  | 'policy.deleted'
  | 'insured.deleted'
  | 'generic.no_changes'
  | 'generic.error_retry'

const MAP: Record<ToastMessageKey, string> = {
  'lead.created': 'Lead creado correctamente',
  'lead.updated': 'Lead actualizado correctamente',
  'lead.archived': 'Lead archivado correctamente',
  'lead.restored': 'Lead restaurado correctamente',
  'appointment.created': 'Cita creada correctamente',
  'appointment.updated': 'Cita actualizada correctamente',
  'appointment.deleted': 'Cita eliminada correctamente',
  'stage.updated': 'Etapa actualizada correctamente',
  'assignment.updated': 'Asignación actualizada correctamente',
  'policy.deleted': 'Póliza eliminada correctamente',
  'insured.deleted': 'Asegurado eliminado correctamente',
  'generic.no_changes': 'Sin cambios por guardar',
  'generic.error_retry': 'Ocurrió un error, inténtalo nuevamente',
}

export function toastMessage(key: ToastMessageKey): string {
  return MAP[key]
}
