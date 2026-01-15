-- Ensure upsert can use ON CONFLICT (owner_user_id, role, metric_key)
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'okr_wmt_unique_owner_role_metric'
  ) then
    alter table public.okr_weekly_minimum_targets
      add constraint okr_wmt_unique_owner_role_metric
      unique (owner_user_id, role, metric_key);
  end if;
end $$;
