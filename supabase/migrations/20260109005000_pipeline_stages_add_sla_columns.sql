-- ============================================================
-- Pipeline Stages: Agregar columnas SLA
-- Estas columnas son requeridas por get_pipeline_board() (20260109005610)
-- ============================================================

begin;

-- Agregar columna sla_enabled
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pipeline_stages'
      and column_name = 'sla_enabled'
  ) then
    alter table public.pipeline_stages
      add column sla_enabled boolean not null default false;
  end if;
end $$;

-- Agregar columna sla_days
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pipeline_stages'
      and column_name = 'sla_days'
  ) then
    alter table public.pipeline_stages
      add column sla_days int null;
  end if;
end $$;

-- Agregar columna sla_warn_days
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pipeline_stages'
      and column_name = 'sla_warn_days'
  ) then
    alter table public.pipeline_stages
      add column sla_warn_days int null;
  end if;
end $$;

commit;
