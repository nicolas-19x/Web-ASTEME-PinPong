import { useQuery } from '@tanstack/react-query';
import { Link, Navigate } from 'react-router';
import { Chip, EmptyState, ErrorState, Loading, Panel, PlayerAvatar } from '@/components/app/common';
import { useAuth } from '@/lib/auth';
import { fmtDate, fullName, playerAge, relativeDays, todayISO } from '@/lib/format';
import { supabase, unwrap } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';

export function useMyPlayers() {
  return useQuery({
    queryKey: ['portal', 'players'],
    queryFn: async () => unwrap(await supabase.from('players').select('id, first_name, last_names, photo_path, photo_authorized, birth_date, age_reported, age_reported_on, status, categories(name), levels(name)').order('first_name')),
  });
}

export function useUpcoming() {
  return useQuery({
    queryKey: ['portal', 'upcoming'],
    queryFn: async () => {
      const today = todayISO();
      const [t, c, e] = await Promise.all([
        supabase.from('tournaments').select('id, name, held_on, location').gte('held_on', today).neq('status', 'finished').order('held_on').limit(5),
        supabase.from('competitions').select('id, name, start_date, location').gte('start_date', today).order('start_date').limit(5),
        supabase.from('sport_events').select('id, title, starts_on, location, kind').gte('starts_on', today).order('starts_on').limit(5),
      ]);
      return [
        ...unwrap(t).map((x) => ({ id: x.id, date: x.held_on, title: x.name, kind: 'Torneo interno', location: x.location })),
        ...unwrap(c).map((x) => ({ id: x.id, date: x.start_date, title: x.name, kind: 'Competencia', location: x.location })),
        ...unwrap(e).map((x) => ({ id: x.id, date: x.starts_on, title: x.title, kind: x.kind === 'control' ? 'Control interno' : x.kind === 'special' ? 'Actividad especial' : 'Evento', location: x.location })),
      ]
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 5);
    },
  });
}

export default function PortalHome() {
  const { role, profile } = useAuth();
  const { settings } = useTheme();
  const { data: players, isLoading, error, refetch } = useMyPlayers();
  const upcoming = useUpcoming();
  const ann = useQuery({
    queryKey: ['portal', 'announcements', 'latest'],
    queryFn: async () => unwrap(await supabase.from('announcements').select('id, title, published_at, kind').order('published_at', { ascending: false }).limit(3)),
  });

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} retry={() => refetch()} />;
  if (role === 'player' && players?.length === 1) return <Navigate to={`/portal/jugador/${players[0].id}`} replace />;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-muted-foreground">{settings?.name}</p>
        <h1 className="text-[2.2rem]">Hola, {profile?.full_name.split(' ')[0]}</h1>
      </div>
      {!players?.length ? (
        <EmptyState title="Todavía no hay expedientes vinculados a tu cuenta">El entrenador debe vincular y autorizar a tus hijos o jugadores a cargo.</EmptyState>
      ) : (
        <section aria-label="Jugadores vinculados">
          <h2 className="mb-3 text-[1.4rem]">{role === 'guardian' ? 'Tus jugadores' : 'Tu expediente'}</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {players.map((p) => (
              <li key={p.id}>
                <Link to={`/portal/jugador/${p.id}`} className="flex items-center gap-4 rounded-xl border bg-card p-4 hover:border-table/50">
                  <PlayerAvatar player={p} size={60} />
                  <span>
                    <span className="condensed block text-[1.4rem] font-bold" data-player-name>{fullName(p)}</span>
                    <span className="text-sm text-muted-foreground">
                      {p.categories?.name}, {playerAge(p).label.toLowerCase()}
                    </span>
                    {p.levels && (
                      <span className="mt-1 block">
                        <Chip tone="info">{p.levels.name}</Chip>
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Próximos eventos" action={<Link to="/portal/calendario" className="text-sm font-semibold hover:underline">Calendario</Link>}>
          {!upcoming.data?.length ? (
            <p className="text-sm text-muted-foreground">Sin eventos próximos.</p>
          ) : (
            <ul className="flex flex-col divide-y">
              {upcoming.data.map((e) => (
                <li key={e.kind + e.id} className="flex items-center gap-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{e.title}</span>
                    <span className="text-sm text-muted-foreground">
                      {e.kind}, {fmtDate(e.date, { weekday: 'short', day: 'numeric', month: 'short' })}
                      {e.location ? `, ${e.location}` : ''}
                    </span>
                  </span>
                  <Chip tone="info">{relativeDays(e.date)}</Chip>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Comunicados" action={<Link to="/portal/comunicados" className="text-sm font-semibold hover:underline">Ver todos</Link>}>
          {!ann.data?.length ? (
            <p className="text-sm text-muted-foreground">Sin comunicados.</p>
          ) : (
            <ul className="flex flex-col divide-y">
              {ann.data.map((a) => (
                <li key={a.id} className="py-2">
                  <Link to="/portal/comunicados" className="font-semibold hover:underline">
                    {a.title}
                  </Link>
                  <span className="block text-sm text-muted-foreground">{fmtDate(a.published_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
