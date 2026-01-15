-- PROFILES: Agregar campos first_name, last_name, full_name y updated_at
-- Mantener user_id como PK (hay FKs que lo referencian)

-- Agregar columnas nuevas si no existen
alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists updated_at timestamptz not null default now();

-- Agregar columna generada full_name
do $$ 
begin
  if not exists (
    select 1 from pg_attribute 
    where attrelid = 'public.profiles'::regclass 
    and attname = 'full_name'
  ) then
    alter table public.profiles
      add column full_name text generated always as (
        trim(both ' ' from coalesce(first_name,'') || ' ' || coalesce(last_name,''))
      ) stored;
  end if;
end $$;

-- updated_at trigger (si no existe la función)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Aplicar trigger a profiles
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Actualizar políticas RLS para permitir que usuarios actualicen sus propios perfiles
-- (Las políticas existentes ya permiten esto, pero las mantenemos explícitas)
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Actualizar trigger de creación de usuario para incluir campos nuevos
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, role, display_name, first_name, last_name)
  values (
    new.id,
    'advisor',
    coalesce(new.raw_user_meta_data->>'display_name', new.email),
    null,
    null
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;
