import { Link } from 'react-router';
import { Chip } from '@/components/app/common';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ResolvedBracketMatch, StandingRow } from '@/lib/tournament';
import { cn } from '@/lib/utils';
import type { MatchRow } from './data';

export function MatchStatus({ m }: { m: Pick<MatchRow, 'status' | 'walkover'> }) {
  if (m.status === 'finished') return <Chip tone="success">{m.walkover ? 'W.O.' : 'Finalizado'}</Chip>;
  if (m.status === 'in_progress')
    return (
      <Chip tone="ball">
        <span className="size-1.5 animate-pulse rounded-full bg-current" aria-hidden /> En curso
      </Chip>
    );
  return <Chip>Pendiente</Chip>;
}

export function MatchCard({ m, names, tournamentId, label }: { m: MatchRow; names: Map<string, string>; tournamentId: string; label?: string }) {
  const a = m.player_a ? names.get(m.player_a) : 'Por definir';
  const b = m.player_b ? names.get(m.player_b) : 'Por definir';
  const playable = !!m.player_a && !!m.player_b;
  const aWon = m.winner_id && m.winner_id === m.player_a;
  const bWon = m.winner_id && m.winner_id === m.player_b;
  const body = (
    <>
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{label ?? (m.table_no ? `Mesa ${m.table_no}` : 'Mesa por asignar')}</span>
        <MatchStatus m={m} />
      </div>
      <div className="mt-1.5 grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1">
        <span className={cn('truncate', aWon && 'font-bold')}>{a}</span>
        <span className="numeral text-[1.35rem] leading-none">{m.status === 'pending' ? '' : m.sets_a}</span>
        <span className={cn('truncate', bWon && 'font-bold')}>{b}</span>
        <span className="numeral text-[1.35rem] leading-none">{m.status === 'pending' ? '' : m.sets_b}</span>
      </div>
      {m.match_sets.length > 0 && (
        <p className="mt-1 text-xs text-muted-foreground">{m.match_sets.map((s) => `${s.points_a}-${s.points_b}`).join(', ')}</p>
      )}
    </>
  );
  if (!playable) return <div className="rounded-lg border border-dashed bg-card p-3 opacity-80">{body}</div>;
  return (
    <Link
      to={`/torneos/${tournamentId}/marcador/${m.id}`}
      className={cn(
        'block rounded-lg border bg-card p-3 hover:border-table/60',
        m.status === 'in_progress' && 'border-ball/70 ring-1 ring-ball/30',
      )}
      aria-label={`${a} contra ${b}: ${m.status === 'finished' ? 'corregir resultado' : 'registrar marcador'}`}
    >
      {body}
    </Link>
  );
}

const DECIDED: Record<string, string> = {
  wins: 'partidos ganados',
  head_to_head: 'resultado directo',
  set_diff: 'diferencia de sets',
  point_diff: 'diferencia de puntos',
  manual: 'decisión del entrenador',
  seed: 'sin resolver',
};

export function StandingsTable({ rows, names, qualify = 0 }: { rows: StandingRow[]; names: Map<string, string>; qualify?: number }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8">#</TableHead>
            <TableHead>Jugador</TableHead>
            <TableHead className="text-right" title="Partidos jugados">PJ</TableHead>
            <TableHead className="text-right" title="Ganados">G</TableHead>
            <TableHead className="text-right" title="Perdidos">P</TableHead>
            <TableHead className="text-right" title="Sets a favor y en contra">Sets</TableHead>
            <TableHead className="text-right" title="Diferencia de sets">Dif.</TableHead>
            <TableHead className="text-right" title="Diferencia de puntos">Pts.</TableHead>
            <TableHead className="text-right" title="Puntos de clasificación">Clas.</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.playerId} className={cn(r.position <= qualify && 'bg-table/6')}>
              <TableCell className="numeral text-[1.1rem]">{r.position}</TableCell>
              <TableCell>
                <span className="font-medium">{names.get(r.playerId)}</span>
                {r.position <= qualify && <span className="ml-2 text-xs font-semibold text-table dark:text-[#9cc4f2]">Clasifica</span>}
                {r.unresolvedTie && r.played > 0 && <span className="ml-2 text-xs font-semibold text-warning">Empate sin resolver</span>}
                {r.decidedBy && r.decidedBy !== 'wins' && r.decidedBy !== 'seed' && r.played > 0 && (
                  <span className="block text-xs text-muted-foreground">Por {DECIDED[r.decidedBy]}</span>
                )}
              </TableCell>
              <TableCell className="text-right">{r.played}</TableCell>
              <TableCell className="text-right font-semibold">{r.won}</TableCell>
              <TableCell className="text-right">{r.lost}</TableCell>
              <TableCell className="text-right whitespace-nowrap">
                {r.setsFor}-{r.setsAgainst}
              </TableCell>
              <TableCell className="text-right">{r.setDiff > 0 ? `+${r.setDiff}` : r.setDiff}</TableCell>
              <TableCell className="text-right">{r.pointDiff > 0 ? `+${r.pointDiff}` : r.pointDiff}</TableCell>
              <TableCell className="numeral text-right text-[1.1rem]">{r.classificationPoints}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function BracketView({
  resolved,
  rows,
  names,
  tournamentId,
}: {
  resolved: ResolvedBracketMatch[];
  rows: MatchRow[];
  names: Map<string, string>;
  tournamentId: string;
}) {
  const main = resolved.filter((m) => !m.isThirdPlace);
  const rounds = [...new Set(main.map((m) => m.round))].sort((a, b) => a - b);
  const third = resolved.find((m) => m.isThirdPlace);
  const rowOf = (key: string) => rows.find((r) => r.key === key)!;
  const slotName = (id: string | null, isBye: boolean) => (id ? names.get(id) : isBye ? 'BYE' : 'Por definir');
  const Box = ({ m }: { m: ResolvedBracketMatch }) => {
    const row = rowOf(m.key);
    const content = (
      <>
        {(['a', 'b'] as const).map((side) => {
          const id = side === 'a' ? m.playerA : m.playerB;
          const slot = side === 'a' ? m.a : m.b;
          const won = m.winner && id === m.winner;
          return (
            <span key={side} className={cn('flex items-center justify-between gap-2 px-2.5 py-1.5', side === 'a' && 'border-b', won && 'font-bold')}>
              <span className={cn('truncate', !id && 'text-muted-foreground')}>{slotName(id, slot.kind === 'bye')}</span>
              {row && row.status !== 'pending' && !m.byeAdvance && <span className="numeral text-[1.1rem]">{side === 'a' ? row.sets_a : row.sets_b}</span>}
            </span>
          );
        })}
      </>
    );
    const cls = cn('block w-52 overflow-hidden rounded-lg border bg-card text-sm', row?.status === 'in_progress' && 'border-ball/70');
    return m.playable && !m.byeAdvance ? (
      <Link to={`/torneos/${tournamentId}/marcador/${row.id}`} className={cn(cls, 'hover:border-table/60')} aria-label={`${m.label}: ${slotName(m.playerA, false)} contra ${slotName(m.playerB, false)}`}>
        {content}
      </Link>
    ) : (
      <div className={cls}>{content}</div>
    );
  };
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
      <div className="flex min-w-max gap-6">
        {rounds.map((r) => {
          const ms = main.filter((m) => m.round === r).sort((a, b) => a.position - b.position);
          return (
            <div key={r} className="flex flex-col">
              <h3 className="mb-3 text-[1.05rem]">{ms[0]?.label}</h3>
              <ol className="flex flex-1 flex-col justify-around gap-4">
                {ms.map((m) => (
                  <li key={m.key}>
                    <Box m={m} />
                  </li>
                ))}
              </ol>
            </div>
          );
        })}
        {third && (
          <div className="flex flex-col">
            <h3 className="mb-3 text-[1.05rem]">Tercer lugar</h3>
            <div className="flex flex-1 flex-col justify-center">
              <Box m={third} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
