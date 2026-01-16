begin;

create or replace function public.bootstrap_owner_if_needed(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null then
    raise exception 'bootstrap_owner_if_needed: p_user_id cannot be null';
  end if;

  lock table public.okr_settings_global in exclusive mode;

  if not exists (select 1 from public.okr_settings_global)
     and (select count(*) from public.profiles) = 1
  then
    insert into public.okr_settings_global (
      owner_user_id,
      daily_expected_points,
      weekly_days,
      tiers
    )
    values (
      p_user_id,
      25,
      5,
      '[]'::jsonb
    );
  end if;
end;
$$;

create or replace function public.trg_profiles_bootstrap_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.bootstrap_owner_if_needed(new.user_id);
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where t.tgname = 'trg_profiles_bootstrap_owner'
      and n.nspname = 'public'
      and c.relname = 'profiles'
  ) then
    create trigger trg_profiles_bootstrap_owner
    after insert on public.profiles
    for each row
    execute function public.trg_profiles_bootstrap_owner();
  end if;
end $$;

commit;
