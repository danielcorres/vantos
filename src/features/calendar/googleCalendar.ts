/**
 * Integración Google Calendar (Fase 3): variables de entorno y comprobación.
 * El flujo OAuth completo (tokens, Edge Function o backend) se implementa cuando exista `VITE_GOOGLE_CALENDAR_CLIENT_ID`.
 */
export const VITE_GOOGLE_CALENDAR_CLIENT_ID = import.meta.env.VITE_GOOGLE_CALENDAR_CLIENT_ID as
  | string
  | undefined

export function isGoogleCalendarIntegrationConfigured(): boolean {
  return Boolean(VITE_GOOGLE_CALENDAR_CLIENT_ID && String(VITE_GOOGLE_CALENDAR_CLIENT_ID).trim() !== '')
}
