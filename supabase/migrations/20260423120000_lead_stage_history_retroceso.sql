-- Retrocesos de etapa: marcar filas que no deben contar en productividad semanal.

begin;

alter table public.lead_stage_history
  add column if not exists is_retroceso boolean not null default false;

comment on column public.lead_stage_history.is_retroceso is
  'Si true, la fila no cuenta en get_weekly_pipeline_entries; en retrocesos también se marca la entrada forward de la semana a la etapa abandonada.';

create index if not exists lead_stage_history_weekly_count_idx
  on public.lead_stage_history (lead_id, to_stage_id, occurred_at)
  where not coalesce(is_retroceso, false);

commit;
