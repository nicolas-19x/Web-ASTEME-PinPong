import { useQuery } from '@tanstack/react-query';
import { Award, Star } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { EmptyState, ErrorState, Loading, MedalDot, PageHeader, Panel } from '@/components/app/common';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { addDays, fmtDate, fullName, todayISO } from '@/lib/format';
import { usePlayers } from '@/lib/queries';
import { supabase, unwrap } from '@/lib/supabase';
import { AchievementDialog, AchievementIcon } from './players/tabs/AchievementsTab';

export function useAcademyStats() {
  return useQuery({
    queryKey: ['academy-stats'],
    queryFn: async () => {
      const since = addDays(todayISO(), -180);
      const [tp, matches, att, items, ach, cats, comp] = await Promise.all([
        supabase.from('tournament_participants').select('player_id, final_position, medal, tournaments(id, name, held_on, category_ids, status)').not('final_position', 'is', null),
        supabase.from('matches').select('player_a, player_b, winner_id, walkover, round, stage, tournaments(held_on)').eq('status', 'finished').not('player_b', 'is', null),
        supabase.from('attendance').select('player_id, status').gte('on_date', since),
        supabase.from('evaluation_items').select('player_id, score, evaluations(evaluated_on)').not('score', 'is', null),
        supabase.from('player_achievements').select('*').order('awarded_on', { ascending: false }),
        supabase.from('categories').select('id, name'),
        supabase.from('competition_participants').select('player_id, medal, final_position, competitions(name, start_date)').not('medal', 'is', null),
      ]);
      return {
        tp: unwrap(tp),
        matches: unwrap(matches),
        att: unwrap(att),
        items: unwrap(items),
        ach: unwrap(ach),
        cats: unwrap(cats),
        comp: unwrap(comp),
      };
    },
  });
}

export default function Statistics() {
  const { data, isLoading, error, refetch } = useAcademyStats();
  const { data: players = [] } = usePlayers();
  const [pick, setPick] = useState(false);
  const [award, setAward] = useState<string[] | null>(null);
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorState error={error} retry={() => refetch()} />;
  const name = (id: string) => {
    const p = players.find((x) => x.id === id);
    return p ? fullName(p) : '—';
  };
  const catName = new Map(data.cats.map((c) => [c.id, c.name]));

  // Campeones históricos por categoría (torneos internos cerrados).
  const champions = data.tp
    .filter((r) => r.final_position === 1 && r.tournaments)
    .map((r) => ({ id: r.player_id, t: r.tournaments!, cats: r.tournaments!.category_ids.map((c) => catName.get(c)).filter(Boolean).join(', ') || 'Abierto' }))
    .sort((a, b) => b.t.held_on.localeCompare(a.t.held_on));
  const byCat = new Map<string, typeof champions>();
  champions.forEach((c) => byCat.set(c.cats, [...(byCat.get(c.cats) ?? []), c]));

  // Podios.
  const podiums = new Map<string, { t: { id: string; name: string; held_on: string }; rows: { id: string; pos: number; medal: string | null }[] }>();
  data.tp
    .filter((r) => r.tournaments && r.final_position! <= 3)
    .forEach((r) => {
      const e = podiums.get(r.tournaments!.id) ?? { t: r.tournaments!, rows: [] };
      e.rows.push({ id: r.player_id, pos: r.final_position!, medal: r.medal });
      podiums.set(r.tournaments!.id, e);
    });

  // Rachas de victorias en partidos internos (orden por fecha y ronda).
  const ordered = [...data.matches].sort((a, b) => (a.tournaments?.held_on ?? '').localeCompare(b.tournaments?.held_on ?? '') || (a.stage === b.stage ? a.round - b.round : a.stage === 'group' ? -1 : 1));
  const streak = new Map<string, { cur: number; best: number }>();
  const played = new Map<string, number>();
  ordered.forEach((m) => {
    for (const p of [m.player_a!, m.player_b!]) {
      played.set(p, (played.get(p) ?? 0) + 1);
      const s = streak.get(p) ?? { cur: 0, best: 0 };
      if (m.winner_id === p) {
        s.cur++;
        s.best = Math.max(s.best, s.cur);
      } else s.cur = 0;
      streak.set(p, s);
    }
  });
  const streaks = [...streak.entries()].filter(([, s]) => s.best >= 2).sort((a, b) => b[1].best - a[1].best).slice(0, 5);
  const titles = new Map<string, number>();
  champions.forEach((c) => titles.set(c.id, (titles.get(c.id) ?? 0) + 1));
  const medals = new Map<string, number>();
  [...data.tp.filter((r) => r.medal), ...data.comp].forEach((r) => medals.set(r.player_id, (medals.get(r.player_id) ?? 0) + 1));

  // Récords de asistencia (mín. 5 registros en 6 meses).
  const att = new Map<string, { p: number; t: number }>();
  data.att.forEach((a) => {
    const x = att.get(a.player_id) ?? { p: 0, t: 0 };
    x.t++;
    if (a.status === 'present') x.p++;
    att.set(a.player_id, x);
  });
  const attendanceTop = [...att.entries()].filter(([, x]) => x.t >= 5).sort((a, b) => b[1].p / b[1].t - a[1].p / a[1].t || b[1].t - a[1].t).slice(0, 5);

  // Mejoras destacadas: promedio de la primera vs. la última evaluación con puntuación.
  const evals = new Map<string, Map<string, number[]>>();
  data.items.forEach((i) => {
    const d = i.evaluations?.evaluated_on;
    if (!d) return;
    const m = evals.get(i.player_id) ?? new Map<string, number[]>();
    m.set(d, [...(m.get(d) ?? []), Number(i.score)]);
    evals.set(i.player_id, m);
  });
  const improvements = [...evals.entries()]
    .map(([id, m]) => {
      const dates = [...m.keys()].sort();
      if (dates.length < 2) return null;
      const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
      return { id, delta: avg(m.get(dates[dates.length - 1])!) - avg(m.get(dates[0])!), from: dates[0], to: dates[dates.length - 1] };
    })
    .filter((x): x is NonNullable<typeof x> => !!x && x.delta > 0)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 5);
  const distinctions = data.ach.filter((a) => a.kind === 'distinction' || a.kind === 'streak');

  const Rank = ({ rows }: { rows: { id: string; value: string; hint?: string }[] }) =>
    rows.length === 0 ? (
      <p className="text-sm text-muted-foreground">Aún no hay datos suficientes.</p>
    ) : (
      <ol className="flex flex-col divide-y">
        {rows.map((r, i) => (
          <li key={r.id} className="flex min-h-11 items-center gap-3 py-1.5">
            <span className="numeral w-5 text-[1.1rem] text-muted-foreground">{i + 1}</span>
            <Link to={`/jugadores/${r.id}`} className="flex-1 font-medium hover:underline">
              {name(r.id)}
              {r.hint && <span className="block text-xs font-normal text-muted-foreground">{r.hint}</span>}
            </Link>
            <span className="numeral text-[1.25rem]">{r.value}</span>
          </li>
        ))}
      </ol>
    );

  return (
    <div>
      <PageHeader
        title="Estadísticas y reconocimientos"
        description="Historia deportiva de la academia. Qué se muestra a jugadores y familias se controla en Configuración."
        actions={
          <Button onClick={() => setPick(true)}>
            <Star /> Otorgar distinción
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Campeones históricos por categoría">
          {byCat.size === 0 ? (
            <EmptyState title="Sin campeones todavía">Aparecen al cerrar torneos internos.</EmptyState>
          ) : (
            <div className="flex flex-col gap-4">
              {[...byCat.entries()].map(([cat, list]) => (
                <div key={cat}>
                  <h3 className="mb-1 text-[1.05rem]">{cat}</h3>
                  <ul className="flex flex-col gap-1 text-sm">
                    {list.map((c) => (
                      <li key={c.t.id + c.id}>
                        <span className="font-semibold">{name(c.id)}</span>, {c.t.name} ({fmtDate(c.t.held_on, { month: 'short', year: 'numeric' })})
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Panel>
        <Panel title="Podios">
          {podiums.size === 0 ? (
            <p className="text-sm text-muted-foreground">Sin torneos cerrados.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {[...podiums.values()]
                .sort((a, b) => b.t.held_on.localeCompare(a.t.held_on))
                .map((p) => (
                  <li key={p.t.id}>
                    <Link to={`/torneos/${p.t.id}`} className="font-semibold hover:underline">
                      {p.t.name}
                    </Link>
                    <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      {p.rows
                        .sort((a, b) => a.pos - b.pos)
                        .map((r) => (
                          <li key={r.id} className="flex items-center gap-1.5">
                            <MedalDot medal={r.medal} /> {name(r.id)}
                          </li>
                        ))}
                    </ul>
                  </li>
                ))}
            </ul>
          )}
        </Panel>
        <Panel title="Récords de la academia">
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <h3 className="mb-1 text-[1.05rem]">Más títulos</h3>
              <Rank rows={[...titles.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, n]) => ({ id, value: String(n) }))} />
            </div>
            <div>
              <h3 className="mb-1 text-[1.05rem]">Más medallas</h3>
              <Rank rows={[...medals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, n]) => ({ id, value: String(n), hint: 'Torneos internos y competencias' }))} />
            </div>
            <div>
              <h3 className="mb-1 text-[1.05rem]">Rachas de victorias</h3>
              <Rank rows={streaks.map(([id, s]) => ({ id, value: String(s.best), hint: s.cur >= 2 ? `Racha activa: ${s.cur}` : undefined }))} />
            </div>
            <div>
              <h3 className="mb-1 text-[1.05rem]">Más partidos jugados</h3>
              <Rank rows={[...played.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, n]) => ({ id, value: String(n) }))} />
            </div>
          </div>
        </Panel>
        <Panel title="Asistencia y mejoras">
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <h3 className="mb-1 text-[1.05rem]">Mejor asistencia (6 meses)</h3>
              <Rank rows={attendanceTop.map(([id, x]) => ({ id, value: `${Math.round((x.p / x.t) * 100)} %`, hint: `${x.p} de ${x.t} sesiones` }))} />
            </div>
            <div>
              <h3 className="mb-1 text-[1.05rem]">Mejoras destacadas</h3>
              <Rank rows={improvements.map((i) => ({ id: i.id, value: `+${i.delta.toFixed(1)}`, hint: `Promedio de evaluación, ${fmtDate(i.from, { month: 'short', year: '2-digit' })} a ${fmtDate(i.to, { month: 'short', year: '2-digit' })}` }))} />
            </div>
          </div>
        </Panel>
        <Panel title="Distinciones" className="lg:col-span-2">
          {distinctions.length === 0 ? (
            <EmptyState icon={<Award />} title="Sin distinciones">Reconoce al jugador del mes, al mayor esfuerzo o a quien quieras destacar.</EmptyState>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {distinctions.map((a) => (
                <li key={a.id} className="flex items-center gap-3 rounded-lg border p-3">
                  <AchievementIcon kind={a.kind} medal={a.medal} />
                  <span>
                    <span className="block font-semibold">{a.title}</span>
                    <span className="text-sm text-muted-foreground">
                      {name(a.player_id)}, {fmtDate(a.awarded_on)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      {pick && (
        <PickPlayers
          onClose={() => setPick(false)}
          onPick={(ids) => {
            setPick(false);
            setAward(ids);
          }}
        />
      )}
      {award && <AchievementDialog open onOpenChange={(o) => !o && setAward(null)} playerIds={award} />}
    </div>
  );
}

function PickPlayers({ onClose, onPick }: { onClose: () => void; onPick: (ids: string[]) => void }) {
  const { data: players = [] } = usePlayers();
  const [sel, setSel] = useState<string[]>([]);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>¿A quién reconoces?</DialogTitle>
          <DialogDescription>Puedes elegir uno o varios jugadores.</DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col divide-y">
          {players
            .filter((p) => p.status === 'active')
            .map((p) => (
              <li key={p.id}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3">
                  <Checkbox checked={sel.includes(p.id)} onCheckedChange={() => setSel((s) => (s.includes(p.id) ? s.filter((x) => x !== p.id) : [...s, p.id]))} className="size-5" />
                  {fullName(p)}
                </label>
              </li>
            ))}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={!sel.length} onClick={() => onPick(sel)}>
            Continuar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
