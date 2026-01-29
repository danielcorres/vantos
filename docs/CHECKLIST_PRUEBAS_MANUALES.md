# Checklist de pruebas manuales — Pipeline ↔ Calendario ↔ Productividad

Flujo de creación de lead, weeklyMode, conectividad Productividad ↔ Pipeline y LeadDetail orientado a citas.

---

## FASE 1 — Crear lead (LeadCreateModal)

- [ ] **Crear lead rápido:** Nombre obligatorio, Fuente por defecto "Referido", Nota opcional, Etapa seleccionable.
- [ ] **Sin next_follow_up_at:** El formulario no pide ni envía "próximo seguimiento".
- [ ] **Lead en contactos_nuevos:** Tras crear, el lead aparece en etapa "Contactos Nuevos" (independiente de la etapa elegida en el modal).

---

## FASE 2 — Mini-modal "¿Agendar primera cita?"

- [ ] **Tras crear lead (Kanban):** Se abre el mini-modal "¿Agendar primera cita?" (o "¿Agendar cita de cierre?" si elegiste Citas de cierre).
- [ ] **Tras crear lead (Tabla):** Mismo mini-modal al crear desde la vista Tabla.
- [ ] **Copy por intent:** intent=citas_agendadas: texto "Para que cuente en 'Citas agendadas', agenda la cita. ¿La agendamos ahora?"; intent=citas_cierre: "Para que cuente en 'Citas de cierre', agenda la cita de cierre. ¿La agendamos ahora?". Siempre botón "Ahora no".
- [ ] **Agendar:** Al pulsar "Agendar" se abre el formulario de cita con lead prellenado, tipo fijado (primera cita o cierre) y hora por defecto now+1h redondeada.
- [ ] **Ahora no:** Al pulsar "Ahora no" se cierra el mini-modal, se muestra toast discreto "Listo. Lead creado en Contactos nuevos." y el lead sigue en Contactos Nuevos.
- [ ] **Guardar cita mueve etapa:** Al guardar la cita, el lead pasa a la etapa correspondiente (Citas agendadas o Citas de cierre) vía calendarApi.

---

## FASE 3 — WeeklyMode (stage + weekStart)

- [ ] **URL completa** (`/pipeline?stage=citas_agendadas&weekStart=YYYY-MM-DD`): Banner "Entradas de la semana · &lt;rango&gt;", selector de etapa, "Mostrando: N", botón "Quitar". Tabla y Kanban muestran solo leads que entraron a esa etapa en esa semana.
- [ ] **Solo weekStart** (`/pipeline?weekStart=YYYY-MM-DD` sin `stage`): Banner "Semana seleccionada · Elige una etapa para ver entradas" y dropdown "— Elige etapa —". No se filtran leads hasta elegir etapa.
- [ ] **Quitar:** Al pulsar "Quitar" se eliminan `stage` y `weekStart` de la URL y se vuelve al pipeline normal (todos los leads).
- [ ] **Empty state:** Si no hay entradas en la semana/etapa, se muestra "No hubo entradas a esta etapa en la semana seleccionada." (Kanban y Tabla).

---

## FASE 4 — "Mostrando N" y totales Kanban

- [ ] **Vista Kanban:** "Mostrando: N" coincide con el número de cards visibles (filtro semanal).
- [ ] **Vista Tabla:** "Mostrando: N" coincide con las filas visibles tras filtros (semana + búsqueda + fuente). Cambiar búsqueda o fuente actualiza N.
- [ ] **Totales por columna (Kanban):** En weeklyMode, cada columna muestra Total / Vencidos / Por vencer solo sobre los leads filtrados por semana (no totales globales).
- [ ] **Carga weeklyMode:** Mientras cargan los lead_ids de la semana, el Kanban no muestra totales globales (columnas vacías o cargando hasta que llega el RPC).

---

## FASE 4b — Conectividad weeklyMode (Pipeline ↔ Productividad)

- [ ] **Banner semanal Pipeline:** Con weeklyMode activo, el banner tiene botón secundario "Ver Productividad" que navega a `/productividad?weekStart=<weekStartYmd>`.
- [ ] **Copiar link:** Botón pequeño "Copiar link" en el mismo banner copia la URL actual del pipeline al portapapeles; feedback "Link copiado" (toast).
- [ ] **Productividad → Pipeline:** Desde ProductividadPage, al hacer clic en "Pipeline" (o icono) de una etapa se navega a `/pipeline?stage=<slug>&weekStart=<weekStartYmd>` con el weekStart actual de Productividad.
- [ ] **Productividad sin weekStart:** Si entras a `/productividad` sin `weekStart`, se usa el lunes de la semana actual y la URL se actualiza con `weekStart`.

---

## FASE 5 — LeadDetail orientado a citas

- [ ] **Card Citas arriba:** En la columna derecha, la card "Citas" (LeadAppointmentsList) aparece arriba de "Hechos del proceso" y "Pipeline"; layout limpio en móvil.
- [ ] **CTA "Agendar primera cita":** En detalle de lead, si no hay citas próximas programadas, se muestra el botón primario "Agendar primera cita".
- [ ] **CTA "Agendar cita de cierre":** Si la etapa actual es "Citas de cierre" y no hay cita de cierre programada, se muestra "Agendar cita de cierre".
- [ ] **Hint "Próxima cita …":** En la card de Pipeline del detalle, si existe una próxima cita programada (calendario), se muestra "Próxima cita: &lt;fecha/hora&gt; · &lt;tipo&gt;" (no se usa next_follow_up_at para este hint).
- [ ] **Flujo sin next_follow_up_at:** La creación de lead y la decisión de agendar/no agendar no dependen de next_follow_up_at; solo calendario para citas.
- [ ] **Spacing/jerarquía:** Columna derecha se ve más ligera (menos cargada) en móvil y 13"; títulos y márgenes coherentes.

---

## Revisión visual

- [ ] **Móvil:** Mini-modal en formato sheet (abajo); banners y selectores legibles; CTAs y tabla usables; sin overflow; "Ver Productividad" y "Copiar link" accesibles.
- [ ] **13" (desktop):** Modales centrados; banner weeklyMode en una línea o wrap claro; Kanban con columnas visibles.

---

## FASE 6 — Performance (code-splitting)

- [ ] **Lazy loading:** CalendarPage, ProductivityPage, PipelinePage y LeadDetailPage cargan bajo demanda (Suspense + fallback skeleton).
- [ ] **Insights:** La pestaña Insights del Pipeline carga PipelineInsightsPage bajo demanda (skeleton "Cargando insights…").
- [ ] **Rutas protegidas:** RoleGuard sigue funcionando con rutas lazy (acceso según rol).
- [ ] **Build:** `npm run build` termina sin errores; warning de chunks >500kb resuelto o mejorado (vendor-react, vendor-router, vendor-supabase separados).

---

## Build

- [ ] `npm run build` termina sin errores.
