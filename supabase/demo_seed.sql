-- =============================================================================
-- DATOS DE DEMOSTRACIÓN: configuración inicial + jugadores FICTICIOS.
-- Úsalo para probar la versión en línea sin subir datos de menores reales.
-- Para la versión definitiva usa supabase/seed.sql (los 12 jugadores reales).
-- Solo los datos proporcionados: no se inventan apellidos, fechas de nacimiento,
-- fotos, ranking, evaluaciones ni resultados. No se crean cuentas para menores.
-- Los datos simulados de prueba NO van aquí (ver tests/ y scripts/).
-- =============================================================================

insert into public.academy_settings (id, name, short_name, theme)
values (true, 'Academia de Tenis de Mesa', 'ATM',
  '{"primary":"#0C1B33","secondary":"#1B4F8C","accent":"#FF6B1A","accent2":"#B4E33D","mode":"system","font":"archivo"}'::jsonb)
on conflict (id) do nothing;

insert into public.categories (name, sort_order) values
  ('Sub-11', 1), ('Sub-13', 2), ('Sub-15', 3), ('Sub-19', 4), ('Adultos', 5)
on conflict (name) do nothing;

insert into public.levels (name, sort_order) values
  ('Recreativo', 1), ('Formativo', 2), ('Competitivo', 3)
on conflict (name) do nothing;

-- Habilidades sugeridas en el documento (configurables por el entrenador).
insert into public.skills (name, sort_order) values
  ('Derecha', 1), ('Revés', 2), ('Servicio', 3), ('Recepción', 4), ('Topspin', 5), ('Bloqueo', 6),
  ('Desplazamiento', 7), ('Consistencia', 8), ('Control', 9), ('Táctica', 10), ('Preparación física', 11)
on conflict (name) do nothing;

-- Jugadores ficticios con ranking, para probar torneos.
insert into public.players (first_name, last_names, category_id, age_reported, age_reported_on, ranking_points, status)
select 'Demo ' || lpad(i::text, 2, '0'), 'Ficticio',
       (select id from public.categories where name = case when i % 2 = 0 then 'Sub-13' else 'Sub-15' end),
       11 + (i % 5), current_date,
       case when i % 5 = 0 then null else 1000 - (i / 2) * 50 end,
       'active'
from generate_series(1, 12) as i
where not exists (select 1 from public.players where first_name like 'Demo %');
