-- TODO: Implementar seed data para desarrollo local
-- Incluir datos de prueba para:
-- - metric_definitions
-- - point_rules
-- - profiles (usuarios de prueba)
-- seed.sql
-- Initial metric definitions + point rules for OKR v0

begin;

-- Metric definitions (OKR v0)
insert into public.metric_definitions (key, label, unit, is_active, sort_order)
values
  ('calls',                'Llamadas',              'count', true, 10),
  ('meetings_set',         'Citas agendadas',       'count', true, 20),
  ('meetings_held',        'Citas realizadas',      'count', true, 30),
  ('proposals_presented',  'Propuestas presentadas','count', true, 40),
  ('applications_submitted','Solicitudes ingresadas','count', true, 50),
  ('referrals',            'Referidos',             'count', true, 60),
  ('policies_paid',        'Pólizas pagadas',       'count', true, 70)
on conflict (key) do update
set
  label = excluded.label,
  unit = excluded.unit,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order;

-- Point rules (simple defaults, adjust later via admin)
-- We use an "effective_from" far enough back so history is consistent for early tests.
insert into public.point_rules (metric_key, points, effective_from, effective_to)
values
  ('calls',                 1, date '2026-01-01', null),
  ('meetings_set',          3, date '2026-01-01', null),
  ('meetings_held',         5, date '2026-01-01', null),
  ('proposals_presented',   8, date '2026-01-01', null),
  ('applications_submitted',13, date '2026-01-01', null),
  ('referrals',             5, date '2026-01-01', null),
  ('policies_paid',         21, date '2026-01-01', null);

-- ============================================
-- PROFILES: Roles y asignaciones manager/recruiter
-- ============================================
-- NOTA: Para obtener los UUID de usuarios desde SQL Editor:
--   select user_id, email, role, display_name 
--   from public.profiles 
--   order by created_at;
--
-- O desde auth.users:
--   select id, email 
--   from auth.users 
--   order by created_at;
--
-- Reemplaza los placeholders <UUID_*> con los UUID reales de tus usuarios.

-- Ejemplo: Asignar role 'manager' a un usuario
-- update public.profiles 
-- set role = 'manager'
-- where user_id = '<UUID_MANAGER>';

-- Ejemplo: Asignar role 'recruiter' a un usuario
-- update public.profiles 
-- set role = 'recruiter'
-- where user_id = '<UUID_RECRUITER>';

-- Ejemplo: Asignar manager y recruiter a un advisor
-- update public.profiles
-- set 
--   manager_user_id = '<UUID_MANAGER>',
--   recruiter_user_id = '<UUID_RECRUITER>'
-- where user_id = '<UUID_ADVISOR>';

-- Ejemplo completo (descomenta y ajusta los UUIDs):
-- -- Set role manager
-- update public.profiles set role='manager' where user_id = '<UUID_MANAGER>';
-- -- Set role recruiter
-- update public.profiles set role='recruiter' where user_id = '<UUID_RECRUITER>';
-- -- Asignar manager y recruiter a advisor
-- update public.profiles
--   set manager_user_id = '<UUID_MANAGER>', recruiter_user_id = '<UUID_RECRUITER>'
-- where user_id = '<UUID_ADVISOR>';

commit;
