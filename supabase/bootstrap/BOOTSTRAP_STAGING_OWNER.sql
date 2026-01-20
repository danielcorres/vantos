do $$
declare
  v_owner uuid := '00000000-0000-0000-0000-000000000000'::uuid;
begin
  if v_owner = '00000000-0000-0000-0000-000000000000'::uuid then
    raise exception 'Set v_owner to the desired owner user_id (uuid) before running.';
  end if;

  execute 'alter table public.profiles disable trigger user';

  insert into public.profiles (user_id, role, created_at, updated_at)
  values (v_owner, 'owner', now(), now())
  on conflict (user_id) do update
  set role = 'owner', updated_at = now();

  insert into public.okr_settings_global (...)
  select v_owner, ...
  where not exists (select 1 from public.okr_settings_global);

  execute 'alter table public.profiles enable trigger user';
end $$;
