-- Eliminar métrica written_premium_weekly_mxn (Prima emitida semanal MXN) del catálogo OKR y datos relacionados.

begin;

delete from public.activity_events
where metric_key = 'written_premium_weekly_mxn';

delete from public.targets
where metric_key = 'written_premium_weekly_mxn';

delete from public.point_rules
where metric_key = 'written_premium_weekly_mxn';

delete from public.okr_metric_scores
where metric_key = 'written_premium_weekly_mxn';

delete from public.okr_metric_scores_global
where metric_key = 'written_premium_weekly_mxn';

delete from public.okr_weekly_minimum_targets
where metric_key = 'written_premium_weekly_mxn';

delete from public.metric_definitions
where key = 'written_premium_weekly_mxn';

commit;
