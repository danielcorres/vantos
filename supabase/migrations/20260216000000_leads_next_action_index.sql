-- Índice parcial para acelerar filtros por próxima acción en leads activos
create index if not exists leads_next_action_at_active_idx
on public.leads (next_action_at)
where archived_at is null;
