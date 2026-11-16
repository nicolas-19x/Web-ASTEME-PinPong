import { useQuery } from '@tanstack/react-query';
import { FileDown, FileSpreadsheet, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { Field, PageHeader, Panel } from '@/components/app/common';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { exportRows } from '@/features/export';
import type { PlayerReportOptions } from '@/features/pdf/playerPdf';
import { bracketMatches, groupStandings, loadTournament } from '@/features/tournaments/data';
import { addDays, ATTENDANCE_LABEL, fmtDate, fullName, HAND_LABEL, MEDAL_LABEL, playerAge, STATUS_LABEL, todayISO } from '@/lib/format';
import { usePlayers } from '@/lib/queries';
import { supabase, unwrap } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import { resolveBracket } from '@/lib/tournament';

const SECTIONS: [keyof PlayerReportOptions, string][] = [
  ['general', 'Datos generales'],
  ['competitive', 'Historial competitivo'],
  ['evaluations', 'Evaluaciones recientes'],
  ['goals', 'Objetivos actuales'],
  ['evolution', 'Evolución (evaluaciones y controles)'],
  ['attendance', 'Asistencia'],
  ['achievements', 'Logros y reconocimientos'],
];

export default function Reports() {
  const [params] = useSearchParams();
  const { settings, logoUrl } = useTheme();
  const { data: players = [] } = usePlayers();
  const [playerId, setPlayerId] = useState(params.get('jugador') ?? '');
  const [opts, setOpts] = useState<PlayerReportOptions>({ general: true, competitive: true, evaluations: true, goals: true, evolution: true, attendance: true, achievements: true, sharedOnly: true });
  const [busy, setBusy] = useState<string | null>(null);
  const [range, setRange] = useState({ from: addDays(todayISO(), -90), to: todayISO() });
  const tournaments = useQuery({
    queryKey: ['tournaments', 'reports'],
    queryFn: async () => unwrap(await supabase.from('tournaments').select('id, name, held_on, status').order('held_on', { ascending: false })),
  });

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo generar');
    } finally {
      setBusy(null);
    }
  };
  const academy = settings?.name ?? 'Academia';

  const playerPdf = () =>
    run('player', async () => {
      if (!playerId) throw new Error('Elige un jugador.');
      const mod = await import('@/features/pdf/playerPdf');
      await mod.downloadPlayerReport(playerId, opts, academy, logoUrl);
    });
  const tournamentPdf = (id: string) =>
    run(`t-${id}`, async () => {
      const d = await loadTournament(id);
      const ko = d.matches.filter((m) => m.stage === 'knockout');
      const resolved = ko.length ? resolveBracket(bracketMatches(d), Object.fromEntries(ko.map((m) => [m.key, m.winner_id]))) : [];
      const mod = await import('@/features/pdf/tournamentPdf');
      await mod.downloadTournamentPdf('final', d, { academy, logoUrl, standings: groupStandings(d), resolved });
    });

  const exportPlayers = (format: 'csv' | 'xlsx') =>
    run(`players-${format}`, () =>
      exportRows(
        'jugadores',
        ['Nombre', 'Apellidos', 'Edad', 'Fecha de nacimiento', 'Categoría', 'Nivel', 'Mano', 'Ingreso', 'Estado', 'Ranking'],
        players.map((p) => [p.first_name, p.last_names, playerAge(p).value ?? 'Pendiente', p.birth_date, p.categories?.name, p.levels?.name, p.dominant_hand ? HAND_LABEL[p.dominant_hand] : '', p.join_date, STATUS_LABEL[p.status], p.ranking_points]),
        format,
      ),
    );
  const exportAttendance = (format: 'csv' | 'xlsx') =>
    run(`att-${format}`, async () => {
      if (range.from > range.to) throw new Error('El rango de fechas no es válido.');
      const rows = unwrap(await supabase.from('attendance').select('on_date, status, note, players(first_name, last_names), training_groups(name)').gte('on_date', range.from).lte('on_date', range.to).order('on_date'));
      await exportRows(
        `asistencia-${range.from}-a-${range.to}`,
        ['Fecha', 'Grupo', 'Jugador', 'Estado', 'Nota'],
        rows.map((r) => [r.on_date, r.training_groups?.name, r.players ? fullName(r.players) : '', ATTENDANCE_LABEL[r.status], r.note]),
        format,
      );
    });
  const exportResults = (format: 'csv' | 'xlsx') =>
    run(`res-${format}`, async () => {
      const [m, c] = await Promise.all([
        supabase
          .from('matches')
          .select('stage, label, round, sets_a, sets_b, walkover, a:players!matches_player_a_fkey(first_name, last_names), b:players!matches_player_b_fkey(first_name, last_names), w:players!matches_winner_id_fkey(first_name, last_names), match_sets(set_no, points_a, points_b), tournaments(name, held_on)')
          .eq('status', 'finished')
          .not('player_b', 'is', null),
        supabase.from('competition_participants').select('final_position, matches_won, matches_lost, sets_won, sets_lost, medal, recognition, players(first_name, last_names), competitions(name, start_date)').not('final_position', 'is', null),
      ]);
      const rows = [
        ...unwrap(m).map((x) => [
          x.tournaments?.held_on,
          x.tournaments?.name,
          'Torneo interno',
          x.stage === 'group' ? `Grupos, jornada ${x.round}` : x.label,
          x.a ? fullName(x.a) : '',
          x.b ? fullName(x.b) : '',
          x.walkover ? 'W.O.' : `${x.sets_a}-${x.sets_b} (${[...x.match_sets].sort((p, q) => p.set_no - q.set_no).map((s) => `${s.points_a}-${s.points_b}`).join(', ')})`,
          x.w ? fullName(x.w) : '',
          '',
        ]),
        ...unwrap(c).map((x) => [
          x.competitions?.start_date,
          x.competitions?.name,
          'Competencia externa',
          '',
          x.players ? fullName(x.players) : '',
          '',
          `Posición ${x.final_position}. Partidos ${x.matches_won ?? 0}-${x.matches_lost ?? 0}. Sets ${x.sets_won ?? 0}-${x.sets_lost ?? 0}`,
          '',
          [x.medal ? MEDAL_LABEL[x.medal] : '', x.recognition].filter(Boolean).join('. '),
        ]),
      ].sort((a, b) => String(b[0]).localeCompare(String(a[0])));
      await exportRows('resultados', ['Fecha', 'Evento', 'Tipo', 'Fase', 'Jugador A / Jugador', 'Jugador B', 'Resultado', 'Ganador', 'Medalla o reconocimiento'], rows, format);
    });

  const ExportButtons = ({ k, fn }: { k: string; fn: (f: 'csv' | 'xlsx') => void }) => (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => fn('csv')} disabled={!!busy}>
        {busy === `${k}-csv` ? <Loader2 className="animate-spin" /> : <FileDown />} CSV
      </Button>
      <Button variant="outline" onClick={() => fn('xlsx')} disabled={!!busy}>
        {busy === `${k}-xlsx` ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />} Excel
      </Button>
    </div>
  );

  return (
    <div>
      <PageHeader title="Informes y exportación" description="Documentos generados a partir de los datos guardados, con el logo y los colores de la academia." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Informe individual (PDF)">
          <div className="flex flex-col gap-4">
            <Field label="Jugador">
              <Select value={playerId} onValueChange={setPlayerId}>
                <SelectTrigger className="w-full" aria-label="Jugador del informe">
                  <SelectValue placeholder="Elige un jugador" />
                </SelectTrigger>
                <SelectContent>
                  {players.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {fullName(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">Secciones</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {SECTIONS.map(([k, l]) => (
                  <label key={k} className="flex min-h-9 items-center gap-2 text-sm">
                    <Checkbox checked={opts[k]} onCheckedChange={(c) => setOpts({ ...opts, [k]: c === true })} className="size-5" /> {l}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="flex items-start gap-2 rounded-lg bg-muted p-3 text-sm">
              <Checkbox checked={opts.sharedOnly} onCheckedChange={(c) => setOpts({ ...opts, sharedOnly: c === true })} className="mt-0.5 size-5" />
              <span>
                Incluir solo información compartible
                <span className="block text-muted-foreground">Recomendado para entregar a la familia. Las notas internas nunca se incluyen.</span>
              </span>
            </label>
            <Button onClick={playerPdf} disabled={!!busy || !playerId} className="self-start">
              {busy === 'player' ? <Loader2 className="animate-spin" /> : <FileDown />} Generar informe PDF
            </Button>
          </div>
        </Panel>

        <Panel title="Informes de torneos">
          {!tournaments.data?.length ? (
            <p className="text-sm text-muted-foreground">Todavía no hay torneos.</p>
          ) : (
            <ul className="flex flex-col divide-y">
              {tournaments.data.map((t) => (
                <li key={t.id} className="flex min-h-12 items-center gap-3 py-1.5">
                  <span className="flex-1">
                    <span className="block font-medium">{t.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {fmtDate(t.held_on)}
                      {t.status !== 'finished' ? ', en juego' : ''}
                    </span>
                  </span>
                  <Button size="sm" variant="outline" onClick={() => tournamentPdf(t.id)} disabled={!!busy}>
                    {busy === `t-${t.id}` ? <Loader2 className="animate-spin" /> : <FileDown />} PDF
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Listado de jugadores">
          <p className="mb-3 text-sm text-muted-foreground">Todos los expedientes con sus datos básicos. Sin notas internas.</p>
          <ExportButtons k="players" fn={exportPlayers} />
        </Panel>

        <Panel title="Asistencia">
          <div className="mb-3 grid gap-3 sm:grid-cols-2">
            <Field label="Desde" htmlFor="rp-f">
              <Input id="rp-f" type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
            </Field>
            <Field label="Hasta" htmlFor="rp-t">
              <Input id="rp-t" type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
            </Field>
          </div>
          <ExportButtons k="att" fn={exportAttendance} />
        </Panel>

        <Panel title="Resultados">
          <p className="mb-3 text-sm text-muted-foreground">Partidos de torneos internos y resultados de competencias externas.</p>
          <ExportButtons k="res" fn={exportResults} />
        </Panel>
      </div>
    </div>
  );
}
