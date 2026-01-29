-- ============================================================
-- Limpieza definitiva: leads en etapas legacy_* y stages legacy
-- Hard delete permitido (módulo pipeline aún no en producción).
-- Ejecuta en transacción; no crea tablas permanentes; no toca RLS.
-- ============================================================

do $$
declare
  v_legacy_stage_ids uuid[];
  v_legacy_lead_ids uuid[];
  v_cnt_stages int;
  v_cnt_leads int;
  v_child_schema text;
  v_child_table text;
  v_child_column text;
  v_deleted_leads int;
  v_deleted_stages int;
  v_refs bigint;
begin
  -- A) Calcular legacy_stage_ids
  select array_agg(id) into v_legacy_stage_ids
  from public.pipeline_stages
  where slug like 'legacy_%';

  if v_legacy_stage_ids is null then
    v_legacy_stage_ids := array[]::uuid[];
  end if;

  select count(*)::int into v_cnt_stages from unnest(v_legacy_stage_ids) x(id);

  -- B) Calcular legacy_lead_ids
  select array_agg(l.id) into v_legacy_lead_ids
  from public.leads l
  join public.pipeline_stages s on s.id = l.stage_id
  where s.slug like 'legacy_%';

  if v_legacy_lead_ids is null then
    v_legacy_lead_ids := array[]::uuid[];
  end if;

  select count(*)::int into v_cnt_leads from unnest(v_legacy_lead_ids) x(id);

  v_deleted_leads := 0;
  v_deleted_stages := 0;

  raise notice 'cleanup_legacy_pipeline: legacy stages = %, legacy leads = %', v_cnt_stages, v_cnt_leads;

  if array_length(v_legacy_lead_ids, 1) is not null and array_length(v_legacy_lead_ids, 1) > 0 then
    -- C) Borrar dependencias conocidas
    delete from public.calendar_events
    where lead_id = any(v_legacy_lead_ids);

    delete from public.lead_stage_history
    where lead_id = any(v_legacy_lead_ids);

    -- D) Borrado genérico: todas las FKs que referencian public.leads(id)
    for v_child_schema, v_child_table, v_child_column in
      select
        (select nspname from pg_namespace where oid = c.relnamespace),
        c.relname,
        (select attname from pg_attribute where attrelid = c.oid and attnum = con.conkey[1] and attnum > 0 and not attisdropped)
      from pg_constraint con
      join pg_class c on c.oid = con.conrelid
      join pg_class ref on ref.oid = con.confrelid
      join pg_namespace refns on refns.oid = ref.relnamespace
      where con.contype = 'f'
        and ref.relname = 'leads'
        and refns.nspname = 'public'
        and (select nspname from pg_namespace where oid = c.relnamespace) = 'public'
        and c.relname != 'leads'
        and c.relname not in ('calendar_events', 'lead_stage_history')
    loop
      execute format(
        'delete from public.%I where %I = any($1)',
        v_child_table,
        v_child_column
      ) using v_legacy_lead_ids;
    end loop;

    -- E) Borrar leads legacy
    delete from public.leads
    where id = any(v_legacy_lead_ids);

    get diagnostics v_deleted_leads = row_count;
    raise notice 'cleanup_legacy_pipeline: deleted leads = %', v_deleted_leads;
  end if;

  -- Limpiar referencias a legacy stages en lead_stage_history (from/to)
  delete from public.lead_stage_history
  where from_stage_id = any(v_legacy_stage_ids)
     or to_stage_id = any(v_legacy_stage_ids);

  -- F) Borrar pipeline_stages legacy
  begin
    delete from public.pipeline_stages
    where slug like 'legacy_%';
    get diagnostics v_deleted_stages = row_count;
    raise notice 'cleanup_legacy_pipeline: deleted legacy stages = %', v_deleted_stages;
  exception
    when foreign_key_violation then
      select count(*) into v_refs
      from public.lead_stage_history
      where from_stage_id = any(v_legacy_stage_ids)
         or to_stage_id = any(v_legacy_stage_ids);
      raise notice 'cleanup_legacy_pipeline: no se pudieron borrar stages legacy (FK). Referencias en lead_stage_history = %. No falla migración.', v_refs;
      v_deleted_stages := 0;
  end;
end;
$$;

-- ============================================================
-- VALIDACIÓN (ejecutar manualmente tras la migración)
-- ============================================================
-- Verificar 0 leads en legacy:
--   select count(*) from public.leads l
--   join public.pipeline_stages s on s.id = l.stage_id
--   where s.slug like 'legacy_%';
--
-- Verificar 0 stages legacy (si se pudieron borrar):
--   select count(*) from public.pipeline_stages where slug like 'legacy_%';
