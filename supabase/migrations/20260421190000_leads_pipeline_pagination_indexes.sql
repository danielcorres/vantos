-- Índices para consultas paginadas del pipeline (por etapa + orden Kanban / lista archivados).

CREATE INDEX IF NOT EXISTS leads_active_stage_next_action_id_idx
  ON public.leads (stage_id, next_action_at ASC NULLS LAST, id ASC)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS leads_archived_created_id_idx
  ON public.leads (created_at DESC, id DESC)
  WHERE archived_at IS NOT NULL;
