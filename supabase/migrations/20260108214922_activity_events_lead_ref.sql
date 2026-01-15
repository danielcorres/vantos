begin;

-- 1) activity_events: agregar lead_id
alter table public.activity_events
  add column if not exists lead_id uuid;

-- (opcional pero recomendado) FK suave sin cascade
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'activity_events_lead_id_fkey'
  ) then
    alter table public.activity_events
      add constraint activity_events_lead_id_fkey
      foreign key (lead_id) references public.leads(id)
      on delete set null;
  end if;
end $$;

-- 2) Índice compuesto para "última actividad por lead"
create index if not exists activity_events_actor_lead_recorded_at_idx
  on public.activity_events (actor_user_id, lead_id, recorded_at desc);

-- 3) RPC get_today_focus movido a migración posterior (requiere v_lead_sla_alerts)

commit;
