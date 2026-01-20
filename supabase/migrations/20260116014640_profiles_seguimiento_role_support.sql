begin;

-- Helper: is_seguimiento()
create or replace function public.is_seguimiento()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role = 'seguimiento'
  );
$$;

-- Policy: seguimiento can SELECT all profiles (profiles is non-financial)
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname='public'
      and tablename='profiles'
      and policyname='profiles_select_seguimiento_all'
  ) then
    execute $p$
      create policy "profiles_select_seguimiento_all"
      on public.profiles
      as permissive
      for select
      to authenticated
      using (public.is_seguimiento());
    $p$;
  end if;
end $$;

commit;
