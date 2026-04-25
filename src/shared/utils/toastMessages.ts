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
  | 'okr.activity_registered'
  | 'okr.last_event_undone'
  | 'okr.daily_saved'
  | 'okr.scoring_saved'
  | 'okr.daily_target_saved'
  | 'okr.global_settings_saved'
  | 'okr.admin_only'
  | 'okr.supabase_local'
  | 'okr.auth_reload'

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
  'okr.activity_registered': 'Actividad registrada correctamente',
  'okr.last_event_undone': 'Último registro deshecho correctamente',
  'okr.daily_saved': 'Bitácora del día guardada correctamente',
  'okr.scoring_saved': 'Puntajes guardados correctamente',
  'okr.daily_target_saved': 'Meta diaria guardada correctamente',
  'okr.global_settings_saved': 'Configuración OKR guardada correctamente',
  'okr.admin_only': 'Solo el administrador puede guardar esta configuración',
  'okr.supabase_local':
    'El entorno local no responde. Ejecuta supabase start en tu máquina.',
  'okr.auth_reload': 'Sesión no válida. Recarga la página e inténtalo nuevamente.',
}

export function toastMessage(key: ToastMessageKey): string {
  return MAP[key]
}
