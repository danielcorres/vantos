-- Archivar asesores (baja agencia, datos conservados) y borrado definitivo (solo owner).
-- archived_at / archived_by + RPCs + extensión de profiles_block_sensitive_updates

begin;

-- ---------------------------------------------------------------------------
-- 1) Columnas
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists archived_at timestamptz null,
  add column if not exists archived_by uuid null
    references public.profiles (user_id) on delete set null;

create index if not exists profiles_archived_at_idx
  on public.profiles (archived_at)
  where archived_at is not null;

-- ---------------------------------------------------------------------------
-- 2) Trigger profiles_block_sensitive_updates (reemplazo completo)
-- ---------------------------------------------------------------------------
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

    if new.archived_at is distinct from old.archived_at then
      if new.archived_at is not null and old.user_id = auth.uid() then
        raise exception 'No puedes archivarte a ti mismo';
      end if;
      if new.archived_at is not null and old.user_id = (
        select g.owner_user_id from public.okr_settings_global g order by g.created_at asc limit 1
      ) then
        raise exception 'No se puede archivar al owner del sistema';
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

  if new.archived_at is distinct from old.archived_at then
    raise exception 'No autorizado para archivar/restaurar usuarios';
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

-- ---------------------------------------------------------------------------
-- 3) RPC archivar / restaurar / borrar
-- ---------------------------------------------------------------------------
create or replace function public.archive_advisor(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  sys_owner uuid;
begin
  if not public.can_assign_roles() then
    raise exception 'Solo owner o director pueden archivar asesores';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'No puedes archivarte a ti mismo';
  end if;

  select g.owner_user_id into sys_owner
  from public.okr_settings_global g
  order by g.created_at asc
  limit 1;

  if p_user_id = sys_owner then
    raise exception 'No se puede archivar al owner del sistema';
  end if;

  if not exists (
    select 1 from public.profiles p where p.user_id = p_user_id and p.role = 'advisor'
  ) then
    raise exception 'Solo se pueden archivar usuarios con rol asesor';
  end if;

  update public.profiles
  set
    archived_at = now(),
    archived_by = auth.uid(),
    account_status = 'suspended'
  where user_id = p_user_id
    and role = 'advisor';
end;
$$;

create or replace function public.restore_advisor(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_assign_roles() then
    raise exception 'Solo owner o director pueden restaurar asesores';
  end if;

  update public.profiles
  set
    archived_at = null,
    archived_by = null,
    account_status = 'active'
  where user_id = p_user_id
    and role = 'advisor';
end;
$$;

create or replace function public.delete_advisor_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  sys_owner uuid;
begin
  if not public.is_owner() then
    raise exception 'Solo el owner puede borrar usuarios';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'No puedes borrarte a ti mismo';
  end if;

  select g.owner_user_id into sys_owner
  from public.okr_settings_global g
  order by g.created_at asc
  limit 1;

  if p_user_id = sys_owner then
    raise exception 'No se puede borrar al owner del sistema';
  end if;

  if not exists (
    select 1 from public.profiles p where p.user_id = p_user_id and p.role = 'advisor'
  ) then
    raise exception 'Solo se pueden borrar usuarios con rol asesor';
  end if;

  delete from auth.users where id = p_user_id;
end;
$$;

comment on function public.archive_advisor(uuid) is
  'Marca asesor como archivado (suspended + archived_at). Solo owner/director (can_assign_roles).';
comment on function public.restore_advisor(uuid) is
  'Quita archivo y reactiva cuenta del asesor. Solo owner/director.';
comment on function public.delete_advisor_user(uuid) is
  'Elimina usuario de auth (cascada a profiles, eventos, etc.). Solo rol owner en profiles. Solo asesores.';

grant execute on function public.archive_advisor(uuid) to authenticated;
grant execute on function public.restore_advisor(uuid) to authenticated;
grant execute on function public.delete_advisor_user(uuid) to authenticated;

commit;
