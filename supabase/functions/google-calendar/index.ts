/**
 * Google Calendar OAuth (offline) + push create/update/delete a Google Calendar.
 *
 * Secrets: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, OAUTH_STATE_SECRET,
 *          SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, APP_SITE_URL
 */
import { createClient } from '@supabase/supabase-js'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

async function hmacSha256B64Url(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(message)))
  return btoa(String.fromCharCode(...sig))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
}

async function makeState(userId: string, secret: string): Promise<string> {
  const payload = JSON.stringify({ uid: userId, exp: Date.now() + 15 * 60 * 1000 })
  const pB64 = btoa(payload).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
  const sig = await hmacSha256B64Url(secret, pB64)
  return `${pB64}.${sig}`
}

function b64UrlToUtf8(s: string): string {
  let b = s.replaceAll('-', '+').replaceAll('_', '/')
  const pad = b.length % 4
  if (pad) b += '='.repeat(4 - pad)
  return atob(b)
}

async function verifyState(state: string, secret: string): Promise<string | null> {
  const parts = state.split('.')
  if (parts.length !== 2) return null
  const [pB64, sig] = parts
  const expected = await hmacSha256B64Url(secret, pB64)
  if (sig !== expected) return null
  try {
    const payload = JSON.parse(b64UrlToUtf8(pB64))
    if (typeof payload.exp !== 'number' || Date.now() > payload.exp) return null
    if (typeof payload.uid !== 'string') return null
    return payload.uid as string
  } catch {
    return null
  }
}

async function exchangeCode(
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string
): Promise<{ refresh_token?: string; access_token: string; expires_in: number }> {
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  })
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`token exchange failed: ${res.status} ${t}`)
  }
  return res.json()
}

async function fetchGoogleEmail(accessToken: string): Promise<string | null> {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return null
  const j = await res.json()
  return (j.email as string) ?? null
}

async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<{ access_token: string; expires_in: number }> {
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
  })
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`refresh failed: ${res.status} ${t}`)
  }
  return res.json()
}

function toGoogleDateTime(iso: string): { dateTime: string; timeZone?: string } {
  return { dateTime: iso }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const googleClientId = Deno.env.get('GOOGLE_CLIENT_ID')!
  const googleClientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')!
  const stateSecret = Deno.env.get('OAUTH_STATE_SECRET')!
  const appSiteUrl = Deno.env.get('APP_SITE_URL') ?? 'http://localhost:5173'

  const fnUrl = new URL(req.url)
  const redirectUri = `${fnUrl.origin}${fnUrl.pathname}?action=callback`

  const url = new URL(req.url)
  const action = url.searchParams.get('action') ?? ''

  // --- OAuth callback (Google redirect, GET) ---
  if (req.method === 'GET' && action === 'callback') {
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const err = url.searchParams.get('error')
    if (err) {
      return Response.redirect(`${appSiteUrl}/calendar?google_calendar=error&reason=${encodeURIComponent(err)}`, 302)
    }
    if (!code || !state) {
      return Response.redirect(`${appSiteUrl}/calendar?google_calendar=error&reason=missing`, 302)
    }
    try {
      const userId = await verifyState(state, stateSecret)
      if (!userId) throw new Error('invalid_state')
      const tokens = await exchangeCode(code, redirectUri, googleClientId, googleClientSecret)
      if (!tokens.refresh_token) {
        throw new Error('no_refresh_token_prompt_consent')
      }
      const email = await fetchGoogleEmail(tokens.access_token)
      const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString()

      const admin = createClient(supabaseUrl, serviceKey)
      const { error: upErr } = await admin.from('user_google_calendar_links').upsert(
        {
          user_id: userId,
          refresh_token: tokens.refresh_token,
          access_token: tokens.access_token,
          access_token_expires_at: expiresAt,
          calendar_id: 'primary',
          google_email: email,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
      if (upErr) throw upErr
      return Response.redirect(`${appSiteUrl}/calendar?google_calendar=connected`, 302)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'oauth_failed'
      return Response.redirect(`${appSiteUrl}/calendar?google_calendar=error&reason=${encodeURIComponent(msg)}`, 302)
    }
  }

  // --- POST JSON actions (JWT en Authorization) ---
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'missing_authorization' }, 401)
  }
  const jwt = authHeader.replace('Bearer ', '')
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser(jwt as string)
  if (userErr || !user) {
    return json({ error: 'invalid_jwt' }, 401)
  }

  let body: { action?: string; eventId?: string; op?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  const admin = createClient(supabaseUrl, serviceKey)

  if (body.action === 'status') {
    const { data, error } = await admin
      .from('user_google_calendar_links')
      .select('google_email, calendar_id, updated_at')
      .eq('user_id', user.id)
      .maybeSingle()
    if (error) return json({ error: error.message }, 500)
    return json({ connected: !!data, google_email: data?.google_email ?? null })
  }

  if (body.action === 'disconnect') {
    const { error } = await admin.from('user_google_calendar_links').delete().eq('user_id', user.id)
    if (error) return json({ error: error.message }, 500)
    return json({ ok: true })
  }

  if (body.action === 'oauth-start') {
    const state = await makeState(user.id, stateSecret)
    const scope = encodeURIComponent('https://www.googleapis.com/auth/calendar.events')
    const ru = encodeURIComponent(redirectUri)
    const authUrl =
      `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(googleClientId)}` +
      `&redirect_uri=${ru}&response_type=code&scope=${scope}` +
      `&access_type=offline&prompt=consent&state=${encodeURIComponent(state)}`
    return json({ authUrl })
  }

  if (body.action === 'sync') {
    const eventId = body.eventId
    const op = body.op ?? 'upsert'
    if (!eventId) return json({ error: 'missing_eventId' }, 400)

    async function getAccessTokenForGoogle(): Promise<{
      accessToken: string
      calId: string
    } | null> {
      const { data: link, error: le } = await admin
        .from('user_google_calendar_links')
        .select('refresh_token, access_token, access_token_expires_at, calendar_id')
        .eq('user_id', user.id)
        .maybeSingle()
      if (le || !link) return null
      let accessToken = link.access_token as string
      const exp = link.access_token_expires_at ? new Date(link.access_token_expires_at as string).getTime() : 0
      if (!accessToken || exp < Date.now() + 60_000) {
        const rt = await refreshAccessToken(
          link.refresh_token as string,
          googleClientId,
          googleClientSecret
        )
        accessToken = rt.access_token
        const newExp = new Date(Date.now() + rt.expires_in * 1000).toISOString()
        await admin
          .from('user_google_calendar_links')
          .update({ access_token: accessToken, access_token_expires_at: newExp, updated_at: new Date().toISOString() })
          .eq('user_id', user.id)
      }
      const calId = (link.calendar_id as string) || 'primary'
      return { accessToken, calId }
    }

    if (op === 'delete') {
      const { data: ev, error: evErr } = await admin
        .from('calendar_events')
        .select('google_event_id, owner_user_id')
        .eq('id', eventId)
        .maybeSingle()
      if (evErr) return json({ error: evErr.message }, 500)
      if (!ev || ev.owner_user_id !== user.id) return json({ error: 'forbidden' }, 403)
      const gid = ev.google_event_id as string | null
      if (gid) {
        const tok = await getAccessTokenForGoogle()
        if (tok) {
          const del = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(tok.calId)}/events/${encodeURIComponent(gid)}`,
            { method: 'DELETE', headers: { Authorization: `Bearer ${tok.accessToken}` } }
          )
          if (!del.ok && del.status !== 404) {
            const t = await del.text()
            return json({ error: `google_delete_${del.status}`, detail: t }, 502)
          }
        }
      }
      return json({ ok: true })
    }

    const tokMain = await getAccessTokenForGoogle()
    if (!tokMain) return json({ skipped: true, reason: 'not_connected' })
    const { accessToken, calId } = tokMain

    const { data: row, error: evErr } = await admin
      .from('calendar_events')
      .select('*')
      .eq('id', eventId)
      .maybeSingle()
    if (evErr) return json({ error: evErr.message }, 500)
    if (!row || row.owner_user_id !== user.id) return json({ error: 'forbidden' }, 403)

    // Ya no está programada: quitar espejo en Google y limpiar google_event_id.
    if (row.status !== 'scheduled') {
      const staleGid = row.google_event_id as string | null
      if (staleGid) {
        const delG = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(staleGid)}`,
          { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } }
        )
        if (!delG.ok && delG.status !== 404) {
          const t = await delG.text()
          return json({ error: `google_delete_stale_${delG.status}`, detail: t }, 502)
        }
        await admin
          .from('calendar_events')
          .update({ google_event_id: null, updated_at: new Date().toISOString() })
          .eq('id', eventId)
          .eq('owner_user_id', user.id)
      }
      return json({ ok: true, cleaned: true })
    }

    const summary = (row.title as string | null)?.trim() || 'Cita'
    const gBody = {
      summary,
      description: (row.notes as string | null) ?? undefined,
      start: toGoogleDateTime(row.starts_at as string),
      end: toGoogleDateTime(row.ends_at as string),
    }

    const gid = row.google_event_id as string | null
    if (gid) {
      const patch = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(gid)}?conferenceDataVersion=0`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(gBody),
        }
      )
      if (!patch.ok) {
        const t = await patch.text()
        return json({ error: `google_patch_${patch.status}`, detail: t }, 502)
      }
      return json({ ok: true, google_event_id: gid })
    }

    const post = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(gBody),
      }
    )
    if (!post.ok) {
      const t = await post.text()
      return json({ error: `google_create_${post.status}`, detail: t }, 502)
    }
    const created = await post.json()
    const newGid = created.id as string
    const { error: upErr } = await admin
      .from('calendar_events')
      .update({ google_event_id: newGid, updated_at: new Date().toISOString() })
      .eq('id', eventId)
      .eq('owner_user_id', user.id)
    if (upErr) return json({ error: upErr.message }, 500)
    return json({ ok: true, google_event_id: newGid })
  }

  return json({ error: 'unknown_action' }, 400)
})
