import { useQuery } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router';
import { Chip, ErrorState, Loading, Panel, PlayerAvatar, Stat } from '@/components/app/common';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AchievementsTab } from '@/pages/admin/players/tabs/AchievementsTab';
import { CompetitiveTab } from '@/pages/admin/players/tabs/CompetitiveTab';
import { ControlsTab } from '@/pages/admin/players/tabs/ControlsTab';
import { EvaluationsTab } from '@/pages/admin/players/tabs/EvaluationsTab';
import { PlanTab } from '@/pages/admin/players/tabs/PlanTab';
import { useAuth } from '@/lib/auth';
import { addDays, fmtDate, fullName, pct, playerAge, todayISO } from '@/lib/format';
import { supabase, unwrap, unwrapMaybe } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import { useUpcoming } from './PortalHome';

export default function PortalPlayer() {
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const { role } = useAuth();
  const { settings } = useTheme();
  const vis = { rankings: true, attendance: true, evaluations: true, achievements: true, records: true, ...((settings?.portal_visibility as Record<string, boolean>) ?? {}) };
  const tab = params.get('tab') ?? 'resumen';
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['portal', 'player', id],
    queryFn: async () => {
      const [p, att] = await Promise.all([
        supabase.from('players').select('id, first_name, last_names, photo_path, photo_authorized, birth_date, age_reported, age_reported_on, ranking_points, status, categories(name), levels(name)').eq('id', id).maybeSingle(),
        supabase.from('attendance').select('status, on_date').eq('player_id', id).gte('on_date', addDays(todayISO(), -90)),
      ]);
      return { player: unwrapMaybe(p), att: unwrap(att) };
    },
  });
  const upcoming = useUpcoming();
  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} retry={() => refetch()} />;
  // RLS devuelve null si el expediente no está vinculado a esta cuenta.
  if (!data?.player) return <p>Este expediente no está disponible para tu cuenta.</p>;
  const p = data.player;
  const present = data.att.filter((a) => a.status === 'present').length;

  return (
    <div>
      {role === 'guardian' && (
        <Link to="/portal" className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4" aria-hidden /> Inicio
        </Link>
      )}
      <header className="table-band-h mb-6 flex flex-col gap-4 rounded-xl p-5 sm:flex-row sm:items-center">
        <PlayerAvatar player={p} size={88} className="bg-white/15 text-[2rem]" />
        <div className="flex-1">
          <h1 className="text-[2.3rem] sm:text-[2.8rem]">{fullName(p)}</h1>
          <p className="text-white/85">
            {p.categories?.name}, {p.levels?.name ?? 'nivel por definir'}, {playerAge(p).label.toLowerCase()}
          </p>
        </div>
        {vis.rankings && p.ranking_points != null && (
          <div className="text-right">
            <p className="numeral text-[3rem] leading-none">{p.ranking_points}</p>
            <p className="text-sm text-white/80">puntos de ranking</p>
          </div>
        )}
      </header>

      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList className="h-auto w-max">
            <TabsTrigger value="resumen" className="min-h-10 px-3">Resumen</TabsTrigger>
            {vis.records && <TabsTrigger value="resultados" className="min-h-10 px-3">Resultados</TabsTrigger>}
            {vis.evaluations && <TabsTrigger value="evaluaciones" className="min-h-10 px-3">Evaluaciones</TabsTrigger>}
            <TabsTrigger value="objetivos" className="min-h-10 px-3">Objetivos</TabsTrigger>
            {vis.achievements && <TabsTrigger value="logros" className="min-h-10 px-3">Logros</TabsTrigger>}
            <TabsTrigger value="controles" className="min-h-10 px-3">Controles</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="resumen" className="mt-5">
          <div className="grid gap-6 lg:grid-cols-2">
            {vis.attendance && (
              <Panel title="Asistencia (últimos 90 días)">
                {data.att.length ? (
                  <div className="flex gap-6">
                    <Stat value={pct(present, data.att.length)} label="de asistencia" />
                    <Stat value={present} label={`presencias de ${data.att.length}`} />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Sin registros.</p>
                )}
              </Panel>
            )}
            <Panel title="Próximos eventos">
              {!upcoming.data?.length ? (
                <p className="text-sm text-muted-foreground">Sin eventos próximos.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {upcoming.data.map((e) => (
                    <li key={e.kind + e.id} className="flex items-center justify-between gap-2">
                      <span>
                        <span className="block font-semibold">{e.title}</span>
                        <span className="text-sm text-muted-foreground">{e.kind}</span>
                      </span>
                      <Chip tone="info">{fmtDate(e.date, { day: 'numeric', month: 'short' })}</Chip>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </TabsContent>
        {vis.records && (
          <TabsContent value="resultados" className="mt-5">
            <CompetitiveTab playerId={p.id} admin={false} />
          </TabsContent>
        )}
        {vis.evaluations && (
          <TabsContent value="evaluaciones" className="mt-5">
            <EvaluationsTab playerId={p.id} admin={false} />
          </TabsContent>
        )}
        <TabsContent value="objetivos" className="mt-5">
          <PlanTab playerId={p.id} admin={false} />
        </TabsContent>
        {vis.achievements && (
          <TabsContent value="logros" className="mt-5">
            <AchievementsTab playerId={p.id} admin={false} />
          </TabsContent>
        )}
        <TabsContent value="controles" className="mt-5">
          <ControlsTab playerId={p.id} admin={false} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
