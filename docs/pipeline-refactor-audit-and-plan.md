# Pipeline – Auditoría (A) y Plan de Refactor (B)

## A) AUDITORÍA – Problemas con evidencia

### 1. SituationChip y campos eliminados
- **SituationChip**: Existe `src/components/pipeline/SituationChip.tsx` (exportado). **No está importado en ningún otro archivo.** Se puede eliminar el archivo.
- **Campos eliminados (DB ya limpiada en migración 20260217100000)**: `application_status`, `requirements_status`, `quote_status`, `last_contact_outcome`, `close_outcome` siguen en **tipos y lógica** en `src/shared/utils/leadTags.ts`. Ningún archivo del pipeline importa `leadTags`; alcance = solo pipeline, no tocamos leadTags.

### 2. Lógica de Momento duplicada (3 sitios)
- `src/components/pipeline/MomentoChip.tsx`: `getMomentoDisplay(next_action_at, momento_override)` — por_definir si override, sin_respuesta si isSinRespuesta(next_action_at), avanzando resto.
- `src/features/pipeline/components/LeadCard.tsx` (líneas 26-28): repite `isPorDefinir`, `isSinResp = lead.next_action_at ? isSinRespuesta(lead.next_action_at) : false` y deriva `cardBorderClass` y `momentoLabel`.
- `src/components/pipeline/LeadCardMobile.tsx` (líneas 38-39): misma lógica duplicada para `kanbanCardBorderClass` y `kanbanMomentoLabel`.
- **Regla sin_respuesta**: “next_action_at vencido >= 7 días Y NO existe nueva fecha futura” → en código actual solo se usa `isSinRespuesta(next_action_at)` (>=7 días). Equivale a “no hay fecha futura” porque la única fecha es `next_action_at`.

### 3. Lógica de NextAction / formato de fecha duplicada
- **Tipo normalizado**: `pipeline.api.ts` tiene `normalizeNextActionType`; `NextActionModal.tsx` tiene `normalizeLegacyType` (duplicado). No hay una función `getNextActionType(lead)` central.
- **Formato de fecha**: `src/shared/utils/nextAction.ts` tiene `getNextActionLabel` (“Hoy 5:00 pm”); `NextActionChip.tsx` tiene `formatNextActionDate` local (“Hoy · 6:30 p.m.”) con su propia `toYmdInMonterrey`, `getTodayYmd`, `addOneDay`. Reglas piden “Hoy · 6:30 p.m.” → duplicación y riesgo de divergencia.
- **NextActionChip** usa `TYPE_CONFIG` con legacy (call, follow_up, presentation); reglas: solo `contact` | `meeting`.

### 4. next_action_at obligatorio vs reglas
- **CreateLeadInput** (`pipeline.api.ts`): `next_action_at: string` (obligatorio). **createLead** hace `insert` con `next_action_at: input.next_action_at` y captura error 23514 (“Lead activo debe tener Próxima Acción válida”).
- **DB**: Migración `20260212000000_leads_next_action.sql` tiene `leads_next_action_when_active`: `check (archived_at is not null or next_action_at is not null)`. Para que next_action_at no sea obligatorio hay que **añadir una migración** que elimine ese constraint.
- **NextActionModal**: Si no hay `initialNextActionAt`, ya hace `setSelectedYmd(null)` (no preselecciona). Pero **no permite guardar sin fecha**: `getSubmitDate()` devuelve null si no hay `selectedYmd`, y el submit exige fecha. Hay que permitir “Guardar sin fecha” (enviar `next_action_at: null` o equivalente) y que el tipo siga siendo opcional.

### 5. Kanban: Momento y rojo fuerte
- **LeadCard** (Kanban desktop) y **LeadCardMobile** variant=kanban ya no usan `<MomentoChip />`; usan etiqueta pequeña. Correcto.
- Estilos: usan `border-red-300 bg-red-50/30` para sin_respuesta. Reglas: “indicador mínimo (border + etiqueta pequeña), **sin rojo fuerte**”. Hay que suavizar (ej. border rojo suave, sin fondo rojo fuerte).

### 6. getProximaLabel / LeadsTable / proximaLabel (legacy)
- **PipelineTable** recibe `getProximaLabel` en props pero lo marca como `_getProximaLabel` y **no lo usa** (la tabla desktop usa LeadRowDesktop con next_action_at/next_action_type y MomentoChip).
- **PipelineTableView** importa `getProximaLabel` de `../utils/proximaLabel` y lo pasa a PipelineTable. Se puede quitar de la vista y del tipo de PipelineTable.
- **LeadsTable** (`src/features/pipeline/components/LeadsTable.tsx`) usa `getProximaLabel(stageName, lead.next_follow_up_at)` y columna “Próxima” con next_follow_up_at. **LeadsTable no está importado en ningún otro archivo** (código muerto). Pipeline = solo Etapa, Próximo paso, Momento → “Próxima” por next_follow_up_at es legacy. Opciones: eliminar LeadsTable o dejarlo sin usar; en este refactor se deja el archivo pero se elimina el uso de getProximaLabel en la vista principal.

### 7. Entry point Pipeline
- `src/pages/PipelinePage.tsx` solo hace `export { PipelinePage } from '../features/pipeline/PipelinePage'`. Un solo entry point real: `src/features/pipeline/PipelinePage.tsx`. No hay duplicidad de páginas.

### 8. LeadCard: dos “cards” con lógica repetida
- **LeadCard** (features/pipeline/components/LeadCard.tsx): usado en KanbanColumn (desktop). Contiene: momento (border + label), NextActionActions, MoveStageButton, LeadSourceTag.
- **LeadCardMobile** (components/pipeline/LeadCardMobile.tsx): usado en PipelineTable (móvil y tabla). Variants: default (LeadCardContent + MoveStage), kanban (momento label + NextActionActions), table (NextActionActions + MomentoChip). Repite cálculo de momento y estilos de borde.
- **LeadCardContent**: solo contenido (nombre, contacto, fuente, progreso); no incluye próximo paso ni momento. La “base” de negocio (momento, próximo paso) está duplicada entre LeadCard y LeadCardMobile; debe vivir en domain y los componentes solo consumir.

### 9. Utils: dos hogares para nextAction
- `src/shared/utils/nextAction.ts`: getNextActionBucket, daysOverdue, isSinRespuesta, getNextActionLabel, filterLeadsByNextAction, countLeadsByNextAction, TZ, toYmdInMonterrey, getTodayYmd.
- `src/features/pipeline/utils/nextActionFilter.ts`: re-exporta tipo y funciones desde shared. **PipelinePage** importa desde `../../shared/utils/nextAction`. El plan pide un solo hogar en `features/pipeline/domain`; shared puede quedar como dependencia de bajo nivel (fechas/TZ) y domain re-exporta o delega.

---

## B) PLAN DE REFACTOR MÍNIMO (pasos, impacto, riesgo)

### Paso 1 – Dominio pipeline
- **Crear** `src/features/pipeline/domain/pipeline.domain.ts` con:
  - `computeMomento(lead, now?)` → `'avanzando' | 'por_definir' | 'sin_respuesta'`
  - `getNextActionType(lead)` → `'contact' | 'meeting' | null`
  - `formatNextActionDateLabel(date, now?)` → string ("Hoy · 6:30 p.m.")
  - `isOverdueSevenDays(lead, now?)` → boolean
- Usar en dominio `isSinRespuesta`/`daysOverdue` desde `shared/utils/nextAction` (o mover solo la lógica de días a domain y dejar TZ en shared).
- **Impacto**: Nuevo archivo; sin cambios en UI todavía. **Riesgo**: Bajo.

### Paso 2 – Eliminar SituationChip; Kanban momento suave
- **Eliminar** `src/components/pipeline/SituationChip.tsx`. Buscar cualquier import (ya confirmado: ninguno).
- **Kanban**: En LeadCard y LeadCardMobile (variant kanban), usar `computeMomento(lead)` del domain y sustituir estilos “sin_respuesta” por indicador mínimo (ej. `border-l-2 border-red-200` o similar, sin `bg-red-50/30` fuerte). Etiqueta pequeña “Sin respuesta” más neutra.
- **Impacto**: Un archivo menos; estilos más suaves. **Riesgo**: Bajo.

### Paso 3 – MomentoChip y componentes usan domain
- **MomentoChip**: Reemplazar `getMomentoDisplay` local por `computeMomento` del domain (pasando `{ next_action_at, momento_override }`).
- **LeadCard** y **LeadCardMobile**: Quitar cálculo local de momento; usar `computeMomento(lead)` y, si hace falta, un helper de estilos que devuelva border/class a partir de momento.
- **Impacto**: Un solo lugar para la regla de momento. **Riesgo**: Bajo si los tipos coinciden.

### Paso 4 – NextAction: formato y tipo desde domain
- **NextActionChip**: Usar `formatNextActionDateLabel` y `getNextActionType(lead)` del domain. Eliminar `formatNextActionDate` y TYPE_CONFIG legacy; solo contact/meeting.
- **NextActionModal**: Mantener no preselección cuando no hay fecha. Añadir opción “Sin fecha” (guardar con `next_action_at: null`) para cumplir “next_action_at ya NO es obligatorio”.
- **NextActionActions / API**: Aceptar `next_action_at: string | null` en onSave y en updateLead.
- **Impacto**: UI consistente; modal permite sin fecha. **Riesgo**: Medio (flujo de guardado).

### Paso 5 – next_action_at opcional en tipos y DB
- **CreateLeadInput**: Cambiar `next_action_at: string` a `next_action_at?: string | null`. createLead: enviar `next_action_at: input.next_action_at ?? null`.
- **Nueva migración**: `alter table public.leads drop constraint if exists leads_next_action_when_active;` para que activos puedan tener next_action_at null.
- **LeadCreateModal**: Permitir cerrar NextActionModal “sin fecha” (ej. botón “Omitir” o “Sin fecha”) y crear lead con next_action_at null.
- **Impacto**: Crear lead y editar lead sin fecha. **Riesgo**: Bajo si la migración se aplica antes del deploy.

### Paso 6 – Limpieza vista y utils
- **PipelineTableView**: Dejar de pasar `getProximaLabel` a PipelineTable. **PipelineTable**: Quitar prop `getProximaLabel` del tipo y del componente.
- **nextActionFilter**: Mantener re-export desde shared o hacer que pipeline importe desde domain; domain puede re-exportar desde shared. Opción mínima: PipelinePage y demás sigan importando desde shared; domain usa shared para implementar computeMomento/formatNextActionDateLabel.
- **LeadsTable**: No se importa; se deja el archivo (o se elimina en limpieza opcional). No quitar getProximaLabel de LeadsTable si se mantiene el archivo por si en el futuro se reutiliza con next_action; si se elimina LeadsTable, se puede eliminar proximaLabel o dejarlo para otro módulo.
- **Impacto**: Menos props y dependencias en la vista. **Riesgo**: Bajo.

### Orden de commits sugerido
1. Commit 1: Crear `pipeline.domain.ts` e integrar en MomentoChip + LeadCard + LeadCardMobile (momento).
2. Commit 2: NextAction desde domain (NextActionChip, getNextActionType, formatNextActionDateLabel); modal sin preselección ya está; añadir “Sin fecha” y tipos next_action_at opcional.
3. Commit 3: Eliminar SituationChip; Kanban momento suave (estilos).
4. Commit 4: CreateLeadInput y createLead con next_action_at opcional; migración drop constraint; LeadCreateModal “Sin fecha”.
5. Commit 5: Quitar getProximaLabel de PipelineTableView y PipelineTable.
6. Commit 6 (opcional): Eliminar LeadsTable o dejarlo; limpieza de comentarios/re-exports.

---

## Checklist de validación (al final)
- [x] No hay referencias a SituationChip, application_status, requirements_status, quote_status, last_contact_outcome, close_outcome en pipeline.
- [x] Momento se calcula en un solo lugar (domain).
- [x] NextAction tipo y formato en un solo lugar (domain).
- [x] Modal no preselecciona fecha si no existe; permite guardar sin fecha (botón "Sin fecha" + allowNoDate).
- [x] next_action_at no es obligatorio en tipos y UI; migración 20260217110000 elimina constraint.
- [x] Kanban no usa MomentoChip; tabla/detalle sí usan MomentoChip.
- [x] TypeScript compila sin errores.

---

## Resumen de cambios aplicados (commits lógicos)

### Commit 1: Dominio pipeline + uso en Momento y cards
- **Archivos**: `src/features/pipeline/domain/pipeline.domain.ts` (nuevo), `MomentoChip.tsx`, `LeadCard.tsx`, `LeadCardMobile.tsx`
- **Cambios**: `computeMomento`, `getNextActionType`, `formatNextActionDateLabel`, `isOverdueSevenDays` en domain; MomentoChip y cards usan `computeMomento(lead)`; Kanban con indicador mínimo (border-l + etiqueta suave).
- **Seguro**: Solo centraliza lógica; reglas idénticas.

### Commit 2: NextAction desde domain + modal sin fecha
- **Archivos**: `NextActionChip.tsx`, `NextActionModal.tsx`, `NextActionActions.tsx`, `LeadCreateModal.tsx`, `pipeline.api.ts`
- **Cambios**: NextActionChip usa `getNextActionType` y `formatNextActionDateLabel`; tipo solo contact/meeting; `onSave(next_action_at: string | null, ...)`; botón "Sin fecha" y `allowNoDate`; API updateLead sin throw por null; CreateLeadInput y createLead con next_action_at opcional.
- **Seguro**: Tipos actualizados; modal ya no preseleccionaba fecha; ahora permite omitir.

### Commit 3: Eliminar SituationChip
- **Archivos**: `SituationChip.tsx` (eliminado)
- **Cambios**: Archivo borrado; no había imports.
- **Seguro**: Código muerto.

### Commit 4: next_action_at opcional en DB
- **Archivos**: `supabase/migrations/20260217110000_next_action_at_optional.sql`
- **Cambios**: `drop constraint if exists leads_next_action_when_active`.
- **Seguro**: Migración reversible; aplicar antes de deploy.

### Commit 5: Quitar getProximaLabel de vista
- **Archivos**: `PipelineTableView.tsx`, `PipelineTable.tsx`
- **Cambios**: Eliminada prop `getProximaLabel` y import; tabla ya no la usaba.
- **Seguro**: Sin impacto en UI (LeadRowDesktop usa next_action).
