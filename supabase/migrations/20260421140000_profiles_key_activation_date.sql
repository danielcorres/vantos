-- Fecha de alta de clave: ancla del primer periodo de hitos (90 días, meta 6 pólizas de vida).
-- Inicio del precontrato / ventana que cuenta hacia la primera meta.

begin;

alter table public.profiles
  add column if not exists key_activation_date date null;

comment on column public.profiles.key_activation_date is
  'Fecha de alta de clave del asesor. Inicia la ventana de 90 días para al menos 6 pólizas de vida (incluye precontrato en ese rango).';

commit;
