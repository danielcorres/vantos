-- next_action_at deja de ser obligatorio para leads activos.
-- Permite leads con próximo paso sin fecha (solo tipo o sin tipo).

alter table public.leads
  drop constraint if exists leads_next_action_when_active;
