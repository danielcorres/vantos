begin;

-- Read path for OKR Diario: actor + source + void flag + recorded_at window.
-- Complements existing (actor_user_id, lead_id, recorded_at) for queries without lead_id.
create index if not exists idx_activity_events_actor_source_void_recorded
  on public.activity_events (actor_user_id, source, is_void, recorded_at desc);

-- Future: consider a single RPC (e.g. get_okr_daily_page_data) bundling entries + progress + streak
-- to cut round-trips from the client; validate with EXPLAIN ANALYZE on staging.

commit;
