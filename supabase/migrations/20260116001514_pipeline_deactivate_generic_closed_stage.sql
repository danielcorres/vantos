begin;

-- Idempotent: only updates if row exists
update public.pipeline_stages
set is_active = false
where name = 'Cerrado'
  and is_active is distinct from false;

commit;
