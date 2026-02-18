-- Renombrar solo la columna name de pipeline_stages (slugs e ids sin cambios).
-- Nombres deseados para la UI, sin emojis en DB.

update public.pipeline_stages
set name = case slug
  when 'contactos_nuevos' then 'Pendiente de cita'
  when 'citas_agendadas' then 'Cita agendada'
  when 'casos_abiertos' then 'Primera cita'
  when 'citas_cierre' then 'Cita de cierre'
  when 'solicitudes_ingresadas' then 'En trámite'
  when 'casos_ganados' then 'Póliza activa'
  else name
end
where slug in (
  'contactos_nuevos',
  'citas_agendadas',
  'casos_abiertos',
  'citas_cierre',
  'solicitudes_ingresadas',
  'casos_ganados'
);

-- Verificación (opcional; descomentar para ejecutar a mano):
-- select id, slug, name, position from public.pipeline_stages order by position;
