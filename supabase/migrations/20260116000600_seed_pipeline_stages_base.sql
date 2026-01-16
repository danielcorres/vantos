begin;

insert into public.pipeline_stages (name, position, is_active, sla_enabled, sla_days, sla_warn_days)
values
  ('Nuevo',           10, true, false, null, null),
  ('Contactado',      20, true, true,  1,    1),
  ('Cita agendada',   30, true, false, null, null),
  ('Cita realizada',  40, true, false, null, null),
  ('Propuesta',       50, true, false, null, null),
  ('Cerrado ganado',  60, true, false, null, null),
  ('Cerrado perdido', 70, true, false, null, null)
on conflict (name) do update
set
  position = excluded.position,
  is_active = excluded.is_active,
  sla_enabled = excluded.sla_enabled,
  sla_days = excluded.sla_days,
  sla_warn_days = excluded.sla_warn_days;

commit;
