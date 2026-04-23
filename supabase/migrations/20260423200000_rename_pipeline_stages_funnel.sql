-- Alinear nombres de etapa con embudo Kinderbrothers (UI en Kanban, hub, etc.).
-- Slugs e ids sin cambios.

update public.pipeline_stages
set name = case slug
  when 'contactos_nuevos' then 'Contactos'
  when 'citas_agendadas' then 'Citas Agendadas'
  when 'casos_abiertos' then 'Casos Abiertos'
  when 'citas_cierre' then 'Citas de Cierre'
  when 'solicitudes_ingresadas' then 'Solicitudes Ingresadas'
  when 'casos_ganados' then 'Pólizas Pagadas'
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
