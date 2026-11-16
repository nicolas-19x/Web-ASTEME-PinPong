import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  CalendarPlus,
  ClipboardList,
  FilePenLine,
  Megaphone,
  Medal,
  Plus,
  Search,
  Swords,
  Trophy,
  UserPlus,
} from 'lucide-react';
import { Link } from 'react-router';
import { Chip, EmptyState, ErrorState, Loading, Panel } from '@/components/app/common';
import { Button } from '@/components/ui/button';
import { addDays, fmtDate, fmtDateTime, fmtLongDate, relativeDays, todayISO } from '@/lib/format';
import { supabase, unwrap } from '@/lib/supabase';

const EVAL_WINDOW_DAYS = 90;

interface UpcomingEvent {
  id: string;
  date: string;
  title: string;
  kind: 'Torneo interno' | 'Competencia' | 'Control interno' | 'Actividad especial' | 'Evento';
  href: string;
  location?: string | null;
}

function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const today = todayISO();
      const [players, categories, tournaments, competitions, events, controls, evals, matches, compResults, activity] = await Promise.all([
        supabase.from('players').select('id, first_name, status, category_id, level_id, birth_date, age_reported, dominant_hand, join_date, ranking_points, levels(name)'),
        supabase.from('categories').select('id, name, sort_order').order('sort_order'),
        supabase.from('tournaments').select('id, name, held_on, location, status').order('held_on', { ascending: false }),
        supabase.from('competitions').select('id, name, start_date, location').gte('start_date', today).order('start_date'),
        supabase.from('sport_events').select('id, title, kind, starts_on, location').gte('starts_on', today).order('starts_on'),
        supabase
          .from('control_results')
          .select('id, measured_on, value, value_text, players(id, first_name), control_tests(name, unit)')
          .order('measured_on', { ascending: false })
          .limit(5),
        supabase.from('evaluations').select('player_id, evaluated_on').gte('evaluated_on', addDays(today, -EVAL_WINDOW_DAYS)),
        supabase
          .from('matches')
          .select('id, tournament_id, updated_at, sets_a, sets_b, winner_id, label, stage, round, a:players!matches_player_a_fkey(first_name), b:players!matches_player_b_fkey(first_name), tournaments(name)')
          .eq('status', 'finished')
          .order('updated_at', { ascending: false })
          .limit(6),
        supabase
          .from('competition_participants')
          .select('id, final_position, medal, players(id, first_name), competitions(id, name, start_date)')
          .not('final_position', 'is', null)
          .limit(30),
        supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(10),
      ]);
      const pl = unwrap(players);
      const tour = unwrap(tournaments);
      const pending = await supabase
        .from('matches')
        .select('tournament_id', { count: 'exact' })
        .neq('status', 'finished')
        .not('player_a', 'is', null)
        .not('player_b', 'is', null);
      const pendingByT = new Map<string, number>();
      for (const m of unwrap(pending)) pendingByT.set(m.tournament_id, (pendingByT.get(m.tournament_id) ?? 0) + 1);

      const active = pl.filter((p) => p.status === 'active');
      const evaluated = new Set(unwrap(evals).map((e) => e.player_id));
      const upcoming: UpcomingEvent[] = [
        ...tour.filter((t) => t.held_on >= today && t.status !== 'finished').map((t) => ({ id: t.id, date: t.held_on, title: t.name, kind: 'Torneo interno' as const, href: `/torneos/${t.id}`, location: t.location })),
        ...unwrap(competitions).map((c) => ({ id: c.id, date: c.start_date, title: c.name, kind: 'Competencia' as const, href: `/competencias/${c.id}`, location: c.location })),
        ...unwrap(events).map((e) => ({
          id: e.id,
          date: e.starts_on,
          title: e.title,
          kind: e.kind === 'control' ? ('Control interno' as const) : e.kind === 'special' ? ('Actividad especial' as const) : ('Evento' as const),
          href: '/calendario',
          location: e.location,
        })),
      ].sort((a, b) => a.date.localeCompare(b.date));

      return {
        today,
        active,
        total: pl.length,
        categories: unwrap(categories),
        upcoming,
        controls: unwrap(controls),
        matches: unwrap(matches),
        compResults: unwrap(compResults)
          .filter((r) => r.competitions)
          .sort((a, b) => (b.competitions!.start_date ?? '').localeCompare(a.competitions!.start_date ?? ''))
          .slice(0, 4),
        activity: unwrap(activity),
        alerts: {
          incomplete: active.filter((p) => !p.birth_date || !p.level_id || !p.dominant_hand || !p.join_date),
          noRanking: active.filter((p) => p.ranking_points == null),
          pendingEval: active.filter((p) => !evaluated.has(p.id)),
          openTournaments: tour.filter((t) => (t.status === 'group_stage' || t.status === 'knockout') && (pendingByT.get(t.id) ?? 0) > 0 && t.held_on <= today),
        },
        tournamentsInPlay: tour.filter((t) => t.status === 'group_stage' || t.status === 'knockout'),
      };
    },
  });
}

const QUICK = [
  { to: '/jugadores?nuevo=1', label: 'Registrar jugador', icon: <UserPlus /> },
  { to: '/jugadores?buscar=1', label: 'Buscar jugador', icon: <Search /> },
  { to: '/torneos', label: 'Registrar resultado', icon: <Swords /> },
  { to: '/calendario?nuevo=control', label: 'Crear control', icon: <CalendarPlus /> },
  { to: '/torneos/nuevo', label: 'Generar torneo', icon: <Trophy /> },
  { to: '/competencias?nueva=1', label: 'Agregar competencia', icon: <Medal /> },
  { to: '/jugadores?evaluar=1', label: 'Evaluar', icon: <FilePenLine /> },
  { to: '/comunicados?nuevo=1', label: 'Publicar comunicado', icon: <Megaphone /> },
];

export default function Dashboard() {
  const { data, isLoading, error, refetch } = useDashboard();
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorState error={error} retry={() => refetch()} />;

  const next = data.upcoming[0];
  const byCategory = data.categories
    .map((c) => {
      const ps = data.active.filter((p) => p.category_id === c.id);
      const levels = new Map<string, number>();
      ps.forEach((p) => {
        const l = p.levels?.name ?? 'Sin nivel';
        levels.set(l, (levels.get(l) ?? 0) + 1);
      });
      return { ...c, count: ps.length, levels: [...levels.entries()] };
    })
    .filter((c) => c.count > 0 || ['Sub-11', 'Sub-13', 'Sub-15', 'Sub-19'].includes(c.name));
  const uncategorized = data.active.filter((p) => !p.category_id).length;
  const maxCount = Math.max(1, ...byCategory.map((c) => c.count));
  const alertRows = [
    { n: data.alerts.incomplete.length, text: 'fichas incompletas', hint: 'Falta fecha de nacimiento, nivel, mano dominante o fecha de ingreso.', to: '/jugadores?filtro=incompletas' },
    { n: data.alerts.noRanking.length, text: 'jugadores sin ranking', hint: 'Se sortean al sembrar torneos hasta que les asignes puntos.', to: '/jugadores?filtro=sin-ranking' },
    { n: data.alerts.pendingEval.length, text: 'evaluaciones pendientes', hint: `Sin evaluación en los últimos ${EVAL_WINDOW_DAYS} días.`, to: '/jugadores?filtro=sin-evaluacion' },
    { n: data.alerts.openTournaments.length, text: 'torneos sin resultados completos', hint: 'Hay partidos sin marcador.', to: '/torneos' },
  ].filter((a) => a.n > 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="text-muted-foreground first-letter:uppercase">{fmtLongDate(data.today)}</p>
        <h1 className="text-[2.2rem] sm:text-[2.6rem]">Panel del entrenador</h1>
      </div>

      {/* Banda principal: plantel activo y próximo evento sobre la mesa */}
      <section className="table-band-h overflow-hidden rounded-xl" aria-label="Resumen">
        <div className="grid gap-6 p-5 sm:grid-cols-[auto_1fr] sm:p-6">
          <div className="flex items-end gap-6 sm:border-r sm:border-white/20 sm:pr-8">
            <div>
              <p className="numeral text-[4.2rem] leading-[0.85]">{data.active.length}</p>
              <p className="mt-1 text-white/80">jugadores activos</p>
            </div>
            {data.total !== data.active.length && (
              <p className="pb-1 text-sm text-white/70">{data.total - data.active.length} inactivos o archivados</p>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm text-white/75">Próximo evento deportivo</p>
            {next ? (
              <Link to={next.href} className="group mt-1 block rounded-md focus-visible:outline-white">
                <p className="condensed truncate text-[1.75rem] font-bold group-hover:underline">{next.title}</p>
                <p className="text-white/85">
                  {next.kind}, {relativeDays(next.date).toLowerCase()}, {fmtDate(next.date, { weekday: 'short', day: 'numeric', month: 'short' })}
                  {next.location ? ` en ${next.location}` : ''}
                </p>
              </Link>
            ) : (
              <p className="mt-1 text-white/85">No hay eventos programados. Crea un torneo, una competencia o un control.</p>
            )}
            {data.tournamentsInPlay.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {data.tournamentsInPlay.map((t) => (
                  <Button key={t.id} asChild size="sm" className="bg-white text-ink hover:bg-white/90">
                    <Link to={`/torneos/${t.id}`}>
                      <span className="size-2 rounded-full bg-ball" aria-hidden /> En juego: {t.name}
                    </Link>
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Accesos rápidos */}
      <nav aria-label="Accesos rápidos" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap">
        {QUICK.map((q, i) => (
          <Button key={q.to} asChild variant={i === 0 ? 'default' : 'outline'} className="shrink-0">
            <Link to={q.to}>
              {q.icon}
              {q.label}
            </Link>
          </Button>
        ))}
      </nav>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <Panel title="Jugadores por categoría" action={<Link to="/jugadores" className="text-sm font-semibold underline-offset-4 hover:underline">Ver listado</Link>}>
            {data.active.length === 0 ? (
              <EmptyState title="Aún no hay jugadores activos" action={<Button asChild><Link to="/jugadores?nuevo=1"><Plus /> Registrar jugador</Link></Button>} />
            ) : (
              <ul className="flex flex-col gap-1">
                {byCategory.map((c) => (
                  <li key={c.id}>
                    <Link
                      to={`/jugadores?categoria=${c.id}`}
                      className="grid min-h-12 grid-cols-[5.5rem_1fr_auto] items-center gap-3 rounded-lg px-2 hover:bg-accent"
                    >
                      <span className="condensed text-[1.1rem] font-bold">{c.name}</span>
                      <span className="flex flex-col gap-1">
                        <span className="h-2.5 rounded-full bg-muted" aria-hidden>
                          <span className="block h-full rounded-full bg-table" style={{ width: `${(c.count / maxCount) * 100}%` }} />
                        </span>
                        {c.levels.length > 0 && (
                          <span className="text-xs text-muted-foreground">{c.levels.map(([l, n]) => `${l}: ${n}`).join(', ')}</span>
                        )}
                      </span>
                      <span className="numeral w-8 text-right text-[1.5rem]">{c.count}</span>
                    </Link>
                  </li>
                ))}
                {uncategorized > 0 && <li className="px-2 pt-1 text-sm text-muted-foreground">{uncategorized} sin categoría asignada</li>}
              </ul>
            )}
          </Panel>

          <Panel title="Próximos eventos" action={<Link to="/calendario" className="text-sm font-semibold underline-offset-4 hover:underline">Calendario</Link>}>
            {data.upcoming.length === 0 ? (
              <EmptyState title="Sin eventos próximos">Los torneos, competencias y controles programados aparecerán aquí.</EmptyState>
            ) : (
              <ol className="flex flex-col divide-y">
                {data.upcoming.slice(0, 6).map((e) => (
                  <li key={`${e.kind}-${e.id}`}>
                    <Link to={e.href} className="flex min-h-14 items-center gap-4 py-2 hover:bg-accent/60">
                      <span className="flex w-12 shrink-0 flex-col items-center rounded-md bg-muted py-1">
                        <span className="numeral text-[1.4rem] leading-none">{fmtDate(e.date, { day: 'numeric' })}</span>
                        <span className="text-xs text-muted-foreground">{fmtDate(e.date, { month: 'short' }).replace('.', '')}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{e.title}</span>
                        <span className="text-sm text-muted-foreground">
                          {e.kind}
                          {e.location ? `, ${e.location}` : ''}
                        </span>
                      </span>
                      <Chip tone={e.kind === 'Competencia' ? 'ball' : 'info'}>{relativeDays(e.date)}</Chip>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </Panel>

          <Panel title="Últimos resultados">
            {data.matches.length === 0 && data.compResults.length === 0 ? (
              <EmptyState title="Todavía no hay resultados">Registra marcadores en un torneo o resultados de una competencia externa.</EmptyState>
            ) : (
              <ul className="flex flex-col divide-y">
                {data.matches.map((m) => {
                  const aWon = m.winner_id && m.sets_a > m.sets_b;
                  return (
                    <li key={m.id}>
                      <Link to={`/torneos/${m.tournament_id}`} className="flex min-h-12 items-center gap-3 py-2 hover:bg-accent/60">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">
                            <span className={aWon ? 'font-bold' : ''}>{m.a?.first_name}</span> vs <span className={!aWon ? 'font-bold' : ''}>{m.b?.first_name}</span>
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {m.tournaments?.name}
                            {m.label ? `, ${m.label}` : ''}
                          </span>
                        </span>
                        <span className="numeral text-[1.35rem]">
                          {m.sets_a}–{m.sets_b}
                        </span>
                      </Link>
                    </li>
                  );
                })}
                {data.compResults.map((r) => (
                  <li key={r.id}>
                    <Link to={`/competencias/${r.competitions!.id}`} className="flex min-h-12 items-center gap-3 py-2 hover:bg-accent/60">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{r.players?.first_name}</span>
                        <span className="text-sm text-muted-foreground">{r.competitions!.name}</span>
                      </span>
                      <span className="numeral text-[1.35rem]">{r.final_position}.º</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="flex flex-col gap-6">
          <Panel title="Alertas">
            {alertRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin alertas. Las fichas, rankings, evaluaciones y torneos están al día.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {alertRows.map((a) => (
                  <li key={a.text}>
                    <Link to={a.to} className="flex gap-3 rounded-lg border border-warning/30 bg-warning/6 p-3 hover:bg-warning/12">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                      <span>
                        <span className="font-semibold">
                          {a.n} {a.text}
                        </span>
                        <span className="block text-sm text-muted-foreground">{a.hint}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Últimos controles">
            {data.controls.length === 0 ? (
              <EmptyState icon={<ClipboardList />} title="Sin controles registrados">
                Registra pruebas internas desde la ficha de cada jugador.
              </EmptyState>
            ) : (
              <ul className="flex flex-col divide-y">
                {data.controls.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 py-2">
                    <Link to={`/jugadores/${c.players?.id}?tab=controles`} className="min-w-0 hover:underline">
                      <span className="block truncate font-medium">{c.players?.first_name}</span>
                      <span className="text-sm text-muted-foreground">
                        {c.control_tests?.name}, {fmtDate(c.measured_on, { day: 'numeric', month: 'short' })}
                      </span>
                    </Link>
                    <span className="numeral text-[1.2rem]">
                      {c.value ?? c.value_text} {c.control_tests?.unit}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Actividad reciente">
            {data.activity.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aquí aparecerán altas, resultados, evaluaciones, planes y comunicados.</p>
            ) : (
              <ol className="flex flex-col gap-3">
                {data.activity.map((a) => (
                  <li key={a.id} className="flex gap-3">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-table" aria-hidden />
                    <span>
                      <span className="block text-[0.95rem]">{a.summary}</span>
                      <span className="text-xs text-muted-foreground">{fmtDateTime(a.created_at)}</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
