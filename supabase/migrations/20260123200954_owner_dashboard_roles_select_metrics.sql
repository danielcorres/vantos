begin;

-- 1) Helper roles para Owner Dashboard (si ya existe, se reemplaza sin problema)
create or replace function public.is_owner_dashboard_role()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role in ('owner','director','seguimiento')
  );
$$;

-- 2) Allow SELECT en activity_events
do $$
begin
  if to_regclass('public.activity_events') is not null then
    create policy "owner_dashboard_roles_select_activity_events"
      on public.activity_events
      for select
      to authenticated
      using (public.is_owner_dashboard_role());
  end if;
exception when duplicate_object then null;
end $$;

-- 3) Allow SELECT en tablas típicas OKR
do $$
begin
  if to_regclass('public.metric_definitions') is not null then
    create policy "owner_dashboard_roles_select_metric_definitions"
      on public.metric_definitions
      for select
      to authenticated
      using (public.is_owner_dashboard_role());
  end if;
exception when duplicate_object then null;
end $$;

do $$
begin
  if to_regclass('public.okr_metric_scores_global') is not null then
    create policy "owner_dashboard_roles_select_okr_metric_scores_global"
      on public.okr_metric_scores_global
      for select
      to authenticated
      using (public.is_owner_dashboard_role());
  end if;
exception when duplicate_object then null;
end $$;

do $$
begin
  if to_regclass('public.okr_settings_global') is not null then
    create policy "owner_dashboard_roles_select_okr_settings_global"
      on public.okr_settings_global
      for select
      to authenticated
      using (public.is_owner_dashboard_role());
  end if;
exception when duplicate_object then null;
end $$;

commit;
