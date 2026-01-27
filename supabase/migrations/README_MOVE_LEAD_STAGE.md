# move_lead_stage – notas de migraciones

Este proyecto tiene varias migraciones históricas relacionadas a `move_lead_stage`.

## Canon / estado vigente (debe existir en todos los ambientes)
- 20260126200000_lead_stage_history_occurred_at.sql
- 20260126200100_move_lead_stage_accept_occurred_at.sql
- 20260127202047_fix_move_lead_stage_overload.sql

## Históricas (debug/patch)
Estas fueron parte de iteraciones y depuración. No cambiar ni reutilizar como referencia principal:
- 20260108222229_patch_move_lead_stage_autolog_lead_id.sql
- 20260108223133_debug_move_lead_stage_autolog.sql
- 20260108223731_patch_move_lead_stage_tolerant_autolog.sql

Nota: el estado actual de la función se valida con:
`select pg_get_functiondef(p.oid) ... where proname='move_lead_stage'`
