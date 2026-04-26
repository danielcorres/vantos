-- ============================================================
-- VANT · Módulo Campañas — RPCs SECURITY DEFINER
--
-- Funciones:
--   1. get_campaign_dashboard(p_periodo)
--   2. get_campaign_ranking(p_periodo, p_campaign_id, p_track_id)
--   3. get_my_campaign_rank(p_periodo, p_campaign_id, p_track_id)
--   4. update_reward_award_status(p_award_id, p_new_status, p_notes)
--
-- Principios de seguridad aplicados:
--   · auth.uid() nulo → retorno vacío inmediato (no continúa).
--   · Perfil no encontrado → retorno vacío (sin acceso).
--   · Rol nulo o no reconocido → retorno vacío (sin acceso).
--   · Ningún ELSE captura roles desconocidos como acceso total.
--   · Patrón explícito: advisor → propio, manager → equipo,
--     owner/director/seguimiento → global, else → false/vacío.
--   · campaign_reward_awards.update_ops policy fue eliminada de la
--     migración de tablas. La única ruta para cambiar status es esta RPC.
--     SECURITY DEFINER bypasa RLS para el UPDATE interno; el cliente
--     nunca debe hacer UPDATE directo a esa tabla.
--
-- Dependencias de profiles confirmadas:
--   profiles.user_id, profiles.role, profiles.manager_user_id,
--   profiles.advisor_code, profiles.connection_date,
--   profiles.full_name, profiles.first_name, profiles.last_name
-- ============================================================

begin;

-- ============================================================
-- 1) get_campaign_dashboard
--    Devuelve los datos de campañas para el usuario autenticado.
--    Lógica por rol:
--      advisor            → solo sus propios snapshots + sus awards
--      manager            → snapshots de su equipo + awards de su equipo
--      owner/director/
--      seguimiento        → todos los snapshots + todos los awards
--
--    Ranking en dashboard: siempre global (posición real sobre todos
--    los participantes de la campaña), independientemente del rol.
--    Para ranking dentro del equipo, usar get_campaign_ranking.
--
--    Retorna jsonb array. Cada elemento incluye:
--      - Datos del snapshot
--      - current_level y next_level con reward_options (premios alternativos)
--      - award_status del asesor correspondiente
-- ============================================================
create or replace function public.get_campaign_dashboard(p_periodo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid;
  v_role text;
  v_result jsonb;
begin
  -- Guard 1: usuario autenticado
  v_uid := auth.uid();
  if v_uid is null then
    return '[]'::jsonb;
  end if;

  -- Guard 2: perfil y rol válidos
  select role into v_role
  from public.profiles
  where user_id = v_uid;

  if v_role is null
     or v_role not in ('advisor','manager','owner','director','seguimiento')
  then
    return '[]'::jsonb;
  end if;

  with

  -- ── Perfiles visibles según rol ──────────────────────────────────
  -- Patrón explícito sin "else true":
  --   advisor     → solo el propio perfil
  --   manager     → su equipo + él mismo (para ver sus propios datos si tiene rol mixto)
  --   ops         → todos los perfiles
  --   else false  → roles no reconocidos ven cero perfiles (defensa en profundidad)
  visible_profiles as (
    select
      p.user_id,
      coalesce(
        nullif(trim(p.full_name), ''),
        nullif(trim(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')), ''),
        'Sin nombre'
      ) as display_name,
      p.advisor_code,
      p.connection_date,
      p.manager_user_id
    from public.profiles p
    where
      case v_role
        when 'advisor'    then p.user_id = v_uid
        when 'manager'    then p.manager_user_id = v_uid
                            or p.user_id = v_uid
        when 'owner'      then true
        when 'director'   then true
        when 'seguimiento' then true
        else false
      end
  ),

  -- ── Snapshots del periodo para perfiles visibles ─────────────────
  snaps as (
    select
      s.id,
      s.user_id,
      s.campaign_id,
      s.track_id,
      s.periodo,
      s.metric_type,
      s.value,
      s.advisor_campaign_month,
      s.source_zone,
      s.tie_breaker_value,
      s.source_clave_asesor,
      s.import_id,
      vp.display_name,
      vp.advisor_code,
      vp.connection_date
    from public.campaign_snapshots s
    join visible_profiles vp on vp.user_id = s.user_id
    where s.periodo = p_periodo
  ),

  -- ── Catálogo de niveles activos ──────────────────────────────────
  campaign_levels_ordered as (
    select
      cl.id,
      cl.campaign_id,
      cl.track_id,
      cl.level_order,
      cl.target_value,
      cl.name as level_name,
      cl.win_condition_type,
      cl.required_rank,
      cl.ranking_scope,
      cl.tie_breaker_metric,
      cl.reward_title,
      cl.reward_description,
      cl.reward_image_url,
      cl.reward_terms,
      cl.reward_is_active,
      cl.target_month,
      cl.requires_monthly_minimum,
      cl.monthly_minimum_description,
      cl.requires_active_group,
      cl.requires_inforce_ratio,
      cl.minimum_inforce_ratio,
      cl.requires_limra_index,
      cl.can_recover_previous_rewards,
      cl.recovery_scope,
      cl.validation_notes,
      cl.evaluation_period_type,
      cl.period_label
    from public.campaign_levels cl
    where cl.is_active = true
  ),

  -- ── Nivel alcanzado más alto y siguiente por snapshot ────────────
  snap_current_level as (
    select
      s.user_id,
      s.campaign_id,
      s.track_id,
      s.periodo,
      s.value,
      (
        select cl.id
        from campaign_levels_ordered cl
        where cl.campaign_id = s.campaign_id
          and coalesce(cl.track_id,'00000000-0000-0000-0000-000000000000'::uuid)
            = coalesce(s.track_id,'00000000-0000-0000-0000-000000000000'::uuid)
          and s.value >= cl.target_value
        order by cl.level_order desc
        limit 1
      ) as current_level_id,
      (
        select cl.id
        from campaign_levels_ordered cl
        where cl.campaign_id = s.campaign_id
          and coalesce(cl.track_id,'00000000-0000-0000-0000-000000000000'::uuid)
            = coalesce(s.track_id,'00000000-0000-0000-0000-000000000000'::uuid)
          and s.value < cl.target_value
        order by cl.level_order asc
        limit 1
      ) as next_level_id
    from snaps s
  ),

  -- ── Ranking global (todos los participantes del periodo) ─────────
  -- Nota: el ranking en dashboard es siempre global, no por equipo.
  -- Para ranking de equipo del manager usar get_campaign_ranking.
  all_snaps_for_ranking as (
    select
      s.user_id,
      s.campaign_id,
      s.track_id,
      s.periodo,
      s.value,
      s.tie_breaker_value,
      (
        select coalesce(max(cl.level_order), 0)
        from public.campaign_levels cl
        where cl.campaign_id = s.campaign_id
          and cl.is_active = true
          and coalesce(cl.track_id,'00000000-0000-0000-0000-000000000000'::uuid)
            = coalesce(s.track_id,'00000000-0000-0000-0000-000000000000'::uuid)
          and s.value >= cl.target_value
      ) as max_level_order,
      (
        select coalesce(min(cl.target_value), 0)
        from public.campaign_levels cl
        where cl.campaign_id = s.campaign_id
          and cl.is_active = true
          and coalesce(cl.track_id,'00000000-0000-0000-0000-000000000000'::uuid)
            = coalesce(s.track_id,'00000000-0000-0000-0000-000000000000'::uuid)
          and s.value < cl.target_value
      ) as next_target
    from public.campaign_snapshots s
    where s.periodo = p_periodo
  ),

  ranked as (
    select
      user_id,
      campaign_id,
      track_id,
      periodo,
      row_number() over (
        partition by campaign_id,
          coalesce(track_id,'00000000-0000-0000-0000-000000000000'::uuid),
          periodo
        order by
          max_level_order desc,
          case when next_target > 0 then value::float / next_target else 1.0 end desc,
          coalesce(tie_breaker_value, 0) desc,
          value desc
      ) as rank_pos,
      count(*) over (
        partition by campaign_id,
          coalesce(track_id,'00000000-0000-0000-0000-000000000000'::uuid),
          periodo
      ) as rank_total
    from all_snaps_for_ranking
  ),

  -- ── Awards del periodo para los perfiles visibles ────────────────
  -- Usa visible_profiles (no v_uid) para que manager/ops vean
  -- los awards de todo su alcance, no solo los propios.
  awards as (
    select
      ra.user_id,
      ra.campaign_id,
      ra.track_id,
      ra.level_id,
      ra.periodo,
      ra.status as award_status,
      ra.selected_reward_id
    from public.campaign_reward_awards ra
    join visible_profiles vp on vp.user_id = ra.user_id
    where ra.periodo = p_periodo
  )

  select jsonb_agg(
    jsonb_build_object(
      'snapshot_id',            s.id,
      'user_id',                s.user_id,
      'display_name',           s.display_name,
      'advisor_code',           s.advisor_code,
      'campaign_id',            s.campaign_id,
      'track_id',               s.track_id,
      'periodo',                s.periodo,
      'metric_type',            s.metric_type,
      'value',                  s.value,
      'advisor_campaign_month', s.advisor_campaign_month,
      'source_zone',            s.source_zone,
      'tie_breaker_value',      s.tie_breaker_value,
      'ranking_position',       r.rank_pos,
      'ranking_total',          r.rank_total,
      -- current_level incluye reward_options (premios alternativos)
      'current_level', case when scl.current_level_id is not null then (
        select jsonb_build_object(
          'id',                        cl.id,
          'name',                      cl.level_name,
          'level_order',               cl.level_order,
          'target_value',              cl.target_value,
          'target_month',              cl.target_month,
          'reward_title',              cl.reward_title,
          'reward_description',        cl.reward_description,
          'reward_image_url',          cl.reward_image_url,
          'reward_is_active',          cl.reward_is_active,
          'requires_monthly_minimum',  cl.requires_monthly_minimum,
          'monthly_minimum_description', cl.monthly_minimum_description,
          'requires_active_group',     cl.requires_active_group,
          'requires_inforce_ratio',    cl.requires_inforce_ratio,
          'minimum_inforce_ratio',     cl.minimum_inforce_ratio,
          'requires_limra_index',      cl.requires_limra_index,
          'validation_notes',          cl.validation_notes,
          'evaluation_period_type',    cl.evaluation_period_type,
          'period_label',              cl.period_label,
          -- Premios alternativos (MacBook Air, maleta TUMI, etc.)
          'reward_options', (
            select coalesce(jsonb_agg(
              jsonb_build_object(
                'id',              clr.id,
                'title',           clr.title,
                'description',     clr.description,
                'reward_type',     clr.reward_type,
                'choice_group',    clr.choice_group,
                'is_choice_option', clr.is_choice_option,
                'sort_order',      clr.sort_order
              ) order by clr.sort_order
            ), '[]'::jsonb)
            from public.campaign_level_rewards clr
            where clr.level_id = cl.id and clr.is_active = true
          )
        )
        from campaign_levels_ordered cl
        where cl.id = scl.current_level_id
      ) else null end,
      -- next_level también incluye reward_options
      'next_level', case when scl.next_level_id is not null then (
        select jsonb_build_object(
          'id',                        cl.id,
          'name',                      cl.level_name,
          'level_order',               cl.level_order,
          'target_value',              cl.target_value,
          'target_month',              cl.target_month,
          'reward_title',              cl.reward_title,
          'reward_description',        cl.reward_description,
          'reward_image_url',          cl.reward_image_url,
          'reward_is_active',          cl.reward_is_active,
          'requires_monthly_minimum',  cl.requires_monthly_minimum,
          'monthly_minimum_description', cl.monthly_minimum_description,
          'requires_active_group',     cl.requires_active_group,
          'requires_inforce_ratio',    cl.requires_inforce_ratio,
          'minimum_inforce_ratio',     cl.minimum_inforce_ratio,
          'requires_limra_index',      cl.requires_limra_index,
          'validation_notes',          cl.validation_notes,
          'evaluation_period_type',    cl.evaluation_period_type,
          'period_label',              cl.period_label,
          'reward_options', (
            select coalesce(jsonb_agg(
              jsonb_build_object(
                'id',              clr.id,
                'title',           clr.title,
                'description',     clr.description,
                'reward_type',     clr.reward_type,
                'choice_group',    clr.choice_group,
                'is_choice_option', clr.is_choice_option,
                'sort_order',      clr.sort_order
              ) order by clr.sort_order
            ), '[]'::jsonb)
            from public.campaign_level_rewards clr
            where clr.level_id = cl.id and clr.is_active = true
          )
        )
        from campaign_levels_ordered cl
        where cl.id = scl.next_level_id
      ) else null end,
      'is_max_reached',       scl.next_level_id is null and scl.current_level_id is not null,
      'award_status',         aw.award_status,
      'selected_reward_id',   aw.selected_reward_id
    )
    order by s.campaign_id, s.track_id, s.user_id
  )
  into v_result
  from snaps s
  left join snap_current_level scl
    on scl.user_id    = s.user_id
   and scl.campaign_id = s.campaign_id
   and coalesce(scl.track_id,'00000000-0000-0000-0000-000000000000'::uuid)
     = coalesce(s.track_id,'00000000-0000-0000-0000-000000000000'::uuid)
   and scl.periodo = s.periodo
  left join ranked r
    on r.user_id    = s.user_id
   and r.campaign_id = s.campaign_id
   and coalesce(r.track_id,'00000000-0000-0000-0000-000000000000'::uuid)
     = coalesce(s.track_id,'00000000-0000-0000-0000-000000000000'::uuid)
   and r.periodo = s.periodo
  left join awards aw
    on aw.user_id    = s.user_id
   and aw.campaign_id = s.campaign_id
   and coalesce(aw.track_id,'00000000-0000-0000-0000-000000000000'::uuid)
     = coalesce(s.track_id,'00000000-0000-0000-0000-000000000000'::uuid)
   and aw.periodo = s.periodo;

  return coalesce(v_result, '[]'::jsonb);
end;
$$;

grant execute on function public.get_campaign_dashboard(text) to authenticated;

-- ============================================================
-- 2) get_campaign_ranking
--    Devuelve el ranking de una campaña/track.
--
--    Comportamiento por rol:
--      advisor     → ranking calculado sobre TODOS los participantes
--                    (posición real global); solo se devuelve la fila
--                    del asesor con display_name oculto para otros.
--      manager     → ranking calculado SOLO sobre su equipo
--                    (posición 1..N donde N = tamaño del equipo).
--                    Se devuelven todas las filas del equipo.
--      owner/director/
--      seguimiento → ranking global; se devuelven todas las filas.
--
--    El alcance del ranking (global vs equipo) se define en el CTE
--    `ranking_pool`, que es la base del window function. Para manager,
--    esto evita posiciones confusas (p.ej. "rank 47 de 200" cuando
--    el equipo solo tiene 15 personas).
-- ============================================================
create or replace function public.get_campaign_ranking(
  p_periodo     text,
  p_campaign_id uuid,
  p_track_id    uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid;
  v_role   text;
  v_result jsonb;
begin
  -- Guard 1: usuario autenticado
  v_uid := auth.uid();
  if v_uid is null then
    return '[]'::jsonb;
  end if;

  -- Guard 2: perfil y rol válidos
  select role into v_role
  from public.profiles
  where user_id = v_uid;

  if v_role is null
     or v_role not in ('advisor','manager','owner','director','seguimiento')
  then
    return '[]'::jsonb;
  end if;

  with

  -- ── Pool de snapshots para cálculo de ranking ────────────────────
  -- advisor + ops → pool global (ranking real entre todos)
  -- manager       → pool restringido a su equipo
  ranking_pool as (
    select
      s.user_id,
      s.value,
      s.tie_breaker_value,
      (
        select coalesce(max(cl.level_order), 0)
        from public.campaign_levels cl
        where cl.campaign_id = p_campaign_id
          and cl.is_active = true
          and coalesce(cl.track_id,'00000000-0000-0000-0000-000000000000'::uuid)
            = coalesce(p_track_id,'00000000-0000-0000-0000-000000000000'::uuid)
          and s.value >= cl.target_value
      ) as max_level_order,
      (
        select coalesce(min(cl.target_value), 0)
        from public.campaign_levels cl
        where cl.campaign_id = p_campaign_id
          and cl.is_active = true
          and coalesce(cl.track_id,'00000000-0000-0000-0000-000000000000'::uuid)
            = coalesce(p_track_id,'00000000-0000-0000-0000-000000000000'::uuid)
          and s.value < cl.target_value
      ) as next_target
    from public.campaign_snapshots s
    where s.campaign_id = p_campaign_id
      and s.periodo = p_periodo
      and coalesce(s.track_id,'00000000-0000-0000-0000-000000000000'::uuid)
        = coalesce(p_track_id,'00000000-0000-0000-0000-000000000000'::uuid)
      -- Filtro del pool según rol:
      -- manager → solo su equipo (incluyéndose a sí mismo si tiene snapshots)
      -- advisor + ops → sin restricción (pool global)
      and case v_role
        when 'manager' then exists (
          select 1 from public.profiles mp
          where mp.user_id = s.user_id
            and (mp.manager_user_id = v_uid or mp.user_id = v_uid)
        )
        when 'advisor'    then true
        when 'owner'      then true
        when 'director'   then true
        when 'seguimiento' then true
        else false
      end
  ),

  -- ── Ranking calculado sobre el pool definido arriba ───────────────
  ranked as (
    select
      rp.user_id,
      rp.value,
      rp.tie_breaker_value,
      rp.max_level_order,
      row_number() over (
        order by
          rp.max_level_order desc,
          case when rp.next_target > 0 then rp.value::float / rp.next_target else 1.0 end desc,
          coalesce(rp.tie_breaker_value, 0) desc,
          rp.value desc
      ) as rank_pos,
      count(*) over () as rank_total
    from ranking_pool rp
  )

  select jsonb_agg(
    jsonb_build_object(
      'user_id',      r.user_id,
      'display_name', case
                        -- Advisor solo ve su nombre; otros aparecen como "Participante #N"
                        when v_role = 'advisor' and r.user_id <> v_uid
                        then 'Participante #' || r.rank_pos::text
                        else coalesce(
                          nullif(trim(p.full_name), ''),
                          nullif(trim(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')), ''),
                          'Sin nombre'
                        )
                      end,
      -- Valor oculto para filas de otros asesores (cuando es advisor)
      'value',             case when v_role = 'advisor' and r.user_id <> v_uid then null else r.value end,
      'tie_breaker_value', case when v_role = 'advisor' and r.user_id <> v_uid then null else r.tie_breaker_value end,
      'rank_pos',          r.rank_pos,
      'rank_total',        r.rank_total,
      'is_current_user',   r.user_id = v_uid
    )
    order by r.rank_pos
  )
  into v_result
  from ranked r
  left join public.profiles p on p.user_id = r.user_id
  where
    -- Filtro de qué filas se devuelven (display):
    -- advisor  → solo su propia fila (su ranking fue calculado en el pool global)
    -- manager  → todas las filas (el pool ya era solo su equipo)
    -- ops      → todas las filas (pool global)
    case v_role
      when 'advisor'    then r.user_id = v_uid
      when 'manager'    then true
      when 'owner'      then true
      when 'director'   then true
      when 'seguimiento' then true
      else false
    end;

  return coalesce(v_result, '[]'::jsonb);
end;
$$;

grant execute on function public.get_campaign_ranking(text, uuid, uuid) to authenticated;

-- ============================================================
-- 3) get_my_campaign_rank
--    Devuelve solo la posición del usuario autenticado.
--    El ranking se calcula sobre TODOS los participantes (pool global)
--    para reflejar la posición real, independientemente del rol.
--    No expone datos de otros usuarios en ningún caso.
-- ============================================================
create or replace function public.get_my_campaign_rank(
  p_periodo     text,
  p_campaign_id uuid,
  p_track_id    uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid;
  v_result jsonb;
begin
  -- Guard 1: usuario autenticado
  v_uid := auth.uid();
  if v_uid is null then
    return 'null'::jsonb;
  end if;

  -- Guard 2: perfil existente en Vant
  if not exists (
    select 1 from public.profiles where user_id = v_uid
  ) then
    return 'null'::jsonb;
  end if;

  -- Pool global para cálculo de ranking real
  with
  all_snaps as (
    select
      s.user_id,
      s.value,
      s.tie_breaker_value,
      (
        select coalesce(max(cl.level_order), 0)
        from public.campaign_levels cl
        where cl.campaign_id = p_campaign_id
          and cl.is_active = true
          and coalesce(cl.track_id,'00000000-0000-0000-0000-000000000000'::uuid)
            = coalesce(p_track_id,'00000000-0000-0000-0000-000000000000'::uuid)
          and s.value >= cl.target_value
      ) as max_level_order,
      (
        select coalesce(min(cl.target_value), 0)
        from public.campaign_levels cl
        where cl.campaign_id = p_campaign_id
          and cl.is_active = true
          and coalesce(cl.track_id,'00000000-0000-0000-0000-000000000000'::uuid)
            = coalesce(p_track_id,'00000000-0000-0000-0000-000000000000'::uuid)
          and s.value < cl.target_value
      ) as next_target
    from public.campaign_snapshots s
    where s.campaign_id = p_campaign_id
      and s.periodo = p_periodo
      and coalesce(s.track_id,'00000000-0000-0000-0000-000000000000'::uuid)
        = coalesce(p_track_id,'00000000-0000-0000-0000-000000000000'::uuid)
  ),
  ranked as (
    select
      s.user_id,
      row_number() over (
        order by
          s.max_level_order desc,
          case when s.next_target > 0 then s.value::float / s.next_target else 1.0 end desc,
          coalesce(s.tie_breaker_value, 0) desc,
          s.value desc
      ) as rank_pos,
      count(*) over () as rank_total
    from all_snaps s
  )
  -- Solo retorna la fila del usuario autenticado
  select jsonb_build_object(
    'rank_pos',   r.rank_pos,
    'rank_total', r.rank_total
  )
  into v_result
  from ranked r
  where r.user_id = v_uid;

  return coalesce(v_result, 'null'::jsonb);
end;
$$;

grant execute on function public.get_my_campaign_rank(text, uuid, uuid) to authenticated;

-- ============================================================
-- 4) update_reward_award_status
--    Cambia el status de un award con validación de transiciones.
--    Solo roles: owner, director, seguimiento.
--
--    Seguridad:
--    · auth.uid() nulo → No autenticado.
--    · v_role nulo → No autorizado (NULL NOT IN (...) = NULL,
--      que en un IF se trata como falso, dejando pasar el código
--      en versiones sin esta guarda explícita — CORREGIDO aquí).
--    · Roles no permitidos → No autorizado.
--    · Máquina de estados: solo transiciones válidas son permitidas.
--
--    La RPC es SECURITY DEFINER → bypasa RLS para el UPDATE interno.
--    La tabla campaign_reward_awards NO tiene policy de UPDATE cliente.
-- ============================================================
create or replace function public.update_reward_award_status(
  p_award_id   uuid,
  p_new_status text,
  p_notes      text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid;
  v_role       text;
  v_cur_status text;
  v_valid_next text[];
begin
  -- Guard 1: autenticado
  v_uid := auth.uid();
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'No autenticado');
  end if;

  -- Guard 2: rol válido y con permiso
  -- IMPORTANTE: `null not in (...)` evalúa a NULL (no a true/false).
  -- Verificamos explícitamente: v_role is null OR no está en lista.
  select role into v_role
  from public.profiles
  where user_id = v_uid;

  if v_role is null or v_role not in ('owner','director','seguimiento') then
    return jsonb_build_object('ok', false, 'error', 'No autorizado');
  end if;

  -- Obtener status actual del award
  select status into v_cur_status
  from public.campaign_reward_awards
  where id = p_award_id;

  if v_cur_status is null then
    return jsonb_build_object('ok', false, 'error', 'Award no encontrado');
  end if;

  -- ── Máquina de estados: transiciones válidas ─────────────────────
  -- Estado terminal: cancelled (sin salida)
  v_valid_next := case v_cur_status
    when 'projected'          then array['eligible','lost','cancelled']
    when 'eligible'           then array['pending_validation','earned','lost','cancelled']
    when 'pending_validation' then array['earned','lost','cancelled']
    when 'earned'             then array['confirmed','cancelled']
    when 'confirmed'          then array['delivered','cancelled']
    when 'delivered'          then array['cancelled']
    when 'lost'               then array['recovered','cancelled']
    when 'recovered'          then array['confirmed','cancelled']
    when 'cancelled'          then array[]::text[]
    else                           array[]::text[]
  end;

  if not (p_new_status = any(v_valid_next)) then
    return jsonb_build_object(
      'ok', false,
      'error', 'Transición inválida: ' || v_cur_status || ' → ' || p_new_status
    );
  end if;

  update public.campaign_reward_awards
  set
    status            = p_new_status,
    status_changed_at = now(),
    status_changed_by = v_uid,
    -- Concatena notas: si viene nota nueva, se agrega; si no, conserva la anterior
    notes             = coalesce(p_notes, notes),
    confirmed_at      = case when p_new_status = 'confirmed' then now() else confirmed_at end,
    confirmed_by      = case when p_new_status = 'confirmed' then v_uid else confirmed_by end,
    updated_at        = now()
  where id = p_award_id;

  return jsonb_build_object('ok', true, 'new_status', p_new_status);
end;
$$;

grant execute on function public.update_reward_award_status(uuid, text, text) to authenticated;

commit;
