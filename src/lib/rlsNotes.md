# RLS (Row Level Security) Notes

## Principios
- RLS ON por defecto para tablas de negocio
- Políticas simples al inicio:
  - advisors: solo ven sus eventos/targets
  - admin/owner: pueden ver todos

## Tablas que requieren RLS
- activity_events
- targets
- profiles
- point_rules (solo lectura para advisors)
- metric_definitions (solo lectura para advisors)

## Ejemplo de política
```sql
-- activity_events: allow select where actor_user_id = auth.uid() OR role in (admin, owner)
```
