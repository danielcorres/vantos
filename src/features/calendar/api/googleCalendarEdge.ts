import { supabase } from '../../../lib/supabase'
import { GOOGLE_CALENDAR_INTEGRATION_ENABLED } from '../config/googleCalendarIntegrationEnabled'
import { emitGoogleCalendarSyncError } from '../utils/googleCalendarSyncListeners'

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, '') ?? ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** Misma ruta que debe coincidir con el callback registrado en Google Cloud Console. */
export const GOOGLE_CALENDAR_EDGE_PATH = '/functions/v1/google-calendar' as const

type GoogleCalendarFnBody = {
  error?: string
  missing_keys?: string[]
}

function logGoogleCalendarInvokeFailure(context: string, json: unknown, hint: string): void {
  const body = json as GoogleCalendarFnBody | null
  if (body?.error === 'server_misconfigured' && Array.isArray(body.missing_keys) && body.missing_keys.length > 0) {
    console.error(
      `[google-calendar ${context}] Falta secretos en Supabase (Project Settings → Edge Functions → Secrets). ` +
        `Definir: ${body.missing_keys.join(', ')}`
    )
    return
  }
  if (body?.error) {
    console.error(`[google-calendar ${context}]`, body.error, json)
    return
  }
  console.warn(`[google-calendar ${context}]`, hint, json)
}

function misconfiguredUserMessage(json: unknown): string | null {
  const body = json as GoogleCalendarFnBody | null
  if (body?.error === 'server_misconfigured' && Array.isArray(body.missing_keys) && body.missing_keys.length > 0) {
    return (
      'El calendario de Google no está configurado en el servidor. ' +
      `Faltan variables en Supabase (Edge Functions → Secrets): ${body.missing_keys.join(', ')}.`
    )
  }
  return null
}

/** Pistas cuando el fallo viene de OAuth (p. ej. redirect_uri_mismatch en intercambio de código). */
function googleOAuthRedirectMismatchHint(json: unknown): string | null {
  const blob = typeof json === 'string' ? json : JSON.stringify(json ?? {})
  if (!blob.toLowerCase().includes('redirect_uri_mismatch')) return null
  return (
    'Google rechazó la URI de redirección OAuth. En Google Cloud Console → Credenciales → tu cliente OAuth → ' +
    '«URI de redireccionamiento autorizados», añade exactamente (HTTPS, con /functions/v1/): ' +
    'https://<project-ref>.supabase.co/functions/v1/google-calendar?action=callback ' +
    '(sustituye <project-ref> por el ref de tu proyecto; debe coincidir con el host de VITE_SUPABASE_URL).'
  )
}

/**
 * POST a la Edge Function leyendo siempre el JSON (p. ej. 503 + missing_keys).
 * `supabase.functions.invoke` no expone el cuerpo en muchos errores no-2xx.
 */
async function postGoogleCalendar(body: Record<string, unknown>): Promise<{
  ok: boolean
  status: number
  json: unknown
}> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { ok: false, status: 0, json: { error: 'missing_vite_env' } }
  }
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.access_token) {
    return { ok: false, status: 401, json: { error: 'no_session' } }
  }
  const url = `${SUPABASE_URL}${GOOGLE_CALENDAR_EDGE_PATH}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let json: unknown = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = { error: 'invalid_json_response', preview: text.slice(0, 120) }
  }
  return { ok: res.ok, status: res.status, json }
}

export type GoogleCalendarSyncPushResult =
  | { ok: true; skipped?: boolean }
  | { ok: false; message: string }

function mapFunctionsInvokeError(raw: string): string {
  const m = (raw || '').toLowerCase()
  if (m.includes('failed to send') || m.includes('networkerror') || m.includes('load failed')) {
    console.error(
      '[google-calendar] Edge Function unreachable. Deploy: npm run functions:deploy:prod (or :staging). ' +
        'Secrets: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, OAUTH_STATE_SECRET, APP_SITE_URL. ' +
        'Use --no-verify-jwt (see package.json scripts). Raw:',
      raw
    )
    return 'No se pudo conectar con Google Calendar. Intenta de nuevo en unos momentos.'
  }
  return raw || 'Error al llamar a la función de Google Calendar.'
}

/** Invoca Edge Function `google-calendar` (OAuth + push). Errores → suscriptores + consola. */
export async function invokeGoogleCalendarSync(
  eventId: string,
  op: 'upsert' | 'delete' = 'upsert'
): Promise<GoogleCalendarSyncPushResult> {
  if (!GOOGLE_CALENDAR_INTEGRATION_ENABLED) return { ok: true, skipped: true }
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.access_token) return { ok: true, skipped: true }

    const { ok, status, json } = await postGoogleCalendar({ action: 'sync', eventId, op })
    if (!ok) {
      logGoogleCalendarInvokeFailure('sync', json, `HTTP ${status}`)
      const specific = misconfiguredUserMessage(json) ?? googleOAuthRedirectMismatchHint(json)
      const message =
        specific ??
        mapFunctionsInvokeError(
          typeof (json as { error?: string })?.error === 'string'
            ? (json as { error: string }).error
            : `HTTP ${status}`
        )
      console.warn('[google-calendar sync]', message)
      emitGoogleCalendarSyncError(message)
      return { ok: false, message }
    }
    const d = json as { ok?: boolean; skipped?: boolean; error?: string; detail?: string } | null
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
  if (!GOOGLE_CALENDAR_INTEGRATION_ENABLED) return null
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.access_token) return null

  const { ok, status, json } = await postGoogleCalendar({ action: 'status' })
  if (!ok) {
    logGoogleCalendarInvokeFailure('status', json, `HTTP ${status}`)
    return null
  }
  const d = json as { connected?: boolean; google_email?: string | null }
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
  if (!GOOGLE_CALENDAR_INTEGRATION_ENABLED) {
    return {
      ok: false,
      message: 'La conexión con Google Calendar no está disponible en este momento.',
    }
  }
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.access_token) {
    return { ok: false, message: 'No hay sesión activa. Inicia sesión de nuevo e inténtalo otra vez.' }
  }
  const returnPath = options?.returnPath ?? '/calendar'
  const { ok, status, json } = await postGoogleCalendar({ action: 'oauth-start', returnPath })
  if (!ok) {
    logGoogleCalendarInvokeFailure('oauth-start', json, `HTTP ${status}`)
    const specific = misconfiguredUserMessage(json) ?? googleOAuthRedirectMismatchHint(json)
    return {
      ok: false,
      message:
        specific ??
        mapFunctionsInvokeError(
          typeof (json as { error?: string })?.error === 'string'
            ? (json as { error: string }).error
            : `HTTP ${status}`
        ),
    }
  }
  const authUrl = (json as { authUrl?: string })?.authUrl
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
  if (!GOOGLE_CALENDAR_INTEGRATION_ENABLED) {
    return { ok: false, message: 'La conexión con Google Calendar no está disponible en este momento.' }
  }
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.access_token) {
    return { ok: false, message: 'No hay sesión activa.' }
  }
  const { ok, status, json } = await postGoogleCalendar({ action: 'disconnect' })
  if (!ok) {
    logGoogleCalendarInvokeFailure('disconnect', json, `HTTP ${status}`)
    const specific = misconfiguredUserMessage(json) ?? googleOAuthRedirectMismatchHint(json)
    return {
      ok: false,
      message:
        specific ??
        mapFunctionsInvokeError(
          typeof (json as { error?: string })?.error === 'string'
            ? (json as { error: string }).error
            : `HTTP ${status}`
        ),
    }
  }
  return { ok: true }
}
