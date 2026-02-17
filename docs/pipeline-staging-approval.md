# Pipeline refactor – Aprobación para staging/prod

**Fecha revisión:** 2026-02-17  
**Revisor:** Staff Engineer (merge a staging/prod)  
**Scope:** Módulo Pipeline post-refactor (domain, next_action opcional, ESLint limpio).

---

## 1) Build config

| Elemento | Estado | Detalle |
|----------|--------|---------|
| **package.json** | OK | `build`: `tsc -b && vite build` (refs a tsconfig.app + node). |
| **tsconfig** | OK | refs a tsconfig.app.json; strict, noUnusedLocals, noUnusedParameters; include `src`. |
| **vite.config.ts** | OK | react plugin; manualChunks (react, router, supabase); sin alias que rompa imports. |
| **Imports** | OK | No hay imports rotos. `features/calendar/api/calendar.api.ts` importa `../../pipeline/pipeline.api` → resuelve a `features/pipeline/pipeline.api`. |
| **PipelinePage legacy** | OK | No existe otra implementación. Único import de PipelinePage es `pages/PipelinePage` (wrapper). |

**Conclusión:** Build correcto. No se importa ninguna versión legacy de PipelinePage.

---

## 2) Una sola implementación de PipelinePage

| Punto | Estado |
|-------|--------|
| **src/pages/PipelinePage.tsx** | Solo re-export: `export { PipelinePage } from '../features/pipeline/PipelinePage'`. |
| **src/app/routes.tsx** | Lazy: `import('../pages/PipelinePage').then(m => ({ default: m.PipelinePage }))` → carga el wrapper → usa features. |
| **Lógica** | Toda en `src/features/pipeline/` (PipelinePage.tsx, store, api, domain, components, views). |

**Conclusión:** Una sola implementación real; pages es solo punto de entrada.

---

## 3) Domain, sin duplicados, sin campos eliminados

| Punto | Estado |
|-------|--------|
| **computeMomento** | Usado en: `LeadCard`, `LeadCardMobile`, `MomentoChip`. No queda `getMomentoDisplay` ni lógica duplicada de momento en componentes. |
| **NextAction** | `getNextActionType` y `formatNextActionDateLabel` usados en `NextActionChip`. `NextActionModal` mantiene `normalizeLegacyType` solo para valor inicial al abrir (mapeo UI), no regla de negocio. |
| **Campos eliminados** | Cero referencias en `src/features/pipeline/**` y `src/components/pipeline/**` a: `application_status`, `requirements_status`, `quote_status`, `last_contact_outcome`, `close_outcome`, `SituationChip`. |

**Conclusión:** Momento y NextAction centralizados en domain; sin referencias a campos/Situation eliminados.

---

## 4) Modal NextAction

| Requisito | Estado |
|-----------|--------|
| **Permite guardar null** | `onSave(next_action_at: string \| null, ...)`. Botón "Sin fecha" llama `onSave(null, actionType)`. |
| **No preselecciona fecha si no existe** | En `useEffect` al abrir: si `!parsed \|\| isNaN(parsed.getTime())` → `setSelectedYmd(null)`, `setSelectedHour(null)`. |
| **Tipos TS** | NextActionModalProps y callbacks (NextActionActions, LeadCreateModal, PipelinePage) aceptan `next_action_at: string \| null`. |

**Conclusión:** Modal listo para null, sin preselección cuando no hay fecha; tipos coherentes.

---

## 5) PipelineTable y set-state-in-effect

| Punto | Estado |
|-------|--------|
| **Re-render infinito** | No. El effect tiene deps `[isControlled, showGrouped, groupedSections]`. `setInternalCollapsed` usa actualización funcional y solo añade claves nuevas (`stage.id in next) continue`); no modifica estado que alimente `groupedSections` (viene del padre). Comportamiento idempotente para etapas ya conocidas. |
| **eslint-disable** | Justificado y documentado: `// eslint-disable-next-line react-hooks/set-state-in-effect -- sync initial collapsed state from groupedSections`. Patrón: seed inicial de estado colapsado desde props; una sola vez por montaje/cambio de secciones. |

**Conclusión:** Sin riesgo de loop; supresión adecuada.

---

## 6) Migración

**Archivo:** `supabase/migrations/20260217110000_next_action_at_optional.sql`

```sql
alter table public.leads
  drop constraint if exists leads_next_action_when_active;
```

| Punto | Estado |
|-------|--------|
| **Alcance** | Solo elimina el constraint. No toca otras tablas ni reglas. |
| **Idempotencia** | `drop constraint if exists` seguro ante re-ejecución. |
| **Orden de migraciones** | `20260212000000` añade el constraint; `20260217110000` lo quita. Orden por timestamp correcto. |

**Orden de despliegue recomendado:**  
1) **DB primero:** aplicar migraciones (incluida `20260217110000`).  
2) **Frontend después:** desplegar app.  
Si se despliega frontend antes sin la migración, guardar "Sin fecha" o crear lead sin próxima acción fallará con 23514 (constraint violation).

---

## 7) Checklist y orden de deploy

### Checklist final staging

- [ ] Migración `20260217110000_next_action_at_optional.sql` aplicada en DB de staging.
- [ ] `npm run build` en verde.
- [ ] `npx eslint src/features/pipeline src/components/pipeline src/pages/PipelinePage.tsx src/pages/LeadDetailPage.tsx src/shared/components/LeadCard.tsx` → 0 errores, 0 warnings.
- [ ] Smoke: abrir Pipeline, ver tabla/Kanban, abrir modal próximo paso, guardar con fecha y con "Sin fecha", crear lead con y sin próxima acción.
- [ ] Smoke: mover lead entre etapas (con y sin next_action_at).
- [ ] Verificar que Momento (avanzando / por definir / sin respuesta) se ve correctamente en Kanban y tabla.

### Checklist final producción

- [ ] Staging validado según checklist anterior.
- [ ] Backup/plan de rollback de DB conocido.
- [ ] Migración aplicada en DB de producción (mismo orden: migraciones al día, incluyendo `20260217110000`).
- [ ] Deploy de frontend después del deploy de DB.
- [ ] Post-deploy: smoke mínimo (Pipeline, crear/editar lead, próximo paso con y sin fecha).

### Orden exacto de deploy recomendado

1. **Aplicar migraciones en la base de datos (staging o prod según entorno)**  
   - `supabase db push` o equivalente, de modo que `20260217110000_next_action_at_optional.sql` esté aplicada.
2. **Desplegar frontend**  
   - Build actual (ya probado con `npm run build`).

### Posibles riesgos (mitigados)

| Riesgo | Mitigación |
|--------|------------|
| Deploy frontend antes que la migración | Orden estricto: DB primero, luego frontend. Documentado arriba. |
| Usuarios con pestaña abierta (código viejo) tras deploy | Comportamiento: si la DB ya no tiene el constraint, guardar sin fecha funcionará. Si por error se desplegó frontend antes que la migración, esos usuarios verían error al guardar sin fecha hasta que la migración se aplique. |
| Referencias a `normalizeLeadSource` fuera de pipeline | No hay imports de `normalizeLeadSource`; se dejó de exportar y solo se usa dentro de LeadSourceTag. Sin impacto. |

---

## Veredicto

**Listo para staging**, con la condición de aplicar antes la migración `20260217110000_next_action_at_optional.sql` en la DB del entorno correspondiente y desplegar el frontend después.

**Pasos concretos para deploy seguro**

1. En el entorno objetivo (staging primero): aplicar migraciones DB (`supabase db push` o flujo actual).
2. Verificar que la migración `20260217110000` está aplicada (constraint `leads_next_action_when_active` no existe).
3. Desplegar frontend (build ya generado con `npm run build`).
4. Ejecutar smoke: Pipeline, modal próximo paso con/sin fecha, crear lead con/sin próxima acción, mover etapas.
5. Para producción: repetir el mismo orden (DB → frontend) después de validar en staging.
