begin;

-- lead_stage_history: acelera max(moved_at) por lead + stage
create index if not exists lead_stage_history_lead_stage_moved_at_idx
  on public.lead_stage_history (lead_id, to_stage_id, moved_at desc);

-- activity_events: acelera max(recorded_at) por user + lead
-- OJO: aquí asumo actor_user_id + lead_id + recorded_at (por tu sistema OKR/racha)
create index if not exists activity_events_actor_lead_recorded_at_idx
  on public.activity_events (actor_user_id, lead_id, recorded_at desc);

commit;
