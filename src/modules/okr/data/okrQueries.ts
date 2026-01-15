import { supabase } from '../../../lib/supabaseClient'
import { timestampToYmdInTz, TZ_MTY } from '../../../shared/utils/dates'

export type MetricScore = {
  metric_key: string
  points_per_unit: number
}

export type DailyEntry = {
  metric_key: string
  value: number
}

export type PointsProgress = {
  date_local: string
  current_points: number
  base_target: number
  stretch_target: number
  extra_points: number
}

export type OkrStreak = {
  streak_days: number
  last_logged_date: string | null
  is_alive: boolean
  grace_days_left: number
}

export type OkrTier = {
  key: string
  min: number
  max: number
  label: string
  message: string
  tone: string
  color: string
}

export type OkrSettingsGlobal = {
  id?: string // UUID de la fila (opcional, solo cuando viene de SELECT directo)
  owner_user_id: string | null
  daily_base_target: number
  weekly_days: number
  tiers: OkrTier[]
}

export const okrQueries = {
  /**
   * Obtener scores configurados por métrica (GLOBAL)
   * Usa okr_metric_scores_global para scoring consistente para todos los usuarios
   */
  async getMetricScores(): Promise<MetricScore[]> {
    const { data, error } = await supabase
      .from('okr_metric_scores_global')
      .select('metric_key, points_per_unit')
      .order('metric_key')

    if (error) throw error
    return data || []
  },

  /**
   * Upsert score para una métrica (legacy, usar saveMetricScores para bulk)
   */
  async upsertMetricScore(metric_key: string, points_per_unit: number): Promise<void> {
    if (points_per_unit < 0 || !Number.isInteger(points_per_unit)) {
      throw new Error('points_per_unit must be a non-negative integer')
    }

    // Usar RPC en lugar de REST directo para evitar problemas de RLS
    await this.saveMetricScores([{ metric_key, points_per_unit }])
  },

  /**
   * Guardar scores en bulk usando RPC (evita problemas de RLS)
   */
  async saveMetricScores(entries: Array<{ metric_key: string; points_per_unit: number }>): Promise<void> {
    // Validar entries
    for (const entry of entries) {
      if (!entry.metric_key || typeof entry.metric_key !== 'string') {
        throw new Error('Each entry must have a valid metric_key')
      }
      if (typeof entry.points_per_unit !== 'number' || entry.points_per_unit < 0 || !Number.isInteger(entry.points_per_unit)) {
        throw new Error(`points_per_unit must be a non-negative integer for metric_key: ${entry.metric_key}`)
      }
    }

    const entriesJson = entries.map((e) => ({
      metric_key: e.metric_key,
      points_per_unit: e.points_per_unit,
    }))

    const { error } = await supabase.rpc('upsert_okr_metric_scores', {
      p_entries: entriesJson,
    })

    if (error) {
      // Si es error de autorización, lanzar error específico
      if (error.code === '42501' || error.message?.includes('Only owner') || error.message?.includes('Not authorized')) {
        throw new Error('Solo el administrador puede guardar la configuración de puntajes')
      }
      throw error
    }
  },

  /**
   * Obtener entradas guardadas para una fecha local
   * SOLO eventos okr_daily manual (no pipeline)
   * IMPORTANTE: Filtra por actor_user_id = auth.uid() para que cada usuario vea solo su actividad
   */
  async getDailyEntries(dateLocal: string): Promise<Record<string, number>> {
    // Obtener usuario actual (requerido para filtrar)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('Not authenticated')
    }

    // Query directa filtrando SOLO okr_daily manual del usuario actual
    // Convertir dateLocal (YYYY-MM-DD en Monterrey) a timestamps UTC para query
    const [y, m, d] = dateLocal.split('-').map(Number)
    // Crear timestamps en UTC para el inicio y fin del día en Monterrey
    // Usar UTC-6 como aproximación (Monterrey está en UTC-6 o UTC-5 según DST)
    const dateStart = new Date(Date.UTC(y, m - 1, d, 6, 0, 0)) // 00:00 Monterrey ≈ 06:00 UTC
    const dateEnd = new Date(Date.UTC(y, m - 1, d + 1, 5, 59, 59)) // 23:59 Monterrey ≈ 05:59 UTC siguiente día

    const { data, error } = await supabase
      .from('activity_events')
      .select('metric_key, value, recorded_at, metadata')
      .eq('actor_user_id', user.id) // CRÍTICO: Filtrar por usuario actual
      .eq('source', 'manual')
      .eq('is_void', false)
      .gte('recorded_at', dateStart.toISOString())
      .lt('recorded_at', dateEnd.toISOString())
      .order('recorded_at', { ascending: false })

    if (error) throw error

    // Filtrar SOLO eventos okr_daily y agrupar por metric_key
    const entries: Record<string, number> = {}
    const seen = new Set<string>()

    for (const event of data || []) {
      // Verificar que es okr_daily (filtro principal)
      const entrySource = event.metadata?.entry_source
      if (entrySource !== 'okr_daily') {
        continue // Saltar eventos que no son okr_daily
      }

      // Verificar metadata.date_local si existe, o convertir recorded_at a YYYY-MM-DD en Monterrey
      const eventDateLocal =
        event.metadata?.date_local ||
        timestampToYmdInTz(event.recorded_at, TZ_MTY)

      if (eventDateLocal === dateLocal && !seen.has(event.metric_key)) {
        entries[event.metric_key] = event.value
        seen.add(event.metric_key)
      }
    }

    return entries
  },

  /**
   * Guardar entradas diarias (bulk)
   */
  async saveDailyEntries(dateLocal: string, entries: DailyEntry[]): Promise<void> {
    // Validar y normalizar dateLocal a formato 'YYYY-MM-DD'
    // dateLocal ya debe venir en formato YYYY-MM-DD desde el frontend
    let dateStr: string
    if (typeof dateLocal === 'string') {
      // Si ya es string, asegurar formato YYYY-MM-DD
      const dateMatch = dateLocal.match(/^(\d{4}-\d{2}-\d{2})/)
      if (dateMatch) {
        dateStr = dateMatch[1]
      } else {
        throw new Error(`Invalid date format: ${dateLocal}. Expected YYYY-MM-DD`)
      }
    } else {
      throw new Error(`Invalid date type: ${typeof dateLocal}. Expected string YYYY-MM-DD`)
    }

    // Validar y normalizar entries: convertir values a enteros >= 0
    const entriesArray = entries.map((e) => {
      if (!e.metric_key || typeof e.metric_key !== 'string') {
        throw new Error(`Invalid metric_key: ${e.metric_key}`)
      }

      // Convertir value a entero usando parseInt como especificado
      const raw = e.value ?? 0
      const n = parseInt(String(raw), 10)
      const value = Number.isFinite(n) && n >= 0 ? n : 0

      return {
        metric_key: String(e.metric_key),
        value: value,
      }
    })

    // Preparar payload exacto para el RPC
    const payload = {
      p_date_local: dateStr,
      p_entries: entriesArray,
    }

    // Llamar al RPC con logging
    const { error } = await supabase.rpc('upsert_daily_metrics', payload)

    if (error) {
      // Logging útil para debugging
      console.error('Error calling upsert_daily_metrics:', {
        error,
        payload,
        dateStr,
        entriesArray,
      })
      throw new Error(error.message || `Error al guardar entradas diarias: ${JSON.stringify(error)}`)
    }
  },

  /**
   * Obtener progreso de puntos para una fecha
   */
  async getPointsProgress(dateLocal: string): Promise<PointsProgress> {
    const { data, error } = await supabase.rpc('get_okr_points_progress', {
      p_date_local: dateLocal,
    })

    if (error) throw error
    if (!data || data.length === 0) {
      // Default si no hay datos
      return {
        date_local: dateLocal,
        current_points: 0,
        base_target: 100,
        stretch_target: 150,
        extra_points: 0,
      }
    }

    return data[0] as PointsProgress
  },

  /**
   * Obtener progreso semanal de puntos (total acumulado de la semana)
   */
  async getWeekPointsProgress(): Promise<{
    total_week_points: number
    week_start_local: string
    week_end_local: string
  }> {
    const { data, error } = await supabase.rpc('get_okr_week_points_progress')

    if (error) throw error
    if (!data || data.length === 0) {
      return {
        total_week_points: 0,
        week_start_local: '',
        week_end_local: '',
      }
    }

    return {
      total_week_points: data[0].total_week_points || 0,
      week_start_local: data[0].week_start_local || '',
      week_end_local: data[0].week_end_local || '',
    }
  },

  /**
   * Obtener racha con tolerancia de 1 día
   */
  async getOkrStreakWithGrace(): Promise<OkrStreak> {
    const { data, error } = await supabase.rpc('get_okr_streak_with_grace')

    if (error) throw error
    if (!data || data.length === 0) {
      // Default si no hay datos
      return {
        streak_days: 0,
        last_logged_date: null,
        is_alive: false,
        grace_days_left: 0,
      }
    }

    return data[0] as OkrStreak
  },

  /**
   * Obtener configuración global de OKR (settings + tiers)
   */
  async getOkrSettingsGlobal(): Promise<OkrSettingsGlobal> {
    const { data, error } = await supabase.rpc('get_okr_settings_global')

    if (error) throw error
    if (!data || data.length === 0) {
      // Default si no hay datos
      return {
        owner_user_id: null,
        daily_base_target: 25,
        weekly_days: 5,
        tiers: [
          {
            key: 'warmup',
            min: 0,
            max: 39,
            label: 'Calentando motores',
            message: 'Empieza con una victoria pequeña: 1 llamada + 1 seguimiento.',
            tone: 'neutral',
            color: 'slate',
          },
          {
            key: 'momentum',
            min: 40,
            max: 79,
            label: 'En ritmo',
            message: 'Vas bien. Un empujón: agenda 1 cita hoy.',
            tone: 'info',
            color: 'blue',
          },
          {
            key: 'expected',
            min: 80,
            max: 119,
            label: 'Actividad esperada',
            message: 'Excelente. Ya estás en el estándar del día.',
            tone: 'success',
            color: 'green',
          },
          {
            key: 'overdrive',
            min: 120,
            max: 1000,
            label: 'Alto rendimiento',
            message: '🔥 Día imparable. Si repites esto, tu semana se dispara.',
            tone: 'special',
            color: 'amber',
          },
        ],
      }
    }

    const row = data[0]
    return {
      owner_user_id: row.owner_user_id,
      daily_base_target: row.daily_expected_points || row.daily_base_target || 25, // Compatibilidad con ambos nombres
      weekly_days: row.weekly_days,
      tiers: Array.isArray(row.tiers) ? row.tiers : [],
    }
  },

  /**
   * Obtener la fila singleton de okr_settings_global (con id)
   */
  async getGlobalOkrSettings(): Promise<OkrSettingsGlobal | null> {
    const { data, error } = await supabase
      .from('okr_settings_global')
      .select('id, owner_user_id, daily_expected_points, weekly_days, tiers')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (error) throw error
    if (!data) return null

    return {
      id: data.id,
      owner_user_id: data.owner_user_id,
      daily_base_target: data.daily_expected_points,
      weekly_days: data.weekly_days,
      tiers: Array.isArray(data.tiers) ? data.tiers : [],
    }
  },

  /**
   * Guardar/actualizar configuración global de OKR (solo admin)
   * Patrón: SELECT singleton -> UPDATE por id, o INSERT si no existe
   */
  async saveGlobalOkrSettings(partial: {
    daily_expected_points?: number
    weekly_days?: number
    tiers?: OkrTier[]
  }): Promise<OkrSettingsGlobal> {
    // Validaciones
    if (partial.daily_expected_points !== undefined) {
      if (!Number.isInteger(partial.daily_expected_points) || partial.daily_expected_points < 0) {
        throw new Error('daily_expected_points must be a non-negative integer')
      }
    }
    if (partial.weekly_days !== undefined) {
      if (!Number.isInteger(partial.weekly_days) || partial.weekly_days < 1 || partial.weekly_days > 7) {
        throw new Error('weekly_days must be an integer between 1 and 7')
      }
    }
    if (partial.tiers !== undefined) {
      if (!Array.isArray(partial.tiers) || partial.tiers.length === 0) {
        throw new Error('tiers must be a non-empty array')
      }
      // Validar tiers
      for (const tier of partial.tiers) {
        if (!tier.key || !tier.label || !tier.message) {
          throw new Error('Each tier must have key, label, and message')
        }
        if (typeof tier.min !== 'number' || typeof tier.max !== 'number' || tier.min < 0 || tier.max < tier.min) {
          throw new Error(`Invalid tier range for ${tier.key}: min=${tier.min}, max=${tier.max}`)
        }
      }
    }

    // 1) Cargar singleton existente
    const existing = await this.getGlobalOkrSettings()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('Not authenticated')
    }

    // Preparar payload para update/insert
    const payload: {
      owner_user_id?: string
      daily_expected_points?: number
      weekly_days?: number
      tiers?: OkrTier[]
    } = {}

    if (partial.daily_expected_points !== undefined) {
      payload.daily_expected_points = partial.daily_expected_points
    }
    if (partial.weekly_days !== undefined) {
      payload.weekly_days = partial.weekly_days
    }
    if (partial.tiers !== undefined) {
      payload.tiers = partial.tiers
    }

    // 2) Si existe, UPDATE por id
    if (existing?.id) {
      const { data, error } = await supabase
        .from('okr_settings_global')
        .update(payload)
        .eq('id', existing.id)
        .select('id, owner_user_id, daily_expected_points, weekly_days, tiers')
        .single()

      if (error) {
        console.error('Error updating okr_settings_global:', { error, payload, existingId: existing.id })
        // Si es 403, el usuario no es admin
        if (error.code === '42501' || error.message?.includes('Only owner') || error.message?.includes('policy')) {
          throw new Error('Solo el administrador puede guardar la configuración global')
        }
        throw new Error(error.message || `Error al actualizar: ${error.details || JSON.stringify(error)}`)
      }

      return {
        id: data.id,
        owner_user_id: data.owner_user_id,
        daily_base_target: data.daily_expected_points,
        weekly_days: data.weekly_days,
        tiers: Array.isArray(data.tiers) ? data.tiers : [],
      }
    }

    // 3) Si no existe, INSERT (sin on_conflict)
    // Si no hay owner_user_id en payload y no existe fila, asignar current user
    if (!payload.owner_user_id) {
      payload.owner_user_id = user.id
    }

    // Usar defaults si faltan campos requeridos
    if (!payload.daily_expected_points) {
      payload.daily_expected_points = 25
    }
    if (!payload.weekly_days) {
      payload.weekly_days = 5
    }
    if (!payload.tiers) {
      payload.tiers = [
        {
          key: 'warmup',
          min: 0,
          max: 24,
          label: 'Arranque',
          message: 'Empieza con una victoria pequeña: 1 llamada + 1 seguimiento.',
          tone: 'neutral',
          color: 'slate',
        },
        {
          key: 'momentum',
          min: 25,
          max: 29,
          label: 'En camino',
          message: 'Ya estás cerca. Completa lo esperado del día.',
          tone: 'info',
          color: 'blue',
        },
        {
          key: 'expected',
          min: 30,
          max: 39,
          label: 'Actividad esperada',
          message: '✅ Día sólido. Mantén el ritmo.',
          tone: 'success',
          color: 'green',
        },
        {
          key: 'overdrive',
          min: 40,
          max: 1000,
          label: 'Alto rendimiento',
          message: '🔥 Día imparable. Esto multiplica tu semana.',
          tone: 'special',
          color: 'amber',
        },
      ]
    }

    const { data, error } = await supabase
      .from('okr_settings_global')
      .insert(payload)
      .select('id, owner_user_id, daily_expected_points, weekly_days, tiers')
      .single()

    if (error) {
      console.error('Error inserting okr_settings_global:', { error, payload })
      // Si es 403, el usuario no puede crear
      if (error.code === '42501' || error.message?.includes('policy')) {
        throw new Error('No tienes permisos para inicializar la configuración global')
      }
      throw new Error(error.message || `Error al crear: ${error.details || JSON.stringify(error)}`)
    }

    return {
      id: data.id,
      owner_user_id: data.owner_user_id,
      daily_base_target: data.daily_expected_points,
      weekly_days: data.weekly_days,
      tiers: Array.isArray(data.tiers) ? data.tiers : [],
    }
  },

  /**
   * Guardar/actualizar configuración global de OKR (solo admin) - versión completa
   * @deprecated Usar saveGlobalOkrSettings para updates parciales
   */
  async saveOkrSettingsGlobal(input: {
    daily_base_target: number
    weekly_days: number
    tiers: OkrTier[]
  }): Promise<void> {
    await this.saveGlobalOkrSettings({
      daily_expected_points: input.daily_base_target,
      weekly_days: input.weekly_days,
      tiers: input.tiers,
    })
  },

  /**
   * Obtener configuración de metas OKR (legacy, usar getOkrSettingsGlobal)
   * @deprecated Usar getOkrSettingsGlobal en su lugar
   */
  async getOkrGoalSettings(): Promise<{ daily_target: number } | null> {
    try {
      const settings = await this.getOkrSettingsGlobal()
      return { daily_target: settings.daily_base_target }
    } catch {
      return null
    }
  },

  /**
   * Guardar/actualizar configuración de metas OKR (legacy, usar saveOkrSettingsGlobal)
   * @deprecated Usar saveOkrSettingsGlobal en su lugar
   */
  async upsertOkrGoalSettings(dailyTarget: number): Promise<void> {
    const settings = await this.getOkrSettingsGlobal()
    await this.saveOkrSettingsGlobal({
      daily_base_target: dailyTarget,
      weekly_days: settings.weekly_days,
      tiers: settings.tiers,
    })
  },
}
