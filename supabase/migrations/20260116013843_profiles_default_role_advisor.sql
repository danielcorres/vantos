begin;

create or replace function public.profiles_default_role_advisor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is null then
    new.role := 'advisor';
  end if;

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
    where t.tgname = 'trg_profiles_default_role_advisor'
      and n.nspname='public'
      and c.relname='profiles'
  ) then
    create trigger trg_profiles_default_role_advisor
    before insert on public.profiles
    for each row
    execute function public.profiles_default_role_advisor();
  end if;
end $$;

commit;
