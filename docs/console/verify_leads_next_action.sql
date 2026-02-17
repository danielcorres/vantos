-- Verificación DB (solo lectura): confirmar que leads tiene next_action_at y next_action_type
-- Ejecutar en Supabase SQL Editor o psql conectado al proyecto.
-- Si las columnas NO existen, aplicar: supabase db push (local) y en staging apuntando a staging.

select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'leads'
  and column_name in ('next_action_at', 'next_action_type')
order by column_name;

-- Resultado esperado:
-- next_action_at   | timestamp with time zone | YES
-- next_action_type | text                    | YES
