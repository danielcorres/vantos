-- =============================================================================
-- VANT · Estado de cuenta (activo / suspendido) + endurecimiento de updates
-- - profiles.account_status: bloqueo de app vía AuthProvider + signOut
-- - Solo owner/director (can_assign_roles) cambian account_status
-- - Trigger: no auto-suspensión, no suspender owner de okr_settings_global
-- - current_profile_access_ok(): helper RLS para una fase 2 (no se aplica aquí)
-- =============================================================================

begin;

-- 1) Columna + backfill
alter table public.profiles
  add column if not exists account_status text not null default 'active'
    check (account_status in ('active', 'suspended'));

create index if not exists profiles_account_status_idx
  on public.profiles (account_status)
  where account_status <> 'active';

-- 2) Nuevos usuarios: explícitamente activos
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, role, display_name, first_name, last_name, account_status)
  values (
    new.id,
    'advisor',
    coalesce(new.raw_user_meta_data->>'display_name', new.email),
    null,
    null,
    'active'
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- 3) Blindaje updates: account_status solo assigners; resto igual que antes
create or replace function public.profiles_block_sensitive_updates()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if public.can_assign_roles() then
    if new.account_status is distinct from old.account_status then
      if new.account_status = 'suspended' and old.user_id = auth.uid() then
        raise exception 'No puedes suspender tu propia cuenta';
      end if;
      if new.account_status = 'suspended' and old.user_id = (
        select g.owner_user_id from public.okr_settings_global g order by g.created_at asc limit 1
      ) then
        raise exception 'No se puede suspender al owner del sistema';
      end if;
    end if;

    if new.manager_user_id is distinct from old.manager_user_id then
      new.manager_assigned_by :=
        case when new.manager_user_id is not null then auth.uid() else null end;
      new.manager_assigned_at :=
        case when new.manager_user_id is not null then now() else null end;
    end if;

    if new.recruiter_user_id is distinct from old.recruiter_user_id then
      new.recruiter_assigned_by :=
        case when new.recruiter_user_id is not null then auth.uid() else null end;
      new.recruiter_assigned_at :=
        case when new.recruiter_user_id is not null then now() else null end;
    end if;

    return new;
  end if;

  if new.account_status is distinct from old.account_status then
    raise exception 'Not authorized to change account_status';
  end if;

  if public.can_claim_advisor('manager')
     and old.role = 'advisor'
     and new.role = 'advisor'
     and new.manager_user_id is distinct from old.manager_user_id
     and old.recruiter_user_id is not distinct from new.recruiter_user_id
  then
    if new.manager_user_id is not null and new.manager_user_id <> auth.uid() then
      raise exception 'Not authorized to assign manager slot to another user';
    end if;

    if new.manager_user_id is not null then
      new.manager_assigned_by := auth.uid();
      new.manager_assigned_at := now();
    else
      new.manager_assigned_by := null;
      new.manager_assigned_at := null;
    end if;

    return new;
  end if;

  if public.can_claim_advisor('recruiter')
     and old.role = 'advisor'
     and new.role = 'advisor'
     and new.recruiter_user_id is distinct from old.recruiter_user_id
     and old.manager_user_id is not distinct from new.manager_user_id
  then
    if new.recruiter_user_id is not null and new.recruiter_user_id <> auth.uid() then
      raise exception 'Not authorized to assign recruiter slot to another user';
    end if;

    if new.recruiter_user_id is not null then
      new.recruiter_assigned_by := auth.uid();
      new.recruiter_assigned_at := now();
    else
      new.recruiter_assigned_by := null;
      new.recruiter_assigned_at := null;
    end if;

    return new;
  end if;

  if new.role is distinct from old.role
     or new.manager_user_id is distinct from old.manager_user_id
     or new.recruiter_user_id is distinct from old.recruiter_user_id
  then
    raise exception 'Not authorized to change role / manager / recruiter';
  end if;

  return new;
end;
$function$;

-- 4) Helper RLS (fase 2: combinar en USING de políticas sensibles si se desea)
create or replace function public.current_profile_access_ok()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select p.account_status = 'active'
      from public.profiles p
      where p.user_id = auth.uid()
    ),
    false
  );
$$;

grant execute on function public.current_profile_access_ok() to authenticated;

comment on function public.current_profile_access_ok() is
  'True si el perfil del usuario autenticado existe y account_status = active. Para usar en RLS (fase 2).';

commit;
