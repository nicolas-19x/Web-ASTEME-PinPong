-- =============================================================================
-- Pruebas de seguridad RLS por rol.
-- Se ejecutan dentro de una transacción que termina en ROLLBACK: los datos
-- ficticios de prueba nunca quedan guardados ni se mezclan con los reales.
-- Uso: psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_test.sql
-- =============================================================================
\set QUIET on
\o /dev/null
begin;

create temp table _results (name text, ok boolean, detail text) on commit drop;
grant all on _results to authenticated, anon;

create or replace function pg_temp.check(name text, cond boolean, detail text default null) returns void
language sql as $$ insert into _results values (name, coalesce(cond, false), detail) $$;

-- ---------------------------------------------------------------- fixtures
insert into auth.users (id, email, aud, role, instance_id) values
  ('00000000-0000-0000-0000-0000000000a1', 'prueba-admin@test.local', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000000b1', 'prueba-jugador1@test.local', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000000b2', 'prueba-jugador2@test.local', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000000c1', 'prueba-encargado1@test.local', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000000c2', 'prueba-encargado-inactivo@test.local', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');

insert into public.profiles (id, full_name, role, active) values
  ('00000000-0000-0000-0000-0000000000a1', 'PRUEBA Entrenador', 'admin', true),
  ('00000000-0000-0000-0000-0000000000b1', 'PRUEBA Jugador 1', 'player', true),
  ('00000000-0000-0000-0000-0000000000b2', 'PRUEBA Jugador 2', 'player', true),
  ('00000000-0000-0000-0000-0000000000c1', 'PRUEBA Encargado 1', 'guardian', true),
  ('00000000-0000-0000-0000-0000000000c2', 'PRUEBA Encargado inactivo', 'guardian', false);

insert into public.players (id, first_name, category_id, user_id) values
  ('10000000-0000-0000-0000-000000000001', 'PRUEBA-P1', (select id from categories where name = 'Sub-13'), '00000000-0000-0000-0000-0000000000b1'),
  ('10000000-0000-0000-0000-000000000002', 'PRUEBA-P2', (select id from categories where name = 'Sub-13'), '00000000-0000-0000-0000-0000000000b2'),
  ('10000000-0000-0000-0000-000000000003', 'PRUEBA-P3', (select id from categories where name = 'Sub-15'), null);

insert into public.guardians (id, profile_id, full_name) values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1', 'PRUEBA Encargado 1'),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000c2', 'PRUEBA Encargado inactivo');
insert into public.player_guardians (player_id, guardian_id, authorized) values
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', true),
  ('10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', false), -- vínculo NO autorizado
  ('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', true);

insert into public.private_notes (player_id, body) values ('10000000-0000-0000-0000-000000000001', 'Nota interna secreta');
insert into public.evaluations (id, player_id, conclusion, shared) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'compartida', true),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'privada', false),
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'de otro', true);
insert into public.evaluation_items (evaluation_id, skill_name, score) values
  ('30000000-0000-0000-0000-000000000001', 'Derecha', 7),
  ('30000000-0000-0000-0000-000000000002', 'Revés', 4);
insert into public.development_plans (id, player_id) values ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001');
insert into public.development_goals (plan_id, kind, description, shared) values
  ('40000000-0000-0000-0000-000000000001', 'short_term', 'Objetivo compartido', true),
  ('40000000-0000-0000-0000-000000000001', 'improvement', 'Aspecto no compartido', false);

insert into public.training_groups (id, name) values
  ('50000000-0000-0000-0000-000000000001', 'PRUEBA Grupo A'), ('50000000-0000-0000-0000-000000000002', 'PRUEBA Grupo B');
insert into public.group_memberships (group_id, player_id) values
  ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
  ('50000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002');
insert into public.group_schedules (group_id, weekday, start_time, end_time) values
  ('50000000-0000-0000-0000-000000000001', 1, '16:00', '17:30'), ('50000000-0000-0000-0000-000000000002', 2, '16:00', '17:30');

insert into public.announcements (title, body, scope, to_players, to_guardians, published) values
  ('A-todos', 'x', 'all', true, true, true),
  ('A-solo-encargados', 'x', 'all', false, true, true),
  ('A-borrador', 'x', 'all', true, true, false);
insert into public.announcements (title, body, scope, category_id, to_players, to_guardians, published) values
  ('A-sub15', 'x', 'category', (select id from categories where name = 'Sub-15'), true, true, true);
insert into public.announcements (title, body, scope, group_id, to_players, to_guardians, published) values
  ('A-grupoB', 'x', 'group', '50000000-0000-0000-0000-000000000002', true, true, true);

insert into public.tournaments (id, name, held_on, status) values ('60000000-0000-0000-0000-000000000001', 'PRUEBA Torneo', current_date, 'group_stage');
insert into public.tournament_participants (tournament_id, player_id) values
  ('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
  ('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002'),
  ('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003');
insert into public.tournament_groups (id, tournament_id, idx, name) values ('61000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 0, 'A');
insert into public.matches (id, tournament_id, stage, group_id, key, round, player_a, player_b) values
  ('62000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 'group', '61000000-0000-0000-0000-000000000001', 'G1-R1-M1', 1, '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002'),
  ('62000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000001', 'group', '61000000-0000-0000-0000-000000000001', 'G1-R2-M1', 2, '10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003');

-- Totales reales (como superusuario) para comparar lo que ve el administrador.
create temp table _totals on commit drop as
  select 'players' as t, count(*) as n from public.players
  union all select 'announcements', count(*) from public.announcements;
grant select on _totals to authenticated;

-- ---------------------------------------------------------------- ANON
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
do $$ begin
  perform 1 from public.players;
  perform pg_temp.check('anon no lee jugadores', false, 'leyó players');
exception when insufficient_privilege then
  perform pg_temp.check('anon no lee jugadores', true);
end $$;
select pg_temp.check('anon lee la marca de la academia', (select count(*) = 1 from public.academy_settings));
do $$ begin
  perform public.portal_match_results('10000000-0000-0000-0000-000000000001');
  perform pg_temp.check('anon no ejecuta RPC del portal', false);
exception when insufficient_privilege then
  perform pg_temp.check('anon no ejecuta RPC del portal', true);
end $$;
reset role;

-- ---------------------------------------------------------------- JUGADOR 1
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';
select pg_temp.check('jugador ve solo su expediente', (select array_agg(first_name) = array['PRUEBA-P1'] from public.players));
select pg_temp.check('jugador no ve los 12 expedientes reales', (select count(*) = 0 from public.players where first_name = 'Nicolás'));
select pg_temp.check('jugador no ve notas internas', (select count(*) = 0 from public.private_notes));
select pg_temp.check('jugador ve solo evaluaciones compartidas propias', (select array_agg(conclusion) = array['compartida'] from public.evaluations));
select pg_temp.check('jugador no ve ítems de evaluación privada', (select array_agg(skill_name) = array['Derecha'] from public.evaluation_items));
select pg_temp.check('jugador ve solo objetivos compartidos', (select array_agg(description) = array['Objetivo compartido'] from public.development_goals));
select pg_temp.check('jugador ve solo su grupo y horario', (select count(*) = 1 from public.group_schedules) and (select array_agg(name) = array['PRUEBA Grupo A'] from public.training_groups));
select pg_temp.check('jugador ve comunicados dirigidos a él',
  (select array_agg(title order by title) = array['A-todos'] from public.announcements where title like 'A-%'));
select pg_temp.check('jugador no ve perfiles ajenos', (select count(*) = 1 from public.profiles));
select pg_temp.check('jugador no ve bitácora', (select count(*) = 0 from public.activity_logs));
select pg_temp.check('jugador no ve vínculos familiares', (select count(*) = 0 from public.player_guardians));
select pg_temp.check('jugador ve sus partidos, no los ajenos', (select array_agg(key) = array['G1-R1-M1'] from public.matches));
select pg_temp.check('jugador ve solo su inscripción', (select count(*) = 1 from public.tournament_participants));
with u as (update public.players set first_name = 'hack' where id = '10000000-0000-0000-0000-000000000001' returning 1)
select pg_temp.check('jugador no edita su expediente', (select count(*) = 0 from u));
with u as (update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000b1' returning 1)
select pg_temp.check('jugador no se asciende a admin', (select count(*) = 0 from u));
do $$ begin
  insert into public.announcements (title, body) values ('hack', 'x');
  perform pg_temp.check('jugador no publica comunicados', false);
exception when insufficient_privilege then
  perform pg_temp.check('jugador no publica comunicados', true);
end $$;
do $$ begin
  perform public.save_match_result('62000000-0000-0000-0000-000000000001', '[{"a":11,"b":0},{"a":11,"b":0}]');
  perform pg_temp.check('jugador no registra resultados', false);
exception when insufficient_privilege then
  perform pg_temp.check('jugador no registra resultados', true);
end $$;
do $$ begin
  insert into public.ranking_movements (player_id, new_value, reason) values ('10000000-0000-0000-0000-000000000001', 9999, 'hack');
  perform pg_temp.check('jugador no cambia su ranking', false);
exception when insufficient_privilege then
  perform pg_temp.check('jugador no cambia su ranking', true);
end $$;
select pg_temp.check('RPC portal: resultados propios', (select count(*) = 0 from public.portal_match_results('10000000-0000-0000-0000-000000000001')));
select pg_temp.check('RPC portal: no consulta a un compañero', (select count(*) = 0 from public.portal_match_results('10000000-0000-0000-0000-000000000002')));
insert into public.announcement_reads (announcement_id, profile_id)
  select id, '00000000-0000-0000-0000-0000000000b1' from public.announcements where title = 'A-todos';
select pg_temp.check('jugador marca comunicado como leído', (select count(*) = 1 from public.announcement_reads));
do $$ begin
  insert into public.announcement_reads (announcement_id, profile_id)
    select id, '00000000-0000-0000-0000-0000000000b2' from public.announcements limit 1;
  perform pg_temp.check('jugador no marca lecturas ajenas', (select count(*) = 0 from public.announcement_reads where profile_id <> '00000000-0000-0000-0000-0000000000b1'));
exception when insufficient_privilege then
  perform pg_temp.check('jugador no marca lecturas ajenas', true);
end $$;
reset role;

-- ---------------------------------------------------------------- ENCARGADO 1
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';
select pg_temp.check('encargado ve solo hijos vinculados y autorizados', (select array_agg(first_name) = array['PRUEBA-P1'] from public.players));
select pg_temp.check('encargado no ve vínculo no autorizado', (select count(*) = 0 from public.players where id = '10000000-0000-0000-0000-000000000003'));
select pg_temp.check('encargado ve comunicados para encargados',
  (select array_agg(title order by title) = array['A-solo-encargados', 'A-todos'] from public.announcements where title like 'A-%'));
select pg_temp.check('encargado no ve notas internas', (select count(*) = 0 from public.private_notes));
select pg_temp.check('encargado no ve evaluaciones no compartidas', (select count(*) = 1 from public.evaluations));
with u as (update public.evaluations set shared = true returning 1)
select pg_temp.check('encargado no modifica evaluaciones', (select count(*) = 0 from u));
reset role;

-- ---------------------------------------------------------------- ENCARGADO INACTIVO
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}';
select pg_temp.check('cuenta desactivada no ve expedientes', (select count(*) = 0 from public.players));
reset role;

-- ---------------------------------------------------------------- JUGADOR 2 (grupo B)
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}';
select pg_temp.check('comunicado por grupo llega solo a ese grupo',
  (select array_agg(title order by title) = array['A-grupoB', 'A-todos'] from public.announcements where title like 'A-%'));
reset role;

-- ---------------------------------------------------------------- ADMIN
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select pg_temp.check('admin ve todos los expedientes', (select count(*) = (select n from _totals where t = 'players') from public.players));
select pg_temp.check('admin ve notas internas', (select count(*) = 1 from public.private_notes where player_id = '10000000-0000-0000-0000-000000000001'));
select pg_temp.check('admin ve todos los comunicados', (select count(*) = (select n from _totals where t = 'announcements') from public.announcements));
select public.save_match_result('62000000-0000-0000-0000-000000000001', '[{"a":11,"b":7},{"a":9,"b":11},{"a":12,"b":10}]');
select pg_temp.check('admin registra resultado válido',
  (select status = 'finished' and winner_id = '10000000-0000-0000-0000-000000000001' and sets_a = 2 and sets_b = 1
   from public.matches where id = '62000000-0000-0000-0000-000000000001'));
select pg_temp.check('se guarda historial de auditoría', (select count(*) = 1 from public.match_result_history where match_id = '62000000-0000-0000-0000-000000000001'));
do $$ begin
  perform public.save_match_result('62000000-0000-0000-0000-000000000002', '[{"a":11,"b":10}]');
  perform pg_temp.check('servidor rechaza set inválido 11-10', false);
exception when raise_exception then
  perform pg_temp.check('servidor rechaza set inválido 11-10', true);
end $$;
do $$ begin
  perform public.save_match_result('62000000-0000-0000-0000-000000000002', '[{"a":11,"b":1},{"a":11,"b":1},{"a":11,"b":1}]');
  perform pg_temp.check('servidor rechaza sets sobrantes', false);
exception when raise_exception then
  perform pg_temp.check('servidor rechaza sets sobrantes', true);
end $$;
select public.save_match_result('62000000-0000-0000-0000-000000000001', '[{"a":3,"b":11},{"a":4,"b":11}]', null, 'Corrección de planilla');
select pg_temp.check('corrección de resultado cambia ganador y audita',
  (select winner_id = '10000000-0000-0000-0000-000000000002' from public.matches where id = '62000000-0000-0000-0000-000000000001')
  and (select count(*) = 2 from public.match_result_history where match_id = '62000000-0000-0000-0000-000000000001')
  and (select count(*) = 2 from public.match_sets where match_id = '62000000-0000-0000-0000-000000000001'));
insert into public.ranking_movements (player_id, new_value, reason) values ('10000000-0000-0000-0000-000000000001', 120, 'Ajuste inicial');
insert into public.ranking_movements (player_id, new_value, reason) values ('10000000-0000-0000-0000-000000000001', 135, 'Torneo');
select pg_temp.check('ranking guarda valor anterior y actualiza jugador',
  (select ranking_points = 135 from public.players where id = '10000000-0000-0000-0000-000000000001')
  and (select old_value = 120 from public.ranking_movements where new_value = 135));
update public.players set category_id = (select id from categories where name = 'Sub-15') where id = '10000000-0000-0000-0000-000000000001';
select pg_temp.check('cambio de categoría queda en historial',
  (select count(*) = 1 from public.player_history where player_id = '10000000-0000-0000-0000-000000000001' and kind = 'category' and old_value = 'Sub-13' and new_value = 'Sub-15'));
insert into public.development_plans (player_id) values ('10000000-0000-0000-0000-000000000001');
select pg_temp.check('plan de desarrollo versionado',
  (select array_agg(version || ':' || is_current order by version) = array['1:false', '2:true'] from public.development_plans where player_id = '10000000-0000-0000-0000-000000000001'));
reset role;

-- ---------------------------------------------------------------- JUGADOR 1 tras resultados
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';
select pg_temp.check('RPC portal: partido terminado con nombre de pila del rival',
  (select count(*) = 1 and bool_and(opponent_first_name = 'PRUEBA-P2') and bool_and(not won)
   from public.portal_match_results('10000000-0000-0000-0000-000000000001')));
select pg_temp.check('jugador ve los sets de su partido', (select count(*) = 2 from public.match_sets));
reset role;

-- ---------------------------------------------------------------- Informe
\o
\echo
select case when ok then 'PASA ' else 'FALLA' end as resultado, name, coalesce(detail, '') as detalle from _results order by ok, name;
select count(*) filter (where ok) as pasan, count(*) filter (where not ok) as fallan from _results \gset
\echo 'Resultado:' :pasan 'pasan,' :fallan 'fallan'
do $$ begin
  if exists (select 1 from _results where not ok) then raise exception 'Hay pruebas RLS que fallan'; end if;
end $$;
rollback;
