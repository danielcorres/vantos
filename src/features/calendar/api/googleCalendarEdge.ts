import { supabase } from '../../../lib/supabase'
import { emitGoogleCalendarSyncError } from '../utils/googleCalendarSyncListeners'

export type GoogleCalendarSyncPushResult =
  | { ok: true; skipped?: boolean }
  | { ok: false; message: string }

function mapFunctionsInvokeError(raw: string): string {
  const m = (raw || '').toLowerCase()
  if (m.includes('failed to send') || m.includes('networkerror') || m.includes('load failed')) {
    return (
      'No se pudo contactar la función de Google Calendar en Supabase. ' +
      'Comprueba que la Edge Function `google-calendar` esté desplegada, que existan los secretos ' +
      '(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, OAUTH_STATE_SECRET) y que esté desplegada con ' +
      '`--no-verify-jwt` (el callback de Google es un GET sin JWT).'
    )
  }
  return raw || 'Error al llamar a la función de Google Calendar.'
}

/** Invoca Edge Function `google-calendar` (OAuth + push). Errores → suscriptores + consola. */
export async function invokeGoogleCalendarSync(
  eventId: string,
  op: 'upsert' | 'delete' = 'upsert'
): Promise<GoogleCalendarSyncPushResult> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.access_token) return { ok: true, skipped: true }
    const { data, error } = await supabase.functions.invoke('google-calendar', {
      body: { action: 'sync', eventId, op },
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    if (error) {
      const message = mapFunctionsInvokeError(error.message || 'Error al sincronizar con Google Calendar')
      console.warn('[google-calendar sync]', message)
      emitGoogleCalendarSyncError(message)
      return { ok: false, message }
    }
    const d = data as { ok?: boolean; skipped?: boolean; error?: string; detail?: string } | null
    if (d?.skipped) return { ok: true, skipped: true }
    if (d && typeof d.error === 'string' && d.error.length > 0) {
      const message = d.detail ? `${d.error}: ${d.detail}` : d.error
      console.warn('[google-calendar sync]', message)
      emitGoogleCalendarSyncError(message)
      return { ok: false, message }
    }
    return { ok: true }
  } catch (e) {
    const message = e instanceof Error ? mapFunctionsInvokeError(e.message) : 'Error de red (Google Calendar)'
    console.warn('[google-calendar sync]', e)
    emitGoogleCalendarSyncError(message)
    return { ok: false, message }
  }
}

export type GoogleCalendarConnectionStatus = {
  connected: boolean
  google_email: string | null
}

export async function getGoogleCalendarStatus(): Promise<GoogleCalendarConnectionStatus | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.access_token) return null
  const { data, error } = await supabase.functions.invoke('google-calendar', {
    body: { action: 'status' },
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  if (error) {
    console.warn('[google-calendar status]', error.message)
    return null
  }
  const d = data as { connected?: boolean; google_email?: string | null }
  return { connected: Boolean(d?.connected), google_email: d?.google_email ?? null }
}

export type GoogleOAuthStartResult =
  | { ok: true; authUrl: string }
  | { ok: false; message: string }

/**
 * Inicia OAuth con Google. `returnPath` se firma en el state y determina a qué ruta de la app vuelves
 * (`/profile` o `/calendar`); debe coincidir con rutas permitidas en la Edge Function.
 */
export async function startGoogleCalendarOAuth(options?: {
  returnPath?: '/profile' | '/calendar'
}): Promise<GoogleOAuthStartResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.access_token) {
    return { ok: false, message: 'No hay sesión activa. Inicia sesión de nuevo e inténtalo otra vez.' }
  }
  const returnPath = options?.returnPath ?? '/calendar'
  const { data, error } = await supabase.functions.invoke('google-calendar', {
    body: { action: 'oauth-start', returnPath },
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  if (error) {
    console.warn('[google-calendar oauth-start]', error.message)
    return { ok: false, message: mapFunctionsInvokeError(error.message || '') }
  }
  const authUrl = (data as { authUrl?: string })?.authUrl
  if (!authUrl || typeof authUrl !== 'string') {
    return {
      ok: false,
      message:
        'La función no devolvió URL de autorización. Revisa secretos (GOOGLE_*, OAUTH_STATE_SECRET) y el despliegue.',
    }
  }
  return { ok: true, authUrl }
}

export type DisconnectGoogleCalendarResult = { ok: true } | { ok: false; message: string }

export async function disconnectGoogleCalendar(): Promise<DisconnectGoogleCalendarResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.access_token) {
    return { ok: false, message: 'No hay sesión activa.' }
  }
  const { error } = await supabase.functions.invoke('google-calendar', {
    body: { action: 'disconnect' },
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  if (error) {
    console.warn('[google-calendar disconnect]', error.message)
    return { ok: false, message: mapFunctionsInvokeError(error.message || '') }
  }
  return { ok: true }
}
