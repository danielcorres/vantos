-- PROFILES: Agregar soporte para manager y recruiter
-- Roles: owner | manager | recruiter | advisor
-- Para advisors: manager_user_id y recruiter_user_id

begin;

-- 1) Actualizar CHECK constraint de role para incluir manager y recruiter
-- Primero eliminar el constraint existente si existe
alter table public.profiles
  drop constraint if exists profiles_role_check;

-- Agregar nuevo constraint con todos los roles válidos
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('owner', 'manager', 'recruiter', 'advisor'));

-- Asegurar default role = 'advisor' para nuevos perfiles
alter table public.profiles
  alter column role set default 'advisor';

-- 2) Agregar columnas manager_user_id y recruiter_user_id
alter table public.profiles
  add column if not exists manager_user_id uuid null,
  add column if not exists recruiter_user_id uuid null;

-- 3) Agregar FKs self-reference
-- manager_user_id references profiles(user_id) on delete set null
alter table public.profiles
  drop constraint if exists profiles_manager_user_id_fkey;

alter table public.profiles
  add constraint profiles_manager_user_id_fkey
  foreign key (manager_user_id)
  references public.profiles(user_id)
  on delete set null;

-- recruiter_user_id references profiles(user_id) on delete set null
alter table public.profiles
  drop constraint if exists profiles_recruiter_user_id_fkey;

alter table public.profiles
  add constraint profiles_recruiter_user_id_fkey
  foreign key (recruiter_user_id)
  references public.profiles(user_id)
  on delete set null;

-- 4) Crear índices para mejorar performance de queries
create index if not exists profiles_manager_user_id_idx
  on public.profiles(manager_user_id)
  where manager_user_id is not null;

create index if not exists profiles_recruiter_user_id_idx
  on public.profiles(recruiter_user_id)
  where recruiter_user_id is not null;

create index if not exists profiles_role_idx
  on public.profiles(role);

-- 5) Asegurar que updated_at existe (por si acaso)
alter table public.profiles
  add column if not exists updated_at timestamptz not null default now();

commit;
