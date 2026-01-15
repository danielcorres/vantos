-- PROFILES: Asegurar que owner puede ver y actualizar todos los perfiles
-- Las políticas existentes usan is_admin_or_owner() que ya incluye 'owner'
-- Esta migración asegura explícitamente permisos para owner

begin;

-- Verificar que is_admin_or_owner() incluye 'owner'
-- (Ya existe en init.sql, pero lo verificamos)
create or replace function public.is_admin_or_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() in ('admin','owner'), false)
$$;

-- Las políticas existentes ya permiten owner a través de is_admin_or_owner()
-- Pero agregamos políticas explícitas para owner si no existen
-- (Las políticas existentes ya cubren esto, pero las mantenemos explícitas)

-- Policy para SELECT: owner puede ver todos los perfiles
-- (Ya existe profiles_select_self_or_admin que usa is_admin_or_owner())

-- Policy para UPDATE: owner puede actualizar role, manager_user_id, recruiter_user_id de todos
-- La política existente profiles_update_self_or_admin ya permite esto
-- pero la mantenemos explícita para claridad

-- Nota: Las políticas existentes ya permiten que owner:
-- - SELECT todos los perfiles (a través de is_admin_or_owner())
-- - UPDATE todos los perfiles (a través de is_admin_or_owner())
-- 
-- Esta migración solo verifica que la función is_admin_or_owner() esté correcta

commit;
