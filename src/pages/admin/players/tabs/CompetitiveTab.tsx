import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Chip, EmptyState, ErrorState, Loading, MedalDot, Panel, Stat } from '@/components/app/common';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fmtDate } from '@/lib/format';
import { supabase, unwrap } from '@/lib/supabase';

const SCOPE: Record<string, string> = { national: 'Nacional', regional: 'Regional', international: 'Internacional', other: 'Otra' };

export interface CompetitiveRow {
  key: string;
  date: string;
  name: string;
  location: string | null;
  type: string;
  category: string | null;
  modality: string;
  position: number | null;
  won: number | null;
  lost: number | null;
  medal: string | null;
  notes: string | null;
  href: string | null;
  internal: boolean;
}

export function useCompetitiveHistory(playerId: string, admin: boolean) {
  return useQuery({
    queryKey: ['competitive', playerId],
    queryFn: async () => {
      const [tp, cp, cats, matches] = await Promise.all([
        supabase
          .from('tournament_participants')
          .select('id, final_position, matches_won, matches_lost, sets_won, sets_lost, medal, tournaments(id, name, held_on, location, modality, format, status, category_ids)')
          .eq('player_id', playerId),
        supabase
          .from('competition_participants')
          .select('id, called_up, registered, category_label, final_position, matches_won, matches_lost, sets_won, sets_lost, medal, recognition, notes, competitions(id, name, start_date, location, scope)')
          .eq('player_id', playerId),
        supabase.from('categories').select('id, name'),
        supabase.rpc('portal_match_results', { p_player_id: playerId }),
      ]);
      const catName = new Map(unwrap(cats).map((c) => [c.id, c.name]));
      const ms = unwrap(matches) ?? [];
      const rows: CompetitiveRow[] = [
        ...unwrap(tp)
          .filter((r) => r.tournaments)
          .map((r) => {
            const t = r.tournaments!;
            const tm = ms.filter((m) => m.tournament_id === t.id);
            return {
              key: `t-${r.id}`,
              date: t.held_on,
              name: t.name,
              location: t.location,
              type: 'Torneo interno',
              category: t.category_ids.map((c) => catName.get(c)).filter(Boolean).join(', ') || null,
              modality: t.modality === 'individual' ? 'Individual' : t.modality,
              position: r.final_position,
              won: t.status === 'finished' ? r.matches_won : tm.filter((m) => m.won).length,
              lost: t.status === 'finished' ? r.matches_lost : tm.filter((m) => !m.won).length,
              medal: r.medal,
              notes: t.status === 'finished' ? null : 'En curso',
              href: admin ? `/torneos/${t.id}` : null,
              internal: true,
            };
          }),
        ...unwrap(cp)
          .filter((r) => r.competitions && (r.registered || r.final_position != null))
          .map((r) => {
            const c = r.competitions!;
            return {
              key: `c-${r.id}`,
              date: c.start_date,
              name: c.name,
              location: c.location,
              type: `Competencia ${SCOPE[c.scope]?.toLowerCase() ?? ''}`.trim(),
              category: r.category_label,
              modality: 'Individual',
              position: r.final_position,
              won: r.matches_won,
              lost: r.matches_lost,
              medal: r.medal,
              notes: [r.recognition, admin ? r.notes : null].filter(Boolean).join('. ') || null,
              href: admin ? `/competencias/${c.id}` : null,
              internal: false,
            };
          }),
      ].sort((a, b) => b.date.localeCompare(a.date));
      return { rows, matches: ms };
    },
  });
}

export function CompetitiveTab({ playerId, admin = true }: { playerId: string; admin?: boolean }) {
  const { data, isLoading, error, refetch } = useCompetitiveHistory(playerId, admin);
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorState error={error} retry={() => refetch()} />;
  const { rows, matches } = data;
  const won = matches.filter((m) => m.won).length;
  const medals = rows.filter((r) => r.medal).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 rounded-xl border bg-card p-5 sm:grid-cols-4">
        <Stat value={rows.length} label="Torneos y competencias" />
        <Stat value={matches.length} label="Partidos internos jugados" />
        <Stat value={matches.length ? `${Math.round((won / matches.length) * 100)} %` : '—'} label="Victorias internas" />
        <Stat value={medals} label="Medallas" />
      </div>

      <Panel title="Participaciones" bodyClassName="p-0 sm:p-0">
        {rows.length === 0 ? (
          <div className="p-4 sm:p-5">
            <EmptyState title="Sin participaciones registradas">
              Los torneos internos se incorporan solos al cerrarse; las competencias externas se registran en Competencias.
            </EmptyState>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Evento</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-right">Posición</TableHead>
                  <TableHead className="text-right">G–P</TableHead>
                  <TableHead>Medalla</TableHead>
                  <TableHead>Observaciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.key}>
                    <TableCell>
                      {r.href ? (
                        <Link to={r.href} className="font-semibold hover:underline">
                          {r.name}
                        </Link>
                      ) : (
                        <span className="font-semibold">{r.name}</span>
                      )}
                      {r.location && <span className="block text-xs text-muted-foreground">{r.location}</span>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{fmtDate(r.date)}</TableCell>
                    <TableCell>
                      <Chip tone={r.internal ? 'info' : 'ball'}>{r.type}</Chip>
                      <span className="block text-xs text-muted-foreground">{r.modality}</span>
                    </TableCell>
                    <TableCell>{r.category ?? '—'}</TableCell>
                    <TableCell className="numeral text-right text-[1.2rem]">{r.position ? `${r.position}.º` : '—'}</TableCell>
                    <TableCell className="numeral text-right text-[1.1rem]">{r.won != null || r.lost != null ? `${r.won ?? 0}–${r.lost ?? 0}` : '—'}</TableCell>
                    <TableCell>{r.medal ? <MedalDot medal={r.medal} /> : '—'}</TableCell>
                    <TableCell className="max-w-[22ch] text-sm text-muted-foreground">{r.notes ?? ''}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>

      {matches.length > 0 && (
        <Panel title="Partidos en torneos internos">
          <ul className="flex flex-col divide-y">
            {matches.slice(0, 20).map((m) => (
              <li key={m.match_id} className="flex items-center gap-3 py-2">
                <span className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${m.won ? 'bg-success/15 text-success' : 'bg-destructive/12 text-destructive'}`}>
                  {m.won ? 'G' : 'P'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block">vs {m.opponent_first_name}</span>
                  <span className="text-sm text-muted-foreground">
                    {m.tournament_name}, {m.label ?? (m.stage === 'group' ? `Grupos, jornada ${m.round}` : 'Eliminatoria')}
                  </span>
                </span>
                <span className="numeral text-[1.3rem]">{m.walkover ? 'W.O.' : `${m.sets_for}–${m.sets_against}`}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
