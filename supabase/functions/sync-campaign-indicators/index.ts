/**
 * sync-campaign-indicators
 *
 * Sincroniza resultados de campañas desde Google Sheets hacia Supabase.
 *
 * Secrets requeridos:
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL
 *   GOOGLE_PRIVATE_KEY          (con \n reales, no literales)
 *   GOOGLE_SHEET_ID
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SUPABASE_ANON_KEY
 *
 * Columnas requeridas en la hoja `vant_indicadores`:
 *   periodo | clave_asesor | nombre | campaña | metrica | valor
 *
 * Columnas opcionales reconocidas:
 *   camino | zona | tie_breaker_value
 *
 * Comportamiento:
 *   - Solo acepta POST. OPTIONS retorna CORS.
 *   - `periodo` siempre requerido en el body.
 *   - Valida rol del caller: owner | director | seguimiento.
 *   - Protección anti doble-sync: 409 si ya hay un import `running`.
 *   - No autocrear campañas ni tracks desde Sheets.
 *   - No crear awards para campañas tipo `ranking_position`.
 *   - El valor de Google Sheets es el acumulado oficial; Vant no recalcula.
 */

import { createClient } from 'npm:@supabase/supabase-js@2'

// ─── CORS ─────────────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

// ─── Validación de periodo ─────────────────────────────────────────────────────

const PERIODO_PATTERNS = [
  /^\d{4}-\d{2}$/,           // YYYY-MM  (monthly)
  /^\d{4}-H[12]$/,           // YYYY-H1 | YYYY-H2  (semester)
  /^\d{4}-Q[1-4]$/,          // YYYY-Q1..Q4  (quarterly)
  /^\d{4}$/,                 // YYYY  (annual)
]

function isValidPeriodo(s: string): boolean {
  return PERIODO_PATTERNS.some(p => p.test(s))
}

// ─── Normalización de clave_asesor ─────────────────────────────────────────────

function normalizeClave(raw: unknown): string {
  let s = String(raw ?? '').trim()
  // Quitar sufijo ".0" que Excel introduce al exportar números como texto
  if (s.endsWith('.0')) s = s.slice(0, -2)
  return s
}

// ─── Env ──────────────────────────────────────────────────────────────────────

interface Env {
  supabaseUrl: string
  serviceKey: string
  anonKey: string
  googleEmail: string
  googlePrivateKey: string
  sheetId: string
}

function readEnv(): { ok: true; env: Env } | { ok: false; missing: string[] } {
  const required = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_ANON_KEY',
    'GOOGLE_SERVICE_ACCOUNT_EMAIL',
    'GOOGLE_PRIVATE_KEY',
    'GOOGLE_SHEET_ID',
  ] as const
  const missing: string[] = []
  for (const k of required) {
    if (!Deno.env.get(k)) missing.push(k)
  }
  if (missing.length) return { ok: false, missing }
  return {
    ok: true,
    env: {
      supabaseUrl: Deno.env.get('SUPABASE_URL')!,
      serviceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      anonKey: Deno.env.get('SUPABASE_ANON_KEY')!,
      googleEmail: Deno.env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL')!,
      // Corregir \n literales que pueden venir desde secrets de Supabase
      googlePrivateKey: Deno.env.get('GOOGLE_PRIVATE_KEY')!.replace(/\\n/g, '\n'),
      sheetId: Deno.env.get('GOOGLE_SHEET_ID')!,
    },
  }
}

// ─── JWT de Service Account para Google ───────────────────────────────────────

async function importRsaPrivateKey(pem: string): Promise<CryptoKey> {
  const pemContents = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '')
  const der = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0))
  return crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )
}

function b64url(data: Uint8Array | string): string {
  const bytes = typeof data === 'string'
    ? new TextEncoder().encode(data)
    : data
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
}

async function makeGoogleJwt(email: string, privateKey: string, scope: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const claim = {
    iss: email,
    scope,
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claim))}`
  const key = await importRsaPrivateKey(privateKey)
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned)
  )
  return `${unsigned}.${b64url(new Uint8Array(sig))}`
}

async function getGoogleAccessToken(email: string, privateKey: string): Promise<string> {
  const jwt = await makeGoogleJwt(
    email,
    privateKey,
    'https://www.googleapis.com/auth/spreadsheets.readonly'
  )
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Google token error ${res.status}: ${text}`)
  }
  const data = await res.json() as { access_token: string }
  return data.access_token
}

// ─── Leer hoja de Google Sheets ───────────────────────────────────────────────

async function readSheet(
  accessToken: string,
  sheetId: string,
  range: string
): Promise<string[][]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Sheets error ${res.status}: ${text}`)
  }
  const data = await res.json() as { values?: string[][] }
  return data.values ?? []
}

// ─── Tipos internos ────────────────────────────────────────────────────────────

interface CampaignRow {
  id: string
  slug: string
  metric_type: string
  campaign_type: string
  rewards_are_cumulative: boolean
  max_rewards_per_period: number | null
}

interface TrackRow {
  id: string
  campaign_id: string
  slug: string
  metric_type: string | null
}

interface ProfileRow {
  user_id: string
  advisor_code: string
  connection_date: string | null
}

interface LevelRow {
  id: string
  campaign_id: string
  track_id: string | null
  level_order: number
  target_value: number
  win_condition_type: string
  requires_monthly_minimum: boolean
  requires_active_group: boolean
  requires_inforce_ratio: boolean
  requires_limra_index: boolean
  reward_title: string | null
  reward_is_active: boolean
}

interface AggregatedRow {
  periodo: string
  claveNorm: string
  sourceName: string
  campaignSlug: string
  trackSlug: string | null
  metrica: string
  valor: number
  zona: string | null
  tieBreakerValue: number | null
}

// ─── Cálculo de advisor_campaign_month ────────────────────────────────────────

function calcAdvisorCampaignMonth(
  connectionDateStr: string | null,
  periodo: string
): number | null {
  if (!connectionDateStr) return null
  try {
    const conn = new Date(connectionDateStr)
    // Para periodo YYYY-MM tomamos el último día del mes como referencia
    const periodYear = parseInt(periodo.substring(0, 4), 10)
    const periodMonth = periodo.length === 7
      ? parseInt(periodo.substring(5, 7), 10) - 1
      : 11  // Para periodos anuales, diciembre
    const periodDate = new Date(periodYear, periodMonth + 1, 0) // último día del mes
    const diffMs = periodDate.getTime() - conn.getTime()
    if (diffMs < 0) return null
    const months = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30.4375))
    return Math.max(1, months + 1)  // mínimo mes 1
  } catch {
    return null
  }
}

// ─── Determinar si un nivel requiere pending_validation ───────────────────────

function levelRequiresValidation(level: LevelRow): boolean {
  return (
    level.requires_monthly_minimum ||
    level.requires_active_group ||
    level.requires_inforce_ratio ||
    level.requires_limra_index
  )
}

// ─── Sentinel UUID para COALESCE ──────────────────────────────────────────────

const NULL_UUID = '00000000-0000-0000-0000-000000000000'

// ─── Handler principal ────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  // Solo POST
  if (req.method !== 'POST') {
    return json({ error: 'Método no permitido' }, 405)
  }

  // Leer env
  const envResult = readEnv()
  if (!envResult.ok) {
    return json({ error: 'Configuración incompleta', missing: envResult.missing }, 500)
  }
  const env = envResult.env

  // ── Autenticar usuario ───────────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization') ?? ''
  const userToken = authHeader.replace('Bearer ', '')

  const userClient = createClient(env.supabaseUrl, env.anonKey, {
    global: { headers: { Authorization: `Bearer ${userToken}` } },
  })

  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) {
    return json({ error: 'No autenticado' }, 401)
  }

  // ── Leer rol del usuario ─────────────────────────────────────────────────────
  const adminClient = createClient(env.supabaseUrl, env.serviceKey)

  const { data: profileData } = await adminClient
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  const role: string = profileData?.role ?? 'advisor'

  if (!['owner', 'director', 'seguimiento'].includes(role)) {
    return json({ error: 'No autorizado para sincronizar campañas' }, 403)
  }

  // ── Leer y validar body ──────────────────────────────────────────────────────
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Body inválido (se esperaba JSON)' }, 400)
  }

  const periodo = typeof body.periodo === 'string' ? body.periodo.trim() : ''
  if (!periodo) {
    return json({ error: 'El campo `periodo` es requerido' }, 400)
  }
  if (!isValidPeriodo(periodo)) {
    return json({
      error: 'Formato de periodo inválido. Formatos aceptados: YYYY-MM, YYYY-H1, YYYY-H2, YYYY-Q1..Q4, YYYY',
    }, 400)
  }

  // ── Anti doble-sync ──────────────────────────────────────────────────────────
  const { data: runningImport } = await adminClient
    .from('campaign_imports')
    .select('id')
    .eq('periodo', periodo)
    .eq('status', 'running')
    .maybeSingle()

  if (runningImport) {
    return json({
      error: 'Hay una sincronización en progreso para este periodo. Espera a que termine antes de iniciar otra.',
    }, 409)
  }

  // ── Crear registro de import ─────────────────────────────────────────────────
  const { data: importRecord, error: importInsertError } = await adminClient
    .from('campaign_imports')
    .insert({
      source: 'google_sheets',
      periodo,
      status: 'running',
      triggered_by: user.id,
    })
    .select('id')
    .single()

  if (importInsertError || !importRecord) {
    return json({ error: 'No se pudo crear el registro de importación' }, 500)
  }

  const importId: string = importRecord.id

  // Helper para finalizar el import con error
  const failImport = async (message: string): Promise<Response> => {
    await adminClient
      .from('campaign_imports')
      .update({ status: 'error', error_message: message, finished_at: new Date().toISOString() })
      .eq('id', importId)
    return json({ error: message }, 500)
  }

  try {
    // ── Obtener access token de Google ─────────────────────────────────────────
    let accessToken: string
    try {
      accessToken = await getGoogleAccessToken(env.googleEmail, env.googlePrivateKey)
    } catch (e) {
      return await failImport(`Error al autenticar con Google: ${String(e)}`)
    }

    // ── Leer hoja vant_indicadores ─────────────────────────────────────────────
    let rows: string[][]
    try {
      rows = await readSheet(accessToken, env.sheetId, 'vant_indicadores')
    } catch (e) {
      return await failImport(`Error al leer Google Sheets: ${String(e)}`)
    }

    if (rows.length < 2) {
      return await failImport('La hoja vant_indicadores está vacía o no tiene datos')
    }

    // ── Parsear headers ────────────────────────────────────────────────────────
    const headerRow = rows[0].map(h => h.toLowerCase().trim())
    const colIdx = (name: string): number => headerRow.indexOf(name)

    // Columnas requeridas
    const idc = {
      periodo:   colIdx('periodo'),
      clave:     colIdx('clave_asesor'),
      nombre:    colIdx('nombre'),
      campania:  colIdx('campaña'),
      metrica:   colIdx('metrica'),
      valor:     colIdx('valor'),
    }
    const missingCols = Object.entries(idc)
      .filter(([, v]) => v === -1)
      .map(([k]) => k)

    if (missingCols.length > 0) {
      return await failImport(
        `Columnas requeridas no encontradas en vant_indicadores: ${missingCols.join(', ')}`
      )
    }

    // Columnas opcionales
    const iOpt = {
      camino:    colIdx('camino'),
      zona:      colIdx('zona'),
      tieBreaker: colIdx('tie_breaker_value'),
    }

    // ── Cargar catálogos en memoria ────────────────────────────────────────────
    const [
      { data: campaignsData },
      { data: tracksData },
      { data: profilesData },
      { data: levelsData },
    ] = await Promise.all([
      adminClient.from('campaigns').select('id,slug,metric_type,campaign_type,rewards_are_cumulative,max_rewards_per_period').eq('is_active', true),
      adminClient.from('campaign_tracks').select('id,campaign_id,slug,metric_type').eq('is_active', true),
      adminClient.from('profiles').select('user_id,advisor_code,connection_date').not('advisor_code', 'is', null),
      adminClient.from('campaign_levels').select('id,campaign_id,track_id,level_order,target_value,win_condition_type,requires_monthly_minimum,requires_active_group,requires_inforce_ratio,requires_limra_index,reward_title,reward_is_active').eq('is_active', true),
    ])

    const campaigns = (campaignsData ?? []) as CampaignRow[]
    const tracks    = (tracksData ?? []) as TrackRow[]
    const profiles  = (profilesData ?? []) as ProfileRow[]
    const levels    = (levelsData ?? []) as LevelRow[]

    // Mapas para lookup rápido
    const campaignBySlug = new Map<string, CampaignRow>(
      campaigns.map(c => [c.slug, c])
    )
    // trackKey = `${campaign_id}::${slug}`
    const trackByKey = new Map<string, TrackRow>(
      tracks.map(t => [`${t.campaign_id}::${t.slug}`, t])
    )
    // advisor_code → [user_id, connection_date] (puede haber duplicados)
    const profilesByCode = new Map<string, ProfileRow[]>()
    for (const p of profiles) {
      const code = normalizeClave(p.advisor_code)
      if (!code) continue
      if (!profilesByCode.has(code)) profilesByCode.set(code, [])
      profilesByCode.get(code)!.push(p)
    }

    // ── Filtrar y agregar filas del periodo ────────────────────────────────────
    const aggregated = new Map<string, AggregatedRow>()

    for (const row of rows.slice(1)) {
      const rowPeriodo = String(row[idc.periodo] ?? '').trim()
      if (rowPeriodo !== periodo) continue

      const claveNorm    = normalizeClave(row[idc.clave])
      const sourceName   = String(row[idc.nombre] ?? '').trim()
      const campaignSlug = String(row[idc.campania] ?? '').trim()
      const metrica      = String(row[idc.metrica] ?? '').trim()
      const valorRaw     = parseFloat(String(row[idc.valor] ?? '').replace(',', '.'))
      const trackSlug    = iOpt.camino >= 0 ? String(row[iOpt.camino] ?? '').trim() || null : null
      const zona         = iOpt.zona >= 0 ? String(row[iOpt.zona] ?? '').trim() || null : null
      const tbRaw        = iOpt.tieBreaker >= 0 ? parseFloat(String(row[iOpt.tieBreaker] ?? '').replace(',', '.')) : NaN

      if (!claveNorm || !campaignSlug || !metrica || isNaN(valorRaw) || valorRaw < 0) continue

      const aggKey = `${claveNorm}::${campaignSlug}::${trackSlug ?? ''}::${metrica}`

      if (aggregated.has(aggKey)) {
        const existing = aggregated.get(aggKey)!
        existing.valor += valorRaw
        if (!isNaN(tbRaw)) existing.tieBreakerValue = (existing.tieBreakerValue ?? 0) + tbRaw
      } else {
        aggregated.set(aggKey, {
          periodo,
          claveNorm,
          sourceName,
          campaignSlug,
          trackSlug,
          metrica,
          valor: valorRaw,
          zona,
          tieBreakerValue: isNaN(tbRaw) ? null : tbRaw,
        })
      }
    }

    // ── Procesar cada fila agregada ────────────────────────────────────────────
    let rowsProcessed = 0
    let rowsInserted  = 0
    let rowsUpdated   = 0
    let rowsSkipped   = 0
    let unmatchedCount = 0

    const unmatchedRows: Array<Record<string, unknown>> = []

    const addUnmatched = (row: AggregatedRow, reason: string) => {
      unmatchedCount++
      unmatchedRows.push({
        import_id:        importId,
        periodo:          row.periodo,
        clave_asesor:     row.claveNorm,
        source_name:      row.sourceName,
        campaign_slug:    row.campaignSlug,
        track_slug:       row.trackSlug,
        metric_type:      row.metrica,
        value:            row.valor,
        source_zone:      row.zona,
        tie_breaker_value: row.tieBreakerValue,
        reason,
      })
    }

    for (const row of aggregated.values()) {
      rowsProcessed++

      // Buscar campaña
      const campaign = campaignBySlug.get(row.campaignSlug)
      if (!campaign) {
        addUnmatched(row, 'campaign_not_found')
        continue
      }

      // Buscar track (si se especificó)
      let trackId: string | null = null
      if (row.trackSlug) {
        const track = trackByKey.get(`${campaign.id}::${row.trackSlug}`)
        if (!track) {
          addUnmatched(row, 'track_not_found')
          continue
        }
        trackId = track.id

        // Si el track tiene su propio metric_type, validar contra él
        if (track.metric_type && track.metric_type !== row.metrica) {
          addUnmatched(row, 'metric_mismatch')
          continue
        }
      } else {
        // Validar métrica contra la campaña
        if (campaign.metric_type !== row.metrica) {
          addUnmatched(row, 'metric_mismatch')
          continue
        }
      }

      // Buscar perfil(es)
      const matchingProfiles = profilesByCode.get(row.claveNorm) ?? []
      if (matchingProfiles.length === 0) {
        addUnmatched(row, 'advisor_not_found')
        continue
      }
      if (matchingProfiles.length > 1) {
        addUnmatched(row, 'duplicate_advisor_code')
        continue
      }

      const profile = matchingProfiles[0]

      // Calcular advisor_campaign_month para new_advisor_path
      const advisorCampaignMonth =
        campaign.campaign_type === 'new_advisor_path'
          ? calcAdvisorCampaignMonth(profile.connection_date, row.periodo)
          : null

      // Upsert manual en campaign_snapshots.
      // No usamos .upsert() con onConflict porque el índice único es funcional
      // (usa COALESCE) y Supabase no acepta expresiones en onConflict.
      let snapshotQuery = adminClient
        .from('campaign_snapshots')
        .select('id')
        .eq('user_id', profile.user_id)
        .eq('campaign_id', campaign.id)
        .eq('periodo', row.periodo)
        .eq('metric_type', row.metrica)

      snapshotQuery = trackId
        ? snapshotQuery.eq('track_id', trackId)
        : snapshotQuery.is('track_id', null)

      const { data: existingSnap } = await snapshotQuery.maybeSingle()

      if (existingSnap) {
        await adminClient
          .from('campaign_snapshots')
          .update({
            value:                 row.valor,
            source_name:           row.sourceName,
            import_id:             importId,
            advisor_campaign_month: advisorCampaignMonth,
            source_zone:           row.zona,
            tie_breaker_value:     row.tieBreakerValue,
            updated_at:            new Date().toISOString(),
          })
          .eq('id', existingSnap.id)
        rowsUpdated++
      } else {
        await adminClient.from('campaign_snapshots').insert({
          user_id:               profile.user_id,
          campaign_id:           campaign.id,
          track_id:              trackId,
          periodo:               row.periodo,
          metric_type:           row.metrica,
          value:                 row.valor,
          source_name:           row.sourceName,
          source_clave_asesor:   row.claveNorm,
          import_id:             importId,
          advisor_campaign_month: advisorCampaignMonth,
          source_zone:           row.zona,
          tie_breaker_value:     row.tieBreakerValue,
        })
        rowsInserted++
      }

      // ── Detección de premios (no para ranking_position) ──────────────────────
      // Obtener niveles de la campaña/track ordenados por target_value asc
      const campaignLevels = levels
        .filter(l =>
          l.campaign_id === campaign.id &&
          (l.track_id ?? NULL_UUID) === (trackId ?? NULL_UUID)
        )
        .sort((a, b) => a.level_order - b.level_order)

      for (const level of campaignLevels) {
        // No crear awards automáticos para ranking_position
        if (level.win_condition_type === 'ranking_position') continue
        // Solo niveles con premio activo
        if (!level.reward_is_active) continue
        // El asesor debe haber alcanzado el nivel
        if (row.valor < level.target_value) continue

        // Determinar status inicial del award
        const initialStatus =
          campaign.campaign_type === 'new_advisor_path' && levelRequiresValidation(level)
            ? 'pending_validation'
            : 'eligible'

        // Verificar si ya existe un award para este nivel/periodo
        const { data: existingAward } = await adminClient
          .from('campaign_reward_awards')
          .select('id, status')
          .eq('user_id', profile.user_id)
          .eq('campaign_id', campaign.id)
          .eq('level_id', level.id)
          .eq('periodo', row.periodo)
          .maybeSingle()

        if (existingAward) {
          // Solo actualizar value_at_award si está en `eligible`
          if (existingAward.status === 'eligible') {
            await adminClient
              .from('campaign_reward_awards')
              .update({
                value_at_award: row.valor,
                tie_breaker_value_at_award: row.tieBreakerValue,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existingAward.id)
          }
          // Si está en status avanzado, no tocar
        } else {
          // Verificar límite de premios si rewards_are_cumulative = false
          if (!campaign.rewards_are_cumulative && campaign.max_rewards_per_period) {
            const { count } = await adminClient
              .from('campaign_reward_awards')
              .select('id', { count: 'exact', head: true })
              .eq('user_id', profile.user_id)
              .eq('campaign_id', campaign.id)
              .eq('periodo', row.periodo)
              .neq('status', 'cancelled')

            if ((count ?? 0) >= campaign.max_rewards_per_period) continue
          }

          await adminClient.from('campaign_reward_awards').insert({
            user_id:                   profile.user_id,
            campaign_id:               campaign.id,
            track_id:                  trackId,
            level_id:                  level.id,
            periodo:                   row.periodo,
            value_at_award:            row.valor,
            tie_breaker_value_at_award: row.tieBreakerValue,
            status:                    initialStatus,
            awarded_at:                new Date().toISOString(),
          })
        }
      }
    }

    // Insertar filas no vinculadas
    if (unmatchedRows.length > 0) {
      await adminClient.from('campaign_import_unmatched_rows').insert(unmatchedRows)
    }

    // ── Finalizar import ───────────────────────────────────────────────────────
    const finalStatus = unmatchedCount > 0 || rowsSkipped > 0
      ? 'completed_with_warnings'
      : 'completed'

    await adminClient
      .from('campaign_imports')
      .update({
        status:         finalStatus,
        rows_processed: rowsProcessed,
        rows_inserted:  rowsInserted,
        rows_updated:   rowsUpdated,
        rows_skipped:   rowsSkipped,
        unmatched_count: unmatchedCount,
        finished_at:    new Date().toISOString(),
      })
      .eq('id', importId)

    return json({
      ok: true,
      import_id:      importId,
      status:         finalStatus,
      periodo,
      rows_processed: rowsProcessed,
      rows_inserted:  rowsInserted,
      rows_updated:   rowsUpdated,
      rows_skipped:   rowsSkipped,
      unmatched_count: unmatchedCount,
    })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await adminClient
      .from('campaign_imports')
      .update({
        status: 'error',
        error_message: msg,
        finished_at: new Date().toISOString(),
      })
      .eq('id', importId)
    return json({ error: `Error inesperado: ${msg}` }, 500)
  }
})
