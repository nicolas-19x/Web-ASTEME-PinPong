import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, ChevronLeft, FileDown, Flag, GitBranch, Loader2, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { Chip, ConfirmDialog, EmptyState, ErrorState, Field, Loading, MedalDot, Panel } from '@/components/app/common';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BracketView, MatchCard, StandingsTable } from '@/features/tournaments/components';
import {
  bracketMatches,
  closeGroupsAndBuildBracket,
  computeFinalPositions,
  groupStageComplete,
  groupStandings,
  rulesOf,
  STATUS_LABEL,
  tKey,
  useTournament,
  type FinalPosition,
  type TournamentData,
} from '@/features/tournaments/data';
import { fmtDate, fmtDateTime } from '@/lib/format';
import { supabase, unwrap, type Json } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import { podium, resolveBracket } from '@/lib/tournament';

export default function TournamentDetail() {
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { settings, logoUrl } = useTheme();
  const { data: d, isLoading, error, refetch } = useTournament(id, true);
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [tieGroup, setTieGroup] = useState<number | null>(null);
  const [pdfBusy, setPdfBusy] = useState<string | null>(null);
  const [matchFilter, setMatchFilter] = useState<'all' | 'pending' | 'in_progress' | 'finished'>('all');
  const tab = params.get('tab') ?? 'vivo';

  const standings = useMemo(() => (d ? groupStandings(d) : []), [d]);
  const resolved = useMemo(() => {
    if (!d) return [];
    const ko = d.matches.filter((m) => m.stage === 'knockout');
    return ko.length ? resolveBracket(bracketMatches(d), Object.fromEntries(ko.map((m) => [m.key, m.winner_id]))) : [];
  }, [d]);

  const closeGroups = useMutation({
    mutationFn: () => closeGroupsAndBuildBracket(d!),
    onSuccess: (r) => {
      toast.success(r.knockout ? `Cuadro eliminatorio generado${r.conflicts ? ` (${r.conflicts} cruce(s) del mismo grupo inevitables)` : ''}` : 'Tablas de grupos guardadas');
      void qc.invalidateQueries({ queryKey: tKey(id) });
      setParams({ tab: r.knockout ? 'eliminatoria' : 'grupos' }, { replace: true });
    },
    onError: (e) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async () => unwrap(await supabase.from('tournaments').delete().eq('id', id)),
    onSuccess: () => {
      toast.success('Torneo eliminado');
      void qc.invalidateQueries();
      navigate('/torneos');
    },
    onError: (e) => toast.error(e.message),
  });

  const history = useQuery({
    queryKey: ['match-history', id],
    enabled: tab === 'auditoria',
    queryFn: async () =>
      unwrap(
        await supabase
          .from('match_result_history')
          .select('*, matches!inner(tournament_id, key, label, stage, round, player_a, player_b)')
          .eq('matches.tournament_id', id)
          .order('changed_at', { ascending: false }),
      ),
  });

  if (isLoading) return <Loading />;
  if (error || !d) return <ErrorState error={error} retry={() => refetch()} />;
  const t = d.tournament;
  const groupMatches = d.matches.filter((m) => m.stage === 'group');
  const koMatches = d.matches.filter((m) => m.stage === 'knockout');
  const allPlayable = d.matches.filter((m) => m.player_a && m.player_b);
  const done = allPlayable.filter((m) => m.status === 'finished').length;
  const groupsDone = groupStageComplete(d);
  const hasKo = t.format === 'groups_knockout' && t.advance_per_group > 0;
  const canCloseGroups = t.status === 'group_stage' && groupsDone && hasKo;
  const allDone = allPlayable.length > 0 && allPlayable.every((m) => m.status === 'finished') && (!hasKo || koMatches.length > 0);
  const canFinalize = t.status !== 'finished' && allDone;
  const unresolved = standings.findIndex((rows) => rows.some((r) => r.unresolvedTie && r.played > 0));
  const p = resolved.length ? podium(resolved) : null;
  const rules = rulesOf(t, 'group');

  const pdf = async (kind: 'pre' | 'final') => {
    setPdfBusy(kind);
    try {
      const mod = await import('@/features/pdf/tournamentPdf');
      await mod.downloadTournamentPdf(kind, d, { academy: settings?.name ?? 'Academia', logoUrl, standings, resolved });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo generar el PDF');
    } finally {
      setPdfBusy(null);
    }
  };

  const visibleMatches = (list: typeof groupMatches) => (matchFilter === 'all' ? list : list.filter((m) => m.status === matchFilter));
  const slots = [...new Set(groupMatches.map((m) => m.slot ?? 0))].sort((a, b) => a - b);

  return (
    <div>
      <Link to="/torneos" className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" aria-hidden /> Torneos
      </Link>

      <section className="table-band mb-6 overflow-hidden rounded-xl p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold">{STATUS_LABEL[t.status]}</span>
              <span className="text-sm text-white/80">
                {fmtDate(t.held_on, { weekday: 'long', day: 'numeric', month: 'long' })}
                {t.location ? `, ${t.location}` : ''}
              </span>
            </div>
            <h1 className="text-[2.2rem] sm:text-[2.8rem]">{t.name}</h1>
            <p className="mt-1 text-white/80">
              {d.participants.length} jugadores, {d.groups.length} grupo(s). Sets a {rules.pointsPerSet}, mejor de {rules.bestOf}.
            </p>
          </div>
          <div className="text-right">
            <p className="numeral text-[3rem] leading-none">
              {done}/{allPlayable.length}
            </p>
            <p className="text-sm text-white/80">partidos con resultado</p>
          </div>
        </div>
        {p?.champion && (
          <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/20 pt-3">
            <span className="condensed text-[1.3rem] font-bold">Campeón: {d.names.get(p.champion)}</span>
            {p.runnerUp && <span className="text-white/85">Subcampeón: {d.names.get(p.runnerUp)}</span>}
            {p.third.length > 0 && <span className="text-white/85">Tercer lugar: {p.third.map((x) => d.names.get(x)).join(' y ')}</span>}
          </p>
        )}
      </section>

      <div className="mb-5 flex flex-wrap gap-2">
        {canCloseGroups && (
          <Button onClick={() => closeGroups.mutate()} disabled={closeGroups.isPending || unresolved >= 0}>
            {closeGroups.isPending ? <Loader2 className="animate-spin" /> : <GitBranch />} Cerrar grupos y generar eliminatoria
          </Button>
        )}
        {canFinalize && (
          <Button onClick={() => setFinalizeOpen(true)}>
            <Flag /> Cerrar torneo e integrar en expedientes
          </Button>
        )}
        <Button variant="outline" onClick={() => pdf('pre')} disabled={!!pdfBusy}>
          {pdfBusy === 'pre' ? <Loader2 className="animate-spin" /> : <FileDown />} PDF previo
        </Button>
        <Button variant="outline" onClick={() => pdf('final')} disabled={!!pdfBusy || done === 0}>
          {pdfBusy === 'final' ? <Loader2 className="animate-spin" /> : <FileDown />} PDF de resultados
        </Button>
        {t.status !== 'finished' && (
          <Button variant="ghost" onClick={() => setDeleteOpen(true)}>
            <Trash2 /> Eliminar
          </Button>
        )}
      </div>
      {unresolved >= 0 && groupsDone && (
        <div role="alert" className="mb-5 flex flex-col gap-2 rounded-lg border border-warning/40 bg-warning/8 p-3 sm:flex-row sm:items-center">
          <p className="flex-1 text-sm">
            En el {d.groups[unresolved].name} hay un empate que los criterios automáticos no resuelven. Decide el orden y deja constancia del motivo.
          </p>
          <Button variant="outline" size="sm" onClick={() => setTieGroup(unresolved)}>
            Resolver empate
          </Button>
        </div>
      )}

      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList className="h-auto w-max">
            <TabsTrigger value="vivo" className="min-h-10 px-3">En vivo</TabsTrigger>
            <TabsTrigger value="grupos" className="min-h-10 px-3">Grupos</TabsTrigger>
            {hasKo && <TabsTrigger value="eliminatoria" className="min-h-10 px-3">Eliminatoria</TabsTrigger>}
            <TabsTrigger value="documentos" className="min-h-10 px-3">Documentos</TabsTrigger>
            <TabsTrigger value="auditoria" className="min-h-10 px-3">Correcciones</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="vivo" className="mt-5">
          <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filtrar partidos">
            {(
              [
                ['all', 'Todos'],
                ['pending', 'Pendientes'],
                ['in_progress', 'En curso'],
                ['finished', 'Finalizados'],
              ] as const
            ).map(([v, l]) => (
              <Button key={v} size="sm" variant={matchFilter === v ? 'ink' : 'outline'} aria-pressed={matchFilter === v} onClick={() => setMatchFilter(v)}>
                {l}
              </Button>
            ))}
          </div>
          {koMatches.length > 0 && (
            <section className="mb-8">
              <h2 className="mb-3 text-[1.4rem]">Eliminatoria</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {visibleMatches(koMatches.filter((m) => !(resolved.find((r) => r.key === m.key)?.byeAdvance)))
                  .sort((a, b) => a.round - b.round || (a.position ?? 0) - (b.position ?? 0))
                  .map((m) => (
                    <MatchCard key={m.id} m={m} names={d.names} tournamentId={t.id} label={m.label ?? undefined} />
                  ))}
              </div>
            </section>
          )}
          <h2 className="mb-3 text-[1.4rem]">Fase de grupos</h2>
          {slots.map((s) => {
            const ms = visibleMatches(groupMatches.filter((m) => (m.slot ?? 0) === s));
            if (!ms.length) return null;
            return (
              <section key={s} className="mb-6">
                <h3 className="mb-2 text-[1.05rem] text-muted-foreground">Turno {s}</h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {ms.map((m) => (
                    <MatchCard
                      key={m.id}
                      m={m}
                      names={d.names}
                      tournamentId={t.id}
                      label={`${d.groups.find((g) => g.id === m.group_id)?.name}, jornada ${m.round}${m.table_no ? `, mesa ${m.table_no}` : ''}`}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </TabsContent>

        <TabsContent value="grupos" className="mt-5">
          <div className="grid gap-6 xl:grid-cols-2">
            {d.groups.map((g, gi) => {
              const byes = g.players.length % 2 === 1;
              return (
                <Panel
                  key={g.id}
                  title={g.name}
                  bodyClassName="p-0 sm:p-0"
                  action={
                    <span className="text-sm text-muted-foreground">
                      {groupMatches.filter((m) => m.group_id === g.id && m.status === 'finished').length}/{groupMatches.filter((m) => m.group_id === g.id).length} partidos
                      {byes ? ', con BYE' : ''}
                    </span>
                  }
                >
                  <StandingsTable rows={standings[gi]} names={d.names} qualify={hasKo ? t.advance_per_group : 0} />
                  {g.manual_order_note && <p className="border-t px-4 py-2 text-sm text-muted-foreground">Decisión manual: {g.manual_order_note}</p>}
                  <div className="border-t px-4 py-2">
                    <Button variant="link" className="h-auto px-0 text-sm" onClick={() => setTieGroup(gi)}>
                      Definir orden manual
                    </Button>
                  </div>
                </Panel>
              );
            })}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Desempate: {(t.tiebreakers as string[]).map((c) => ({ wins: 'partidos ganados', head_to_head: 'resultado directo', set_diff: 'diferencia de sets', point_diff: 'diferencia de puntos', manual: 'criterio del entrenador' })[c as 'wins']).join(', ')}.
          </p>
        </TabsContent>

        {hasKo && (
          <TabsContent value="eliminatoria" className="mt-5">
            {resolved.length === 0 ? (
              <EmptyState title="El cuadro todavía no existe">
                {groupsDone ? 'Cierra la fase de grupos para generarlo.' : 'Se genera cuando todos los partidos de grupos tengan resultado.'}
              </EmptyState>
            ) : (
              <BracketView resolved={resolved} rows={koMatches} names={d.names} tournamentId={t.id} />
            )}
          </TabsContent>
        )}

        <TabsContent value="documentos" className="mt-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Panel title="Planilla previa">
              <p className="mb-4 text-sm text-muted-foreground">
                Datos del torneo, participantes y ranking, grupos y cabezas de serie, jornadas con mesas, enfrentamientos con casillas para anotar sets y tablas de posiciones vacías.
              </p>
              <Button onClick={() => pdf('pre')} disabled={!!pdfBusy}>
                {pdfBusy === 'pre' ? <Loader2 className="animate-spin" /> : <FileDown />} Descargar PDF previo
              </Button>
            </Panel>
            <Panel title="Resultados finales">
              <p className="mb-4 text-sm text-muted-foreground">
                Participantes, resultados, tablas finales, cuadro eliminatorio, campeón, subcampeón, tercer lugar y estadísticas. Se genera desde los datos guardados.
              </p>
              <Button onClick={() => pdf('final')} disabled={!!pdfBusy || done === 0}>
                {pdfBusy === 'final' ? <Loader2 className="animate-spin" /> : <FileDown />} Descargar PDF final
              </Button>
              {t.status !== 'finished' && <p className="mt-2 text-xs text-muted-foreground">El torneo sigue en juego: el PDF mostrará los resultados disponibles hasta ahora.</p>}
            </Panel>
          </div>
        </TabsContent>

        <TabsContent value="auditoria" className="mt-5">
          {history.isLoading ? (
            <Loading />
          ) : !history.data?.length ? (
            <EmptyState title="Sin registros">Cada vez que se guarda o corrige un marcador queda constancia aquí.</EmptyState>
          ) : (
            <ul className="flex flex-col divide-y rounded-xl border bg-card">
              {history.data.map((h) => {
                const prev = h.previous as { sets?: { a: number; b: number }[]; status?: string } | null;
                const nw = h.new as { sets?: { a: number; b: number }[]; walkover?: boolean } | null;
                const fmt = (s?: { a: number; b: number }[]) => (s?.length ? s.map((x) => `${x.a}-${x.b}`).join(', ') : 'sin sets');
                return (
                  <li key={h.id} className="px-4 py-3">
                    <p className="font-medium">
                      {d.names.get(h.matches.player_a ?? '')} vs {d.names.get(h.matches.player_b ?? '')}
                      <span className="ml-2 text-sm font-normal text-muted-foreground">{h.matches.label ?? `Grupos, jornada ${h.matches.round}`}</span>
                    </p>
                    <p className="text-sm">
                      {prev?.status === 'pending' && !prev.sets?.length ? 'Registro inicial: ' : `Antes: ${fmt(prev?.sets)}. Ahora: `}
                      {nw?.walkover ? 'W.O.' : fmt(nw?.sets)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {fmtDateTime(h.changed_at)}
                      {h.reason ? `. Motivo: ${h.reason}` : ''}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      {tieGroup !== null && <ManualTieDialog d={d} groupIndex={tieGroup} onClose={() => setTieGroup(null)} currentOrder={standings[tieGroup].map((r) => r.playerId)} />}
      {finalizeOpen && <FinalizeDialog d={d} onClose={() => setFinalizeOpen(false)} />}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="¿Eliminar este torneo?"
        description="Se borrarán grupos, partidos y resultados de este torneo. Los expedientes de los jugadores no se modifican."
        confirmLabel="Eliminar torneo"
        destructive
        busy={del.isPending}
        onConfirm={() => del.mutate()}
      />
    </div>
  );
}

function ManualTieDialog({ d, groupIndex, onClose, currentOrder }: { d: TournamentData; groupIndex: number; onClose: () => void; currentOrder: string[] }) {
  const qc = useQueryClient();
  const g = d.groups[groupIndex];
  const [order, setOrder] = useState<string[]>(g.manual_order?.length ? g.manual_order : currentOrder);
  const [note, setNote] = useState(g.manual_order_note ?? '');
  const save = useMutation({
    mutationFn: async (clear: boolean) =>
      unwrap(
        await supabase
          .from('tournament_groups')
          .update(clear ? { manual_order: null, manual_order_note: null } : { manual_order: order, manual_order_note: note.trim() })
          .eq('id', g.id),
      ),
    onSuccess: () => {
      toast.success('Orden del grupo guardado');
      void qc.invalidateQueries({ queryKey: tKey(d.tournament.id) });
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });
  const move = (i: number, j: number) => setOrder((o) => {
    const a = o.slice();
    [a[i], a[j]] = [a[j], a[i]];
    return a;
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Orden manual de {g.name}</DialogTitle>
          <DialogDescription>
            Se aplica como último criterio de desempate (“criterio del entrenador”): solo decide entre jugadores que siguen empatados tras los criterios automáticos.
          </DialogDescription>
        </DialogHeader>
        <ol className="flex flex-col gap-1">
          {order.map((id, i) => (
            <li key={id} className="flex min-h-11 items-center gap-2 rounded-md border px-2">
              <span className="numeral w-6 text-center">{i + 1}</span>
              <span className="flex-1">{d.names.get(id)}</span>
              <Button variant="ghost" size="icon-sm" aria-label="Subir" disabled={i === 0} onClick={() => move(i, i - 1)}>
                <ArrowUp />
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label="Bajar" disabled={i === order.length - 1} onClick={() => move(i, i + 1)}>
                <ArrowDown />
              </Button>
            </li>
          ))}
        </ol>
        <Field label="Motivo de la decisión" htmlFor="tie-n" required hint="Queda documentado en el torneo y en el PDF.">
          <Input id="tie-n" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej.: sorteo con moneda ante ambos jugadores" />
        </Field>
        <DialogFooter>
          {g.manual_order && (
            <Button variant="ghost" onClick={() => save.mutate(true)}>
              Quitar orden manual
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={!note.trim() || save.isPending} onClick={() => save.mutate(false)}>
            Guardar orden
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FinalizeDialog({ d, onClose }: { d: TournamentData; onClose: () => void }) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<FinalPosition[]>(() => computeFinalPositions(d));
  const [ranking, setRanking] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: async () => {
      // Guarda la foto final de las tablas de grupos (si aún no se hizo).
      if (d.tournament.status === 'group_stage') await closeGroupsAndBuildBracket(d);
      const { error } = await supabase.rpc('finalize_tournament', {
        p_tournament_id: d.tournament.id,
        p_positions: rows.map((r) => ({ player_id: r.playerId, final_position: r.position, medal: r.medal })) as unknown as Json,
      });
      if (error) throw new Error(error.message);
      const moves = Object.entries(ranking).filter(([, v]) => v.trim() !== '');
      for (const [player_id, v] of moves) {
        const n = Number(v.replace(',', '.'));
        if (!Number.isFinite(n) || n < 0) throw new Error('Algún valor de ranking no es válido.');
        unwrap(await supabase.from('ranking_movements').insert({ player_id, new_value: n, reason: `Torneo: ${d.tournament.name}`, tournament_id: d.tournament.id }));
      }
    },
    onSuccess: () => {
      toast.success('Torneo cerrado. Resultados, medallas y ranking integrados en los expedientes.');
      void qc.invalidateQueries();
      onClose();
    },
    onError: (e) => setErr(e.message),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Cerrar torneo</DialogTitle>
          <DialogDescription>
            Revisa posiciones y medallas calculadas. Al confirmar se guardan en cada expediente (sin duplicados). El ranking solo cambia si escribes un nuevo valor.
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-2 font-medium">Jugador</th>
                <th className="py-2 font-medium">Posición</th>
                <th className="py-2 font-medium">Medalla</th>
                <th className="py-2 font-medium">Nuevo ranking</th>
              </tr>
            </thead>
            <tbody>
              {rows
                .slice()
                .sort((a, b) => a.position - b.position)
                .map((r) => {
                  const current = d.ranking.get(r.playerId);
                  return (
                    <tr key={r.playerId} className="border-t">
                      <td className="py-2 pr-2">
                        <span className="font-medium">{d.names.get(r.playerId)}</span>
                        {r.medal && (
                          <span className="ml-2">
                            <MedalDot medal={r.medal} />
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-2">
                        <Input
                          type="number"
                          min={1}
                          className="w-20"
                          aria-label={`Posición de ${d.names.get(r.playerId)}`}
                          value={r.position}
                          onChange={(e) => setRows((x) => x.map((y) => (y.playerId === r.playerId ? { ...y, position: Math.max(1, +e.target.value || 1) } : y)))}
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <Select
                          value={r.medal ?? 'none'}
                          onValueChange={(v) => setRows((x) => x.map((y) => (y.playerId === r.playerId ? { ...y, medal: v === 'none' ? null : (v as FinalPosition['medal']) } : y)))}
                        >
                          <SelectTrigger className="w-28" aria-label={`Medalla de ${d.names.get(r.playerId)}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Ninguna</SelectItem>
                            <SelectItem value="gold">Oro</SelectItem>
                            <SelectItem value="silver">Plata</SelectItem>
                            <SelectItem value="bronze">Bronce</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="py-2">
                        <Input
                          inputMode="decimal"
                          className="w-28"
                          placeholder={current == null ? 'Sin ranking' : String(current)}
                          aria-label={`Nuevo ranking de ${d.names.get(r.playerId)}`}
                          value={ranking[r.playerId] ?? ''}
                          onChange={(e) => setRanking((x) => ({ ...x, [r.playerId]: e.target.value }))}
                        />
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        {err && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {err}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending && <Loader2 className="animate-spin" aria-hidden />}
            Cerrar torneo
          </Button>
        </DialogFooter>
        <p className="text-xs text-muted-foreground">
          <Chip>Nota</Chip> Las posiciones de eliminados en la misma ronda se comparten (por ejemplo, dos quintos lugares).
        </p>
      </DialogContent>
    </Dialog>
  );
}
