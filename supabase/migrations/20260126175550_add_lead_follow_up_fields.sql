-- =====================================================
-- Agregar campos de seguimiento a leads
-- Elimina dependencia de SLA para seguimiento humano
-- =====================================================

-- Agregar columnas de seguimiento
alter table public.leads
  add column if not exists last_contact_at date null,
  add column if not exists next_follow_up_at date null;

-- Agregar constraint para source (4 valores permitidos)
alter table public.leads
  drop constraint if exists leads_source_check;

alter table public.leads
  add constraint leads_source_check
  check (source is null or source in ('Referido', 'Mercado natural', 'Frío', 'Social media'));

-- Comentarios para documentación
comment on column public.leads.last_contact_at is 'Fecha del último contacto con el lead';
comment on column public.leads.next_follow_up_at is 'Fecha del próximo seguimiento programado';
comment on column public.leads.source is 'Fuente del lead: Referido, Mercado natural, Frío, Social media';
