begin;

insert into public.metric_definitions (key, label, unit, is_active, sort_order)
values ('pipeline.stage_moved', 'Pipeline: etapa movida', 'count', true, 900)
on conflict (key) do update
set label = excluded.label,
    unit = excluded.unit,
    is_active = true,
    sort_order = excluded.sort_order;

commit;
