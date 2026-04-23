import { supabase } from '../../../lib/supabase'
import { emitGoogleCalendarSyncError } from '../utils/googleCalendarSyncListeners'

export type GoogleCalendarSyncPushResult =
  | { ok: true; skipped?: boolean }
  | { ok: false; message: string }

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
      const message = error.message || 'Error al sincronizar con Google Calendar'
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
    const message = e instanceof Error ? e.message : 'Error de red (Google Calendar)'
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
  const { data: { session } } = await supabase.auth.getSession()
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

export async function startGoogleCalendarOAuth(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return null
  const { data, error } = await supabase.functions.invoke('google-calendar', {
    body: { action: 'oauth-start' },
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  if (error) {
    console.warn('[google-calendar oauth-start]', error.message)
    return null
  }
  return (data as { authUrl?: string })?.authUrl ?? null
}

export async function disconnectGoogleCalendar(): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return false
  const { error } = await supabase.functions.invoke('google-calendar', {
    body: { action: 'disconnect' },
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  if (error) {
    console.warn('[google-calendar disconnect]', error.message)
    return false
  }
  return true
}
