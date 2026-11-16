-- =============================================================================
-- Academia de Tenis de Mesa · Esquema inicial
-- Seguridad: RLS en TODAS las tablas de `public`. Las funciones auxiliares de
-- autorización viven en el esquema `private`, que no se expone en la Data API.
-- Desde 2026 las tablas nuevas no se exponen automáticamente: los GRANT son
-- explícitos al final del archivo.
-- =============================================================================

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- -----------------------------------------------------------------------------
-- Utilidades
-- -----------------------------------------------------------------------------
create or replace function private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- -----------------------------------------------------------------------------
-- Configuración de la academia (fila única)
-- -----------------------------------------------------------------------------
create table public.academy_settings (
  id boolean primary key default true check (id),
  name text not null default 'Academia de Tenis de Mesa',
  short_name text,
  logo_path text,
  banner_path text,
  theme jsonb not null default '{}'::jsonb,
  timezone text not null default 'America/Costa_Rica',
  locale text not null default 'es-CR',
  default_rules jsonb not null default '{"pointsPerSet":11,"minLead":2,"bestOf":3}'::jsonb,
  default_tiebreakers text[] not null default array['wins','head_to_head','set_diff','point_diff','manual'],
  portal_visibility jsonb not null default
    '{"rankings":true,"attendance":true,"evaluations":true,"achievements":true,"records":true}'::jsonb,
  updated_at timestamptz not null default now()
);
create trigger academy_settings_touch before update on public.academy_settings
  for each row execute function private.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Cuentas y roles
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('admin', 'player', 'guardian')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_role_idx on public.profiles (role);
create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Catálogos editables
-- -----------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.levels (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0
);

create table public.skills (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0,
  active boolean not null default true
);

create table public.control_tests (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  unit text,
  higher_is_better boolean not null default true,
  active boolean not null default true
);

-- -----------------------------------------------------------------------------
-- Jugadores y encargados
-- -----------------------------------------------------------------------------
create table public.players (
  id uuid primary key default gen_random_uuid(),
  first_name text not null check (length(trim(first_name)) > 0),
  last_names text,
  photo_path text,
  photo_authorized boolean not null default false,
  birth_date date,
  -- Edad informada cuando no se conoce la fecha de nacimiento (nunca se inventa).
  age_reported smallint check (age_reported between 3 and 99),
  age_reported_on date,
  category_id uuid references public.categories (id) on delete restrict,
  level_id uuid references public.levels (id) on delete set null,
  dominant_hand text check (dominant_hand in ('right', 'left', 'ambidextrous')),
  join_date date,
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  -- Puntos de ranking interno: vacíos hasta que el entrenador los asigne.
  ranking_points numeric(8, 2),
  user_id uuid unique references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index players_category_idx on public.players (category_id);
create index players_level_idx on public.players (level_id);
create index players_status_idx on public.players (status);
create trigger players_touch before update on public.players
  for each row execute function private.touch_updated_at();

create table public.guardians (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles (id) on delete set null,
  full_name text not null,
  phone text,
  email text,
  notes text,
  created_at timestamptz not null default now()
);

create table public.player_guardians (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  guardian_id uuid not null references public.guardians (id) on delete cascade,
  relationship text,
  authorized boolean not null default true,
  created_at timestamptz not null default now(),
  unique (player_id, guardian_id)
);
create index player_guardians_guardian_idx on public.player_guardians (guardian_id);

-- Notas internas del entrenador: SOLO administradores. Se separan en su propia
-- tabla para que nunca viajen junto a filas que el jugador o su familia pueden leer.
create table public.private_notes (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  entity_type text not null default 'player'
    check (entity_type in ('player', 'evaluation', 'plan', 'tournament', 'competition')),
  entity_id uuid,
  body text not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index private_notes_player_idx on public.private_notes (player_id);
create index private_notes_entity_idx on public.private_notes (entity_type, entity_id);

create table public.player_history (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  kind text not null check (kind in ('category', 'level', 'status', 'group', 'milestone', 'created')),
  old_value text,
  new_value text,
  note text,
  changed_by uuid references public.profiles (id) on delete set null,
  changed_at timestamptz not null default now()
);
create index player_history_player_idx on public.player_history (player_id, changed_at desc);

create table public.ranking_movements (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  old_value numeric(8, 2),
  new_value numeric(8, 2),
  reason text not null check (length(trim(reason)) > 0),
  tournament_id uuid,
  changed_by uuid references public.profiles (id) on delete set null,
  changed_at timestamptz not null default now()
);
create index ranking_movements_player_idx on public.ranking_movements (player_id, changed_at desc);

-- -----------------------------------------------------------------------------
-- Grupos de entrenamiento, horarios y asistencia
-- -----------------------------------------------------------------------------
create table public.training_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category_id uuid references public.categories (id) on delete set null,
  level_id uuid references public.levels (id) on delete set null,
  coach_id uuid references public.profiles (id) on delete set null,
  location text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index training_groups_category_idx on public.training_groups (category_id);

create table public.group_memberships (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.training_groups (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  start_date date not null default current_date,
  end_date date,
  check (end_date is null or end_date >= start_date)
);
create unique index group_memberships_active_uq on public.group_memberships (group_id, player_id) where end_date is null;
create index group_memberships_player_idx on public.group_memberships (player_id);

create table public.group_schedules (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.training_groups (id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7), -- ISO: 1 = lunes
  start_time time not null,
  end_time time not null,
  location text,
  check (end_time > start_time)
);
create index group_schedules_group_idx on public.group_schedules (group_id);

create table public.schedule_exceptions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.training_groups (id) on delete cascade,
  on_date date not null,
  kind text not null check (kind in ('cancelled', 'changed')),
  start_time time,
  end_time time,
  location text,
  note text,
  created_at timestamptz not null default now(),
  check (kind = 'cancelled' or (start_time is not null and end_time is not null and end_time > start_time))
);
create index schedule_exceptions_group_idx on public.schedule_exceptions (group_id, on_date);

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.training_groups (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  on_date date not null,
  status text not null check (status in ('present', 'absent', 'excused')),
  note text,
  recorded_by uuid references public.profiles (id) on delete set null,
  recorded_at timestamptz not null default now(),
  unique (group_id, player_id, on_date)
);
create index attendance_player_idx on public.attendance (player_id, on_date desc);
create index attendance_date_idx on public.attendance (on_date);

-- -----------------------------------------------------------------------------
-- Evaluaciones, controles y planes de desarrollo
-- -----------------------------------------------------------------------------
create table public.evaluations (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  evaluated_on date not null default current_date,
  evaluator_id uuid references public.profiles (id) on delete set null,
  evaluator_name text,
  conclusion text,
  shared boolean not null default false,
  created_at timestamptz not null default now()
);
create index evaluations_player_idx on public.evaluations (player_id, evaluated_on desc);

create table public.evaluation_items (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.evaluations (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  skill_id uuid references public.skills (id) on delete set null,
  skill_name text not null,
  score numeric(3, 1) check (score between 0 and 10),
  comment text,
  check (score is not null or nullif(trim(comment), '') is not null)
);
create index evaluation_items_eval_idx on public.evaluation_items (evaluation_id);
create index evaluation_items_player_idx on public.evaluation_items (player_id, skill_id);

create table public.control_results (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  test_id uuid not null references public.control_tests (id) on delete restrict,
  measured_on date not null default current_date,
  value numeric(10, 2),
  value_text text,
  notes text,
  shared boolean not null default true,
  created_at timestamptz not null default now(),
  check (value is not null or nullif(trim(value_text), '') is not null)
);
create index control_results_player_idx on public.control_results (player_id, measured_on desc);
create index control_results_test_idx on public.control_results (test_id);

create table public.development_plans (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  version int not null,
  review_date date,
  is_current boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (player_id, version)
);
create unique index development_plans_current_uq on public.development_plans (player_id) where is_current;

-- Cada objetivo/fortaleza/aspecto se comparte (o no) de forma individual.
create table public.development_goals (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.development_plans (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  kind text not null check (kind in ('short_term', 'medium_term', 'strength', 'improvement', 'competitive_goal')),
  description text not null check (length(trim(description)) > 0),
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'achieved', 'dropped')),
  shared boolean not null default false,
  sort_order int not null default 0
);
create index development_goals_plan_idx on public.development_goals (plan_id);
create index development_goals_player_idx on public.development_goals (player_id);

-- -----------------------------------------------------------------------------
-- Logros
-- -----------------------------------------------------------------------------
create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  icon text,
  kind text not null default 'other' check (kind in ('medal', 'championship', 'streak', 'distinction', 'other'))
);

create table public.player_achievements (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  achievement_id uuid references public.achievements (id) on delete set null,
  kind text not null default 'other' check (kind in ('medal', 'championship', 'streak', 'distinction', 'other')),
  title text not null,
  description text,
  awarded_on date not null default current_date,
  medal text check (medal in ('gold', 'silver', 'bronze')),
  source_type text not null default 'manual' check (source_type in ('tournament', 'competition', 'manual')),
  source_id uuid,
  shared boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  -- Evita duplicados al integrar resultados de un mismo torneo o competencia.
  unique nulls not distinct (player_id, source_type, source_id, kind, title)
);
create index player_achievements_player_idx on public.player_achievements (player_id, awarded_on desc);

-- -----------------------------------------------------------------------------
-- Calendario deportivo y competencias externas
-- -----------------------------------------------------------------------------
create table public.sport_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  kind text not null default 'other' check (kind in ('control', 'special', 'other')),
  starts_on date not null,
  start_time time,
  location text,
  notes text,
  visible_in_portals boolean not null default true,
  created_at timestamptz not null default now()
);
create index sport_events_date_idx on public.sport_events (starts_on);

create table public.competitions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  start_date date not null,
  end_date date,
  location text,
  organizer text,
  scope text not null default 'national' check (scope in ('national', 'regional', 'international', 'other')),
  categories text,
  notes text,
  created_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);
create index competitions_date_idx on public.competitions (start_date);

create table public.competition_participants (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  called_up boolean not null default true,
  registered boolean not null default false,
  category_label text,
  final_position int check (final_position > 0),
  matches_won int check (matches_won >= 0),
  matches_lost int check (matches_lost >= 0),
  sets_won int check (sets_won >= 0),
  sets_lost int check (sets_lost >= 0),
  medal text check (medal in ('gold', 'silver', 'bronze')),
  recognition text,
  notes text,
  unique (competition_id, player_id)
);
create index competition_participants_player_idx on public.competition_participants (player_id);

create table public.competition_photos (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions (id) on delete cascade,
  storage_path text not null unique,
  caption text,
  authorized boolean not null default false,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index competition_photos_competition_idx on public.competition_photos (competition_id);

-- -----------------------------------------------------------------------------
-- Torneos internos
-- -----------------------------------------------------------------------------
create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  held_on date not null,
  location text,
  category_ids uuid[] not null default '{}',
  modality text not null default 'individual',
  format text not null default 'groups_knockout' check (format in ('groups_knockout', 'round_robin')),
  notes text,
  status text not null default 'draft' check (status in ('draft', 'group_stage', 'knockout', 'finished')),
  rules jsonb not null default '{"pointsPerSet":11,"minLead":2,"bestOf":3}'::jsonb,
  knockout_rules jsonb,
  tiebreakers text[] not null default array['wins','head_to_head','set_diff','point_diff','manual'],
  group_count int not null default 1 check (group_count >= 1),
  advance_per_group int not null default 0 check (advance_per_group >= 0),
  tables_available int not null default 1 check (tables_available >= 1),
  third_place boolean not null default true,
  tie_mode text not null default 'random' check (tie_mode in ('random', 'manual')),
  draw_seed bigint,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  finalized_at timestamptz
);
create index tournaments_date_idx on public.tournaments (held_on desc);

create table public.tournament_participants (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete restrict,
  ranking_at_entry numeric(8, 2),
  seed_position int,
  final_position int check (final_position > 0),
  matches_won int not null default 0,
  matches_lost int not null default 0,
  sets_won int not null default 0,
  sets_lost int not null default 0,
  medal text check (medal in ('gold', 'silver', 'bronze')),
  unique (tournament_id, player_id)
);
create index tournament_participants_player_idx on public.tournament_participants (player_id);

create table public.tournament_groups (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  idx int not null,
  name text not null,
  manual_order uuid[],
  manual_order_note text,
  unique (tournament_id, idx)
);

create table public.tournament_group_players (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  group_id uuid not null references public.tournament_groups (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete restrict,
  seed_in_group int not null,
  unique (tournament_id, player_id)
);
create index tournament_group_players_group_idx on public.tournament_group_players (group_id);
create index tournament_group_players_player_idx on public.tournament_group_players (player_id);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  stage text not null check (stage in ('group', 'knockout')),
  group_id uuid references public.tournament_groups (id) on delete cascade,
  key text not null,
  round int not null,
  position int,
  slot int,
  table_no int,
  label text,
  player_a uuid references public.players (id) on delete restrict,
  player_b uuid references public.players (id) on delete restrict,
  a_source jsonb,
  b_source jsonb,
  is_third_place boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'finished')),
  walkover boolean not null default false,
  winner_id uuid references public.players (id) on delete restrict,
  sets_a int not null default 0,
  sets_b int not null default 0,
  points_a int not null default 0,
  points_b int not null default 0,
  updated_at timestamptz not null default now(),
  unique (tournament_id, key),
  check (player_a is null or player_b is null or player_a <> player_b),
  check (winner_id is null or winner_id = player_a or winner_id = player_b),
  check (stage = 'knockout' or (group_id is not null and player_a is not null and player_b is not null))
);
create index matches_tournament_idx on public.matches (tournament_id, stage, round);
create index matches_player_a_idx on public.matches (player_a);
create index matches_player_b_idx on public.matches (player_b);
create index matches_group_idx on public.matches (group_id);

create table public.match_sets (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  set_no smallint not null check (set_no >= 1),
  points_a int not null check (points_a >= 0),
  points_b int not null check (points_b >= 0),
  unique (match_id, set_no)
);

create table public.match_result_history (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  changed_by uuid references public.profiles (id) on delete set null,
  changed_at timestamptz not null default now(),
  previous jsonb,
  new jsonb,
  reason text
);
create index match_result_history_match_idx on public.match_result_history (match_id, changed_at desc);

create table public.tournament_standings (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  group_id uuid not null references public.tournament_groups (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete restrict,
  position int not null,
  played int not null default 0,
  won int not null default 0,
  lost int not null default 0,
  sets_for int not null default 0,
  sets_against int not null default 0,
  points_for int not null default 0,
  points_against int not null default 0,
  classification_points int not null default 0,
  decided_by text,
  unique (group_id, player_id)
);
create index tournament_standings_player_idx on public.tournament_standings (player_id);
create index tournament_standings_tournament_idx on public.tournament_standings (tournament_id);

create table public.tournament_bracket (
  tournament_id uuid primary key references public.tournaments (id) on delete cascade,
  size int not null,
  same_group_conflicts int not null default 0,
  generated_at timestamptz not null default now()
);

alter table public.ranking_movements
  add constraint ranking_movements_tournament_fk foreign key (tournament_id) references public.tournaments (id) on delete set null;
create index ranking_movements_tournament_idx on public.ranking_movements (tournament_id);

-- -----------------------------------------------------------------------------
-- Comunicados
-- -----------------------------------------------------------------------------
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  body text not null,
  kind text not null default 'general'
    check (kind in ('general', 'schedule_change', 'call_up', 'result', 'reminder')),
  scope text not null default 'all' check (scope in ('all', 'category', 'group')),
  category_id uuid references public.categories (id) on delete cascade,
  group_id uuid references public.training_groups (id) on delete cascade,
  to_players boolean not null default true,
  to_guardians boolean not null default true,
  published boolean not null default false,
  published_at timestamptz,
  author_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (to_players or to_guardians),
  check (
    (scope = 'all' and category_id is null and group_id is null) or
    (scope = 'category' and category_id is not null and group_id is null) or
    (scope = 'group' and group_id is not null and category_id is null)
  )
);
create index announcements_published_idx on public.announcements (published, published_at desc);
create index announcements_category_idx on public.announcements (category_id);
create index announcements_group_idx on public.announcements (group_id);

create table public.announcement_reads (
  announcement_id uuid not null references public.announcements (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (announcement_id, profile_id)
);
create index announcement_reads_profile_idx on public.announcement_reads (profile_id);

-- -----------------------------------------------------------------------------
-- Auditoría
-- -----------------------------------------------------------------------------
create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity text not null,
  entity_id uuid,
  summary text not null,
  created_at timestamptz not null default now()
);
create index activity_logs_created_idx on public.activity_logs (created_at desc);

-- =============================================================================
-- Funciones de autorización (esquema privado, SECURITY DEFINER con auth.uid())
-- Necesitan SECURITY DEFINER para consultar profiles/vínculos sin recursión de
-- RLS. Siempre filtran por auth.uid(); no aceptan un usuario como parámetro.
-- =============================================================================
create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin' and p.active
  );
$$;

create or replace function private.my_role()
returns text language sql stable security definer set search_path = '' as $$
  select p.role from public.profiles p where p.id = (select auth.uid()) and p.active;
$$;

-- Jugadores que la cuenta actual puede ver: su propio expediente (rol jugador)
-- o los hijos vinculados y autorizados (rol encargado).
create or replace function private.viewable_player_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select pl.id from public.players pl
  join public.profiles p on p.id = pl.user_id
  where pl.user_id = (select auth.uid()) and p.active and p.role = 'player'
  union
  select pg.player_id from public.player_guardians pg
  join public.guardians g on g.id = pg.guardian_id
  join public.profiles p on p.id = g.profile_id
  where g.profile_id = (select auth.uid()) and pg.authorized and p.active and p.role = 'guardian';
$$;

create or replace function private.my_group_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select gm.group_id from public.group_memberships gm
  where gm.end_date is null and gm.player_id in (select private.viewable_player_ids());
$$;

create or replace function private.my_category_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select pl.category_id from public.players pl
  where pl.category_id is not null and pl.id in (select private.viewable_player_ids());
$$;

create or replace function private.my_tournament_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select tp.tournament_id from public.tournament_participants tp
  where tp.player_id in (select private.viewable_player_ids());
$$;

revoke all on all functions in schema private from public, anon;
grant execute on function
  private.is_admin(), private.my_role(), private.viewable_player_ids(),
  private.my_group_ids(), private.my_category_ids(), private.my_tournament_ids()
to authenticated;

-- =============================================================================
-- Triggers de negocio
-- =============================================================================

-- Historial automático de cambios de categoría, nivel y estado.
create or replace function private.log_player_changes()
returns trigger language plpgsql set search_path = '' as $$
declare
  old_name text;
  new_name text;
begin
  if tg_op = 'INSERT' then
    insert into public.player_history (player_id, kind, new_value, changed_by)
    values (new.id, 'created', 'Alta del expediente', (select auth.uid()));
    return new;
  end if;
  if new.category_id is distinct from old.category_id then
    select name into old_name from public.categories where id = old.category_id;
    select name into new_name from public.categories where id = new.category_id;
    insert into public.player_history (player_id, kind, old_value, new_value, changed_by)
    values (new.id, 'category', old_name, new_name, (select auth.uid()));
  end if;
  if new.level_id is distinct from old.level_id then
    select name into old_name from public.levels where id = old.level_id;
    select name into new_name from public.levels where id = new.level_id;
    insert into public.player_history (player_id, kind, old_value, new_value, changed_by)
    values (new.id, 'level', old_name, new_name, (select auth.uid()));
  end if;
  if new.status is distinct from old.status then
    insert into public.player_history (player_id, kind, old_value, new_value, changed_by)
    values (new.id, 'status', old.status, new.status, (select auth.uid()));
  end if;
  return new;
end $$;
create trigger players_history after insert or update on public.players
  for each row execute function private.log_player_changes();

-- Cambio de grupo de entrenamiento en el historial.
create or replace function private.log_membership_changes()
returns trigger language plpgsql set search_path = '' as $$
declare gname text;
begin
  select name into gname from public.training_groups where id = new.group_id;
  if tg_op = 'INSERT' then
    insert into public.player_history (player_id, kind, new_value, changed_by)
    values (new.player_id, 'group', 'Ingresa a ' || gname, (select auth.uid()));
  elsif new.end_date is not null and old.end_date is null then
    insert into public.player_history (player_id, kind, old_value, changed_by)
    values (new.player_id, 'group', 'Sale de ' || gname, (select auth.uid()));
  end if;
  return new;
end $$;
create trigger group_memberships_history after insert or update on public.group_memberships
  for each row execute function private.log_membership_changes();

-- Movimiento de ranking: se registra valor anterior y se actualiza el jugador.
create or replace function private.apply_ranking_movement()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (select auth.uid()) is not null and not (select private.is_admin()) then
    raise exception 'Solo el entrenador puede modificar el ranking' using errcode = '42501';
  end if;
  select ranking_points into new.old_value from public.players where id = new.player_id for update;
  if not found then
    raise exception 'Jugador no encontrado';
  end if;
  new.changed_by := coalesce(new.changed_by, (select auth.uid()));
  update public.players set ranking_points = new.new_value where id = new.player_id;
  return new;
end $$;
create trigger ranking_movements_apply before insert on public.ranking_movements
  for each row execute function private.apply_ranking_movement();

-- Versionado de planes: nueva versión = máx + 1 y la anterior deja de ser actual.
create or replace function private.version_development_plan()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (select auth.uid()) is not null and not (select private.is_admin()) then
    raise exception 'Solo el entrenador puede crear planes' using errcode = '42501';
  end if;
  perform 1 from public.players where id = new.player_id for update;
  select coalesce(max(version), 0) + 1 into new.version from public.development_plans where player_id = new.player_id;
  update public.development_plans set is_current = false where player_id = new.player_id and is_current;
  new.is_current := true;
  new.created_by := coalesce(new.created_by, (select auth.uid()));
  return new;
end $$;
create trigger development_plans_version before insert on public.development_plans
  for each row execute function private.version_development_plan();

-- Coherencia: evaluation_items.player_id y development_goals.player_id deben coincidir con su padre.
create or replace function private.sync_child_player_id()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_table_name = 'evaluation_items' then
    select player_id into new.player_id from public.evaluations where id = new.evaluation_id;
  elsif tg_table_name = 'development_goals' then
    select player_id into new.player_id from public.development_plans where id = new.plan_id;
  end if;
  return new;
end $$;
create trigger evaluation_items_player before insert or update on public.evaluation_items
  for each row execute function private.sync_child_player_id();
create trigger development_goals_player before insert or update on public.development_goals
  for each row execute function private.sync_child_player_id();

-- Fecha de publicación de comunicados.
create or replace function private.stamp_announcement()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.published and (tg_op = 'INSERT' or not old.published) then
    new.published_at := coalesce(new.published_at, now());
  end if;
  if not new.published then
    new.published_at := null;
  end if;
  new.author_id := coalesce(new.author_id, (select auth.uid()));
  return new;
end $$;
create trigger announcements_stamp before insert or update on public.announcements
  for each row execute function private.stamp_announcement();

-- Bitácora de actividad (alimenta la "Actividad reciente" del panel).
create or replace function private.log_activity()
returns trigger language plpgsql set search_path = '' as $$
declare
  s text;
  pname text;
begin
  if tg_table_name = 'players' then
    s := 'Alta de jugador: ' || new.first_name || coalesce(' ' || new.last_names, '');
  elsif tg_table_name = 'evaluations' then
    select first_name into pname from public.players where id = new.player_id;
    s := 'Evaluación guardada: ' || coalesce(pname, '');
  elsif tg_table_name = 'development_plans' then
    select first_name into pname from public.players where id = new.player_id;
    s := 'Plan de desarrollo actualizado: ' || coalesce(pname, '') || ' (v' || new.version || ')';
  elsif tg_table_name = 'announcements' then
    if not new.published or (tg_op = 'UPDATE' and old.published) then
      return new;
    end if;
    s := 'Comunicado publicado: ' || new.title;
  elsif tg_table_name = 'competition_participants' then
    if new.final_position is null or (tg_op = 'UPDATE' and old.final_position is not distinct from new.final_position) then
      return new;
    end if;
    select first_name into pname from public.players where id = new.player_id;
    s := 'Resultado de competencia: ' || coalesce(pname, '') || ' · posición ' || new.final_position;
  elsif tg_table_name = 'tournaments' then
    if tg_op = 'INSERT' then
      s := 'Torneo creado: ' || new.name;
    elsif new.status = 'finished' and old.status <> 'finished' then
      s := 'Torneo finalizado: ' || new.name;
    else
      return new;
    end if;
  else
    s := tg_table_name;
  end if;
  insert into public.activity_logs (actor_id, action, entity, entity_id, summary)
  values ((select auth.uid()), lower(tg_op), tg_table_name, new.id, s);
  return new;
end $$;
create trigger players_activity after insert on public.players for each row execute function private.log_activity();
create trigger evaluations_activity after insert on public.evaluations for each row execute function private.log_activity();
create trigger plans_activity after insert on public.development_plans for each row execute function private.log_activity();
create trigger announcements_activity after insert or update on public.announcements for each row execute function private.log_activity();
create trigger competition_results_activity after insert or update on public.competition_participants for each row execute function private.log_activity();
create trigger tournaments_activity after insert or update on public.tournaments for each row execute function private.log_activity();

-- =============================================================================
-- RPC: registrar resultado con validación en servidor (SECURITY INVOKER: RLS aplica)
-- =============================================================================
create or replace function public.save_match_result(
  p_match_id uuid,
  p_sets jsonb,
  p_walkover_winner uuid default null,
  p_reason text default null
) returns public.matches
language plpgsql security invoker set search_path = '' as $$
declare
  m public.matches;
  t public.tournaments;
  r jsonb;
  pts int; lead int; best int; need int;
  sa int := 0; sb int := 0; pa int := 0; pb int := 0;
  s jsonb; i int := 0; a int; b int; hi int; lo int;
  w uuid; st text; prev jsonb;
begin
  if not (select private.is_admin()) then
    raise exception 'Solo el entrenador puede registrar resultados' using errcode = '42501';
  end if;
  select * into m from public.matches where id = p_match_id for update;
  if not found then raise exception 'Partido no encontrado'; end if;
  if m.player_a is null or m.player_b is null then
    raise exception 'El partido todavía no tiene definidos a ambos jugadores';
  end if;
  select * into t from public.tournaments where id = m.tournament_id;
  if t.status in ('draft', 'finished') then
    raise exception 'El torneo no está en juego (estado: %)', t.status;
  end if;
  r := case when m.stage = 'knockout' then coalesce(t.knockout_rules, t.rules) else t.rules end;
  pts := (r ->> 'pointsPerSet')::int; lead := (r ->> 'minLead')::int; best := (r ->> 'bestOf')::int;
  need := best / 2 + 1;

  prev := jsonb_build_object(
    'status', m.status, 'winner_id', m.winner_id, 'walkover', m.walkover,
    'sets', (select coalesce(jsonb_agg(jsonb_build_object('a', ms.points_a, 'b', ms.points_b) order by ms.set_no), '[]'::jsonb)
             from public.match_sets ms where ms.match_id = m.id));

  delete from public.match_sets where match_id = m.id;

  if p_walkover_winner is not null then
    if p_walkover_winner <> m.player_a and p_walkover_winner <> m.player_b then
      raise exception 'El ganador por W.O. debe ser uno de los jugadores del partido';
    end if;
    w := p_walkover_winner;
    st := 'finished';
  else
    if p_sets is null or jsonb_typeof(p_sets) <> 'array' then
      raise exception 'Formato de sets no válido';
    end if;
    if jsonb_array_length(p_sets) > best then
      raise exception 'Máximo % sets en este partido', best;
    end if;
    for s in select value from jsonb_array_elements(p_sets) loop
      i := i + 1;
      if w is not null then
        raise exception 'El set % sobra: el partido ya estaba decidido', i;
      end if;
      a := (s ->> 'a')::int; b := (s ->> 'b')::int;
      if a is null or b is null or a < 0 or b < 0 then
        raise exception 'Set %: puntos no válidos', i;
      end if;
      hi := greatest(a, b); lo := least(a, b);
      if hi < pts or hi - lo < lead or (hi > pts and hi - lo <> lead) then
        raise exception 'Set %: marcador no válido (%-%). Sets a % con diferencia de %', i, a, b, pts, lead;
      end if;
      pa := pa + a; pb := pb + b;
      if a > b then sa := sa + 1; else sb := sb + 1; end if;
      if sa = need then w := m.player_a; elsif sb = need then w := m.player_b; end if;
      insert into public.match_sets (match_id, set_no, points_a, points_b) values (m.id, i, a, b);
    end loop;
    st := case when w is not null then 'finished' when i > 0 then 'in_progress' else 'pending' end;
  end if;

  update public.matches
     set status = st, winner_id = w, walkover = (p_walkover_winner is not null),
         sets_a = sa, sets_b = sb, points_a = pa, points_b = pb, updated_at = now()
   where id = m.id
  returning * into m;

  insert into public.match_result_history (match_id, changed_by, previous, new, reason)
  values (m.id, (select auth.uid()), prev,
          jsonb_build_object('status', st, 'winner_id', w, 'walkover', p_walkover_winner is not null, 'sets', coalesce(p_sets, '[]'::jsonb)),
          p_reason);
  return m;
end $$;

-- =============================================================================
-- RPC: cerrar torneo e integrarlo en los expedientes (sin duplicados)
-- p_positions: [{ "player_id": uuid, "final_position": int, "medal": "gold"|"silver"|"bronze"|null }]
-- =============================================================================
create or replace function public.finalize_tournament(p_tournament_id uuid, p_positions jsonb)
returns void
language plpgsql security invoker set search_path = '' as $$
declare
  t public.tournaments;
  e jsonb;
  pid uuid;
  v_medal text;
  pos int;
begin
  if not (select private.is_admin()) then
    raise exception 'Solo el entrenador puede cerrar torneos' using errcode = '42501';
  end if;
  select * into t from public.tournaments where id = p_tournament_id for update;
  if not found then raise exception 'Torneo no encontrado'; end if;
  if exists (select 1 from public.matches where tournament_id = t.id and status <> 'finished'
             and player_a is not null and player_b is not null) then
    raise exception 'Hay partidos sin resultado. Complétalos antes de cerrar el torneo';
  end if;

  -- Estadísticas recalculadas desde los partidos (idempotente).
  update public.tournament_participants tp set
    matches_won = coalesce(x.won, 0), matches_lost = coalesce(x.lost, 0),
    sets_won = coalesce(x.sw, 0), sets_lost = coalesce(x.sl, 0)
  from (
    select p.player_id,
      count(*) filter (where m.winner_id = p.player_id) as won,
      count(*) filter (where m.winner_id is not null and m.winner_id <> p.player_id) as lost,
      sum(case when m.player_a = p.player_id then m.sets_a else m.sets_b end) as sw,
      sum(case when m.player_a = p.player_id then m.sets_b else m.sets_a end) as sl
    from public.tournament_participants p
    join public.matches m on m.tournament_id = p.tournament_id and (m.player_a = p.player_id or m.player_b = p.player_id)
    where p.tournament_id = t.id and m.status = 'finished'
    group by p.player_id
  ) x
  where tp.tournament_id = t.id and tp.player_id = x.player_id;

  for e in select value from jsonb_array_elements(coalesce(p_positions, '[]'::jsonb)) loop
    pid := (e ->> 'player_id')::uuid;
    pos := (e ->> 'final_position')::int;
    v_medal := nullif(e ->> 'medal', '');
    update public.tournament_participants set final_position = pos, medal = v_medal
     where tournament_id = t.id and player_id = pid;
    if not found then
      raise exception 'El jugador % no participa en este torneo', pid;
    end if;
    if v_medal is not null then
      insert into public.player_achievements (player_id, kind, title, awarded_on, medal, source_type, source_id)
      values (pid, case when pos = 1 then 'championship' else 'medal' end,
              case v_medal when 'gold' then 'Campeón' when 'silver' then 'Subcampeón' else 'Tercer lugar' end || ' · ' || t.name,
              t.held_on, v_medal, 'tournament', t.id)
      on conflict (player_id, source_type, source_id, kind, title) do nothing;
    end if;
  end loop;

  update public.tournaments set status = 'finished', finalized_at = coalesce(finalized_at, now()) where id = t.id;
end $$;

-- =============================================================================
-- RPC de lectura para portales: resultados propios con el nombre del rival.
-- SECURITY DEFINER a propósito: un jugador no puede leer el expediente de sus
-- compañeros, pero sí ver contra quién jugó. Solo devuelve partidos de los
-- jugadores que la cuenta puede ver y únicamente el nombre de pila del rival.
-- =============================================================================
create or replace function public.portal_match_results(p_player_id uuid)
returns table (
  match_id uuid, tournament_id uuid, tournament_name text, held_on date, stage text, label text,
  round int, opponent_first_name text, won boolean, sets_for int, sets_against int, walkover boolean
)
language sql stable security definer set search_path = '' as $$
  select m.id, t.id, t.name, t.held_on, m.stage, m.label, m.round,
         op.first_name,
         m.winner_id = p_player_id,
         case when m.player_a = p_player_id then m.sets_a else m.sets_b end,
         case when m.player_a = p_player_id then m.sets_b else m.sets_a end,
         m.walkover
  from public.matches m
  join public.tournaments t on t.id = m.tournament_id
  join public.players op on op.id = case when m.player_a = p_player_id then m.player_b else m.player_a end
  where (m.player_a = p_player_id or m.player_b = p_player_id)
    and m.status = 'finished'
    and (p_player_id in (select private.viewable_player_ids()) or (select private.is_admin()))
  order by t.held_on desc, m.stage desc, m.round desc;
$$;
revoke all on function public.portal_match_results(uuid) from public, anon;
grant execute on function public.portal_match_results(uuid) to authenticated;
revoke all on function public.save_match_result(uuid, jsonb, uuid, text) from public, anon;
grant execute on function public.save_match_result(uuid, jsonb, uuid, text) to authenticated;
revoke all on function public.finalize_tournament(uuid, jsonb) from public, anon;
grant execute on function public.finalize_tournament(uuid, jsonb) to authenticated;

-- =============================================================================
-- RLS
-- =============================================================================
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;


-- Configuración: visible para todos (marca en la pantalla de acceso). Sin datos personales.
create policy academy_settings_read on public.academy_settings for select to anon, authenticated using (true);

-- Perfiles: cada quien ve el suyo.
create policy profiles_self_read on public.profiles for select to authenticated
  using ((select private.is_admin()) or (id = (select auth.uid())));

-- Catálogos no personales.
create policy categories_read on public.categories for select to authenticated using ((select private.is_admin()) or (true));
create policy levels_read on public.levels for select to authenticated using ((select private.is_admin()) or (true));
create policy skills_read on public.skills for select to authenticated using ((select private.is_admin()) or (true));
create policy control_tests_read on public.control_tests for select to authenticated using ((select private.is_admin()) or (true));
create policy achievements_read on public.achievements for select to authenticated using ((select private.is_admin()) or (true));

-- Expedientes: solo el propio o los hijos vinculados.
create policy players_viewer_read on public.players for select to authenticated
  using ((select private.is_admin()) or (id in (select private.viewable_player_ids())));

create policy guardians_self_read on public.guardians for select to authenticated
  using ((select private.is_admin()) or (profile_id = (select auth.uid())));
create policy player_guardians_self_read on public.player_guardians for select to authenticated
  using ((select private.is_admin()) or (guardian_id in (select g.id from public.guardians g where g.profile_id = (select auth.uid()))));

create policy player_history_viewer_read on public.player_history for select to authenticated
  using ((select private.is_admin()) or (player_id in (select private.viewable_player_ids())));

-- Grupos y horarios: solo los grupos donde entrenan los jugadores vinculados.
create policy training_groups_viewer_read on public.training_groups for select to authenticated
  using ((select private.is_admin()) or (id in (select private.my_group_ids())));
create policy group_memberships_viewer_read on public.group_memberships for select to authenticated
  using ((select private.is_admin()) or (player_id in (select private.viewable_player_ids())));
create policy group_schedules_viewer_read on public.group_schedules for select to authenticated
  using ((select private.is_admin()) or (group_id in (select private.my_group_ids())));
create policy schedule_exceptions_viewer_read on public.schedule_exceptions for select to authenticated
  using ((select private.is_admin()) or (group_id in (select private.my_group_ids())));

create policy attendance_viewer_read on public.attendance for select to authenticated
  using ((select private.is_admin()) or (player_id in (select private.viewable_player_ids())));

-- Evaluaciones y controles: solo lo compartido.
create policy evaluations_viewer_read on public.evaluations for select to authenticated
  using ((select private.is_admin()) or (shared and player_id in (select private.viewable_player_ids())));
create policy evaluation_items_viewer_read on public.evaluation_items for select to authenticated
  using ((select private.is_admin()) or (
    player_id in (select private.viewable_player_ids())
    and evaluation_id in (select e.id from public.evaluations e where e.shared)
  ));
create policy control_results_viewer_read on public.control_results for select to authenticated
  using ((select private.is_admin()) or (shared and player_id in (select private.viewable_player_ids())));
create policy development_plans_viewer_read on public.development_plans for select to authenticated
  using ((select private.is_admin()) or (player_id in (select private.viewable_player_ids())));
create policy development_goals_viewer_read on public.development_goals for select to authenticated
  using ((select private.is_admin()) or (shared and player_id in (select private.viewable_player_ids())));

create policy player_achievements_viewer_read on public.player_achievements for select to authenticated
  using ((select private.is_admin()) or (shared and player_id in (select private.viewable_player_ids())));

-- Calendario deportivo (eventos sin datos personales).
create policy sport_events_read on public.sport_events for select to authenticated using ((select private.is_admin()) or (visible_in_portals));
create policy competitions_read on public.competitions for select to authenticated using ((select private.is_admin()) or (true));
create policy tournaments_read on public.tournaments for select to authenticated using ((select private.is_admin()) or (true));

create policy competition_participants_viewer_read on public.competition_participants for select to authenticated
  using ((select private.is_admin()) or (player_id in (select private.viewable_player_ids())));
create policy competition_photos_read on public.competition_photos for select to authenticated
  using ((select private.is_admin()) or (authorized));

create policy tournament_participants_viewer_read on public.tournament_participants for select to authenticated
  using ((select private.is_admin()) or (player_id in (select private.viewable_player_ids())));
create policy tournament_standings_viewer_read on public.tournament_standings for select to authenticated
  using ((select private.is_admin()) or (player_id in (select private.viewable_player_ids())));
create policy matches_viewer_read on public.matches for select to authenticated
  using ((select private.is_admin()) or (player_a in (select private.viewable_player_ids()) or player_b in (select private.viewable_player_ids())));
create policy match_sets_viewer_read on public.match_sets for select to authenticated
  using ((select private.is_admin()) or (match_id in (
    select m.id from public.matches m
    where m.player_a in (select private.viewable_player_ids()) or m.player_b in (select private.viewable_player_ids())
  )));

-- Comunicados: publicados, dirigidos a mi rol y a mi academia/categoría/grupo.
create policy announcements_viewer_read on public.announcements for select to authenticated
  using ((select private.is_admin()) or (
    published
    and (
      (to_players and (select private.my_role()) = 'player')
      or (to_guardians and (select private.my_role()) = 'guardian')
    )
    and (
      scope = 'all'
      or (scope = 'category' and category_id in (select private.my_category_ids()))
      or (scope = 'group' and group_id in (select private.my_group_ids()))
    )
  ));
create policy announcement_reads_self on public.announcement_reads for select to authenticated
  using ((select private.is_admin()) or (profile_id = (select auth.uid())));
create policy announcement_reads_insert_self on public.announcement_reads for insert to authenticated
  with check ((select private.is_admin()) or (
    profile_id = (select auth.uid())
    and announcement_id in (select a.id from public.announcements a) -- RLS de announcements aplica aquí
  ));


-- Administración para el entrenador: una política por acción y tabla, solo donde
-- no exista ya una política combinada (evita políticas permisivas duplicadas).
do $$
declare
  t text;
  v_cmd text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    foreach v_cmd in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE'] loop
      if not exists (
        select 1 from pg_policies p
        where p.schemaname = 'public' and p.tablename = t and p.cmd in (v_cmd, 'ALL')
          and 'authenticated' = any (p.roles)
      ) then
        if v_cmd = 'INSERT' then
          execute format('create policy %I on public.%I for insert to authenticated with check ((select private.is_admin()))', t || '_admin_insert', t);
        elsif v_cmd = 'UPDATE' then
          execute format('create policy %I on public.%I for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))', t || '_admin_update', t);
        else
          execute format('create policy %I on public.%I for %s to authenticated using ((select private.is_admin()))', t || '_admin_' || lower(v_cmd), t, lower(v_cmd));
        end if;
      end if;
    end loop;
  end loop;
end $$;

-- =============================================================================
-- GRANTS explícitos (la Data API ya no expone tablas nuevas automáticamente)
-- =============================================================================
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.academy_settings to anon;
-- Las tablas de auditoría no se editan desde el cliente.
revoke update, delete on public.match_result_history, public.activity_logs, public.ranking_movements from authenticated;

-- =============================================================================
-- Storage: buckets privados para fotos de jugadores y galería; público solo marca
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('player-photos', 'player-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('competition-photos', 'competition-photos', false, 8388608, array['image/jpeg', 'image/png', 'image/webp']),
  ('branding', 'branding', true, 2097152, array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'])
on conflict (id) do nothing;

-- Escritura (INSERT + SELECT + UPDATE + DELETE para permitir upsert) solo administradores.
create policy storage_admin_all on storage.objects for all to authenticated
  using (bucket_id in ('player-photos', 'competition-photos', 'branding') and (select private.is_admin()))
  with check (bucket_id in ('player-photos', 'competition-photos', 'branding') and (select private.is_admin()));

-- Fotos de jugador: ruta "<player_id>/<archivo>", solo si la foto está autorizada.
create policy storage_player_photos_viewer on storage.objects for select to authenticated
  using (
    bucket_id = 'player-photos'
    and (storage.foldername(name))[1] in (
      select p.id::text from public.players p
      where p.photo_authorized and p.id in (select private.viewable_player_ids())
    )
  );

-- Galería: solo fotos marcadas como autorizadas.
create policy storage_competition_photos_viewer on storage.objects for select to authenticated
  using (
    bucket_id = 'competition-photos'
    and name in (select cp.storage_path from public.competition_photos cp where cp.authorized)
  );
