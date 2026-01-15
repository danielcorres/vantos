drop index if exists public.lead_stage_history_idem_unique;

create unique index if not exists lead_stage_history_idem_unique
  on public.lead_stage_history(lead_id, idempotency_key);
