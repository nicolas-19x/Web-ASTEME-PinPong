-- =============================================================================
-- Datos iniciales REALES de la academia (documento maestro, sección 18).
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

-- Los 12 expedientes iniciales. La categoría se conserva tal como fue indicada.
-- La edad se guarda como "edad informada" con la fecha de registro; Gonzalo queda pendiente.
insert into public.players (first_name, last_names, category_id, age_reported, age_reported_on, status)
select v.first_name, v.last_names, c.id, v.age, case when v.age is null then null else current_date end, 'active'
from (values
  ('Ian',        null,     'Sub-13', 12),
  ('Martín',     null,     'Sub-13', 13),
  ('Fabián',     null,     'Sub-13', 13),
  ('Iván',       null,     'Sub-13', 12),
  ('Isaac',      'Castro', 'Sub-13', 12),
  ('Mateo',      null,     'Sub-11', 10),
  ('Gonzalo',    null,     'Sub-11', null),
  ('Aaroncito',  null,     'Sub-11', 9),
  ('Leandro',    null,     'Sub-11', 9),
  ('José Pablo', null,     'Sub-15', 15),
  ('Juan Pablo', null,     'Sub-15', 15),
  ('Nicolás',    null,     'Sub-19', 16)
) as v(first_name, last_names, category, age)
join public.categories c on c.name = v.category
where not exists (select 1 from public.players p where p.first_name = v.first_name and p.last_names is not distinct from v.last_names);
