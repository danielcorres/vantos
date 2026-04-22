-- Manager y recruiter: auto-asignación a asesores (mismas reglas que seguimiento/developer).
-- 1) Trigger granular (sin bloquear manager_user_id / recruiter_user_id para self-service).
-- 2) SELECT: ver asesores sin slot o ya asignados a mí.
-- 3) UPDATE: poder persistir updates en esas filas (el trigger acota columnas).

begin;

-- ---------------------------------------------------------------------------
-- 1) profiles_block_sensitive_updates: por columna; manager/recruiter self-service
-- ---------------------------------------------------------------------------
create or replace function public.profiles_block_sensitive_updates()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  r text := public.auth_role();
begin
  if public.can_assign_roles() then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'Not authorized to change role';
  end if;

  -- manager_user_id
  if new.manager_user_id is distinct from old.manager_user_id then
    if old.role <> 'advisor' then
      raise exception 'Not authorized to change manager assignment';
    end if;
    if r = 'manager' then
      if new.manager_user_id is not null and new.manager_user_id <> auth.uid() then
        raise exception 'Solo puedes asignarte a ti mismo como manager';
      end if;
      if new.manager_user_id is not null
         and old.manager_user_id is not null
         and old.manager_user_id is distinct from auth.uid()
      then
        raise exception 'Ya hay otro manager asignado; solo un administrador puede reasignar';
      end if;
      if new.manager_user_id is null
         and old.manager_user_id is not null
         and old.manager_user_id is distinct from auth.uid()
      then
        raise exception 'Solo puedes quitar tu propia asignación como manager';
      end if;
    else
      raise exception 'Not authorized to change manager assignment';
    end if;
  end if;

  -- recruiter_user_id
  if new.recruiter_user_id is distinct from old.recruiter_user_id then
    if old.role <> 'advisor' then
      raise exception 'Not authorized to change recruiter assignment';
    end if;
    if r = 'recruiter' then
      if new.recruiter_user_id is not null and new.recruiter_user_id <> auth.uid() then
        raise exception 'Solo puedes asignarte a ti mismo como recruiter';
      end if;
      if new.recruiter_user_id is not null
         and old.recruiter_user_id is not null
         and old.recruiter_user_id is distinct from auth.uid()
      then
        raise exception 'Ya hay otro recruiter asignado; solo un administrador puede reasignar';
      end if;
      if new.recruiter_user_id is null
         and old.recruiter_user_id is not null
         and old.recruiter_user_id is distinct from auth.uid()
      then
        raise exception 'Solo puedes quitar tu propia asignación como recruiter';
      end if;
    else
      raise exception 'Not authorized to change recruiter assignment';
    end if;
  end if;

  if new.seguimiento_user_id is distinct from old.seguimiento_user_id then
    if old.role <> 'advisor' then
      raise exception 'Not authorized to change seguimiento assignment';
    end if;
    if r = 'seguimiento' then
      if new.seguimiento_user_id is not null and new.seguimiento_user_id <> auth.uid() then
        raise exception 'Seguimiento solo puede asignarse a sí mismo en esta columna';
      end if;
      if new.seguimiento_user_id is not null
         and old.seguimiento_user_id is not null
         and old.seguimiento_user_id is distinct from auth.uid()
      then
        raise exception 'Ya hay otra persona de seguimiento asignada; solo un administrador puede reasignar';
      end if;
      if new.seguimiento_user_id is null
         and old.seguimiento_user_id is not null
         and old.seguimiento_user_id is distinct from auth.uid()
      then
        raise exception 'Seguimiento solo puede quitar su propia asignación';
      end if;
    else
      raise exception 'Not authorized to change seguimiento assignment';
    end if;
  end if;

  if new.developer_user_id is distinct from old.developer_user_id then
    if old.role <> 'advisor' then
      raise exception 'Not authorized to change developer assignment';
    end if;
    if r = 'developer' then
      if new.developer_user_id is not null and new.developer_user_id <> auth.uid() then
        raise exception 'Developer solo puede asignarse a sí mismo en esta columna';
      end if;
      if new.developer_user_id is not null
         and old.developer_user_id is not null
         and old.developer_user_id is distinct from auth.uid()
      then
        raise exception 'Ya hay otra persona asignada como developer; solo un administrador puede reasignar';
      end if;
      if new.developer_user_id is null
         and old.developer_user_id is not null
         and old.developer_user_id is distinct from auth.uid()
      then
        raise exception 'Developer solo puede quitar su propia asignación';
      end if;
    else
      raise exception 'Not authorized to change developer assignment';
    end if;
  end if;

  -- Manager/recruiter no son milestone editors: solo su columna de asignación (más updated_at)
  if r = 'manager' and old.role = 'advisor' then
    if (
      select to_jsonb(n) - 'manager_user_id' - 'updated_at'
      from (select new.*) n
    ) is distinct from (
      select to_jsonb(o) - 'manager_user_id' - 'updated_at'
      from (select old.*) o
    ) then
      raise exception 'Solo puedes modificar la asignación de manager (manager_user_id)';
    end if;
  end if;

  if r = 'recruiter' and old.role = 'advisor' then
    if (
      select to_jsonb(n) - 'recruiter_user_id' - 'updated_at'
      from (select new.*) n
    ) is distinct from (
      select to_jsonb(o) - 'recruiter_user_id' - 'updated_at'
      from (select old.*) o
    ) then
      raise exception 'Solo puedes modificar la asignación de recruiter (recruiter_user_id)';
    end if;
  end if;

  return new;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 2) SELECT: managers / recruiters ven asesores reclamables o su equipo
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'manager_can_select_advisors_for_self_assign'
  ) then
    execute $p$
      create policy "manager_can_select_advisors_for_self_assign"
      on public.profiles
      as permissive
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.profiles me
          where me.user_id = auth.uid()
            and me.role = 'manager'
        )
        and public.profiles.role = 'advisor'
        and (
          public.profiles.manager_user_id is null
          or public.profiles.manager_user_id = auth.uid()
        )
      );
    $p$;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'recruiter_can_select_advisors_for_self_assign'
  ) then
    execute $p$
      create policy "recruiter_can_select_advisors_for_self_assign"
      on public.profiles
      as permissive
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.profiles me
          where me.user_id = auth.uid()
            and me.role = 'recruiter'
        )
        and public.profiles.role = 'advisor'
        and (
          public.profiles.recruiter_user_id is null
          or public.profiles.recruiter_user_id = auth.uid()
        )
      );
    $p$;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3) UPDATE: mismo alcance que SELECT (trigger limita columnas sensibles)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'profiles_update_manager_claimable_advisors'
  ) then
    execute $p$
      create policy "profiles_update_manager_claimable_advisors"
      on public.profiles
      as permissive
      for update
      to authenticated
      using (
        exists (
          select 1
          from public.profiles me
          where me.user_id = auth.uid()
            and me.role = 'manager'
        )
        and public.profiles.role = 'advisor'
        and (
          public.profiles.manager_user_id is null
          or public.profiles.manager_user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1
          from public.profiles me
          where me.user_id = auth.uid()
            and me.role = 'manager'
        )
        and public.profiles.role = 'advisor'
        and (
          public.profiles.manager_user_id is null
          or public.profiles.manager_user_id = auth.uid()
        )
      );
    $p$;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'profiles_update_recruiter_claimable_advisors'
  ) then
    execute $p$
      create policy "profiles_update_recruiter_claimable_advisors"
      on public.profiles
      as permissive
      for update
      to authenticated
      using (
        exists (
          select 1
          from public.profiles me
          where me.user_id = auth.uid()
            and me.role = 'recruiter'
        )
        and public.profiles.role = 'advisor'
        and (
          public.profiles.recruiter_user_id is null
          or public.profiles.recruiter_user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1
          from public.profiles me
          where me.user_id = auth.uid()
            and me.role = 'recruiter'
        )
        and public.profiles.role = 'advisor'
        and (
          public.profiles.recruiter_user_id is null
          or public.profiles.recruiter_user_id = auth.uid()
        )
      );
    $p$;
  end if;
end $$;

commit;
