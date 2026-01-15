begin;

-- lead_stage_history: acelera max(moved_at) por lead + stage
create index if not exists lead_stage_history_lead_stage_moved_at_idx
  on public.lead_stage_history (lead_id, to_stage_id, moved_at desc);

-- activity_events: acelera OKR/racha y feed por usuario (recorded_at)
create index if not exists activity_events_actor_recorded_at_idx
  on public.activity_events (actor_user_id, recorded_at desc);

-- opcional: si consultas por happened_at
create index if not exists activity_events_actor_happened_at_idx
  on public.activity_events (actor_user_id, happened_at desc);

commit;
