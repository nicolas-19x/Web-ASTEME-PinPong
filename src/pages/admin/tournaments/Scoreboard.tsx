import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeftRight, ChevronLeft, Keyboard, Loader2, Minus, Plus, Undo2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { ErrorState, Field, Loading } from '@/components/app/common';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { rulesOf, saveResult, tKey, useTournament } from '@/features/tournaments/data';
import { checkSet, evaluateMatch, setsToWin, type SetScore } from '@/lib/tournament';
import { cn } from '@/lib/utils';

const LIVE_KEY = (id: string) => `atm-live-${id}`;

function readLive(id: string): SetScore | null {
  try {
    const raw = localStorage.getItem(LIVE_KEY(id));
    return raw ? (JSON.parse(raw) as SetScore) : null;
  } catch {
    return null;
  }
}
function writeLive(id: string, s: SetScore | null) {
  try {
    if (s) localStorage.setItem(LIVE_KEY(id), JSON.stringify(s));
    else localStorage.removeItem(LIVE_KEY(id));
  } catch {
    /* sin almacenamiento */
  }
}

export default function Scoreboard() {
  const { id = '', matchId = '' } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: d, isLoading, error, refetch } = useTournament(id);
  const match = d?.matches.find((m) => m.id === matchId);
  const rules = d && match ? rulesOf(d.tournament, match.stage as 'group' | 'knockout') : null;

  const [sets, setSets] = useState<SetScore[]>([]);
  const [cur, setCur] = useState<SetScore>({ a: 0, b: 0 });
  const [swapped, setSwapped] = useState(false);
  const [manual, setManual] = useState(false);
  const [manualSets, setManualSets] = useState<{ a: string; b: string }[]>([]);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  // Inicializa desde lo guardado (una vez por partido).
  useEffect(() => {
    if (!match || loadedFor === match.id) return;
    const saved = match.match_sets.map((s) => ({ a: s.points_a, b: s.points_b }));
    setSets(match.status === 'finished' ? saved : saved);
    setCur(match.status === 'finished' ? { a: 0, b: 0 } : (readLive(match.id) ?? { a: 0, b: 0 }));
    const isCorrection = match.status === 'finished';
    setManual(isCorrection);
    setManualSets((saved.length ? saved : [{ a: 0, b: 0 }]).map((s) => ({ a: String(s.a), b: String(s.b) })));
    setLoadedFor(match.id);
  }, [match, loadedFor]);

  useEffect(() => {
    if (match && match.status !== 'finished' && !manual) writeLive(match.id, cur.a || cur.b ? cur : null);
  }, [cur, match, manual]);

  const evalSets = useMemo(() => (rules ? evaluateMatch(sets, rules) : null), [sets, rules]);

  if (isLoading) return <Loading />;
  if (error || !d) return <ErrorState error={error} retry={() => refetch()} />;
  if (!match || !rules)
    return (
      <div>
        <p className="mb-3">No se encontró el partido.</p>
        <Button asChild variant="outline">
          <Link to={`/torneos/${id}`}>Volver al torneo</Link>
        </Button>
      </div>
    );
  if (!match.player_a || !match.player_b) {
    return (
      <div>
        <p className="mb-3">Este partido aún no tiene definidos a ambos jugadores.</p>
        <Button asChild variant="outline">
          <Link to={`/torneos/${id}?tab=eliminatoria`}>Volver al cuadro</Link>
        </Button>
      </div>
    );
  }
  const finishedTournament = d.tournament.status === 'finished';
  const nameA = d.names.get(match.player_a)!;
  const nameB = d.names.get(match.player_b)!;
  const decided = evalSets?.winner ?? null;
  const isCorrection = match.status === 'finished';
  const title = match.stage === 'knockout' ? match.label : `${d.groups.find((g) => g.id === match.group_id)?.name}, jornada ${match.round}`;

  const persist = async (s: SetScore[], opts: { walkover?: string; final?: boolean } = {}) => {
    if (isCorrection && !reason.trim()) {
      toast.error('Indica el motivo de la corrección.');
      return false;
    }
    setBusy(true);
    try {
      await saveResult(match.id, s, { walkoverWinner: opts.walkover ?? null, reason: reason.trim() || null, tournamentId: id, stage: match.stage });
      await qc.invalidateQueries({ queryKey: tKey(id) });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const point = (side: 'a' | 'b', delta: 1 | -1) => {
    if (decided) return;
    const next = { ...cur, [side]: Math.max(0, cur[side] + delta) };
    const check = checkSet(next, rules);
    if (delta === 1 && check.ok) {
      const ns = [...sets, next];
      setSets(ns);
      setCur({ a: 0, b: 0 });
      writeLive(match.id, null);
      const ev = evaluateMatch(ns, rules);
      if (ev.winner) {
        toast.success(`Partido para ${ev.winner === 'a' ? nameA : nameB}. Confirma el resultado.`);
      } else {
        toast.success(`Set ${ns.length} para ${check.winner === 'a' ? nameA : nameB}: ${next.a}-${next.b}`);
        void persist(ns); // guarda el avance para la vista en vivo
      }
    } else setCur(next);
  };

  const undo = () => {
    if (cur.a || cur.b) return setCur({ a: 0, b: 0 });
    if (!sets.length) return;
    const last = sets[sets.length - 1];
    setSets(sets.slice(0, -1));
    setCur({ a: last.a, b: last.b });
  };

  const confirmFinal = async () => {
    if (await persist(sets, { final: true })) {
      toast.success('Resultado guardado');
      navigate(`/torneos/${id}`);
    }
  };

  const saveManual = async () => {
    const parsed = manualSets.filter((s) => s.a !== '' || s.b !== '').map((s) => ({ a: Number(s.a), b: Number(s.b) }));
    const ev = evaluateMatch(parsed, rules);
    if (!ev.valid) return toast.error(ev.errors[0]);
    if (!ev.winner) return toast.error(`El partido no está decidido: se necesitan ${setsToWin(rules)} sets ganados.`);
    if (await persist(parsed)) {
      writeLive(match.id, null);
      toast.success(isCorrection ? 'Resultado corregido; clasificaciones recalculadas' : 'Resultado guardado');
      navigate(`/torneos/${id}`);
    }
  };

  const walkover = async (winner: string) => {
    if (await persist([], { walkover: winner })) {
      toast.success('W.O. registrado');
      navigate(`/torneos/${id}`);
    }
  };

  const sides = swapped ? (['b', 'a'] as const) : (['a', 'b'] as const);
  const setsWon = (side: 'a' | 'b') => sets.filter((s) => (side === 'a' ? s.a > s.b : s.b > s.a)).length;

  return (
    <div className="-mx-4 -mt-5 sm:-mx-6 lg:mx-0 lg:mt-0">
      <div className="flex items-center gap-2 px-4 py-2 sm:px-6 lg:px-0">
        <Link to={`/torneos/${id}`} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4" aria-hidden /> {d.tournament.name}
        </Link>
        <span className="ml-auto text-right text-sm text-muted-foreground">
          {title}
          {match.table_no ? `, mesa ${match.table_no}` : ''}
          <span className="block text-xs">
            Sets a {rules.pointsPerSet}, mejor de {rules.bestOf}
          </span>
        </span>
      </div>

      {finishedTournament ? (
        <p className="mx-4 rounded-lg border p-4 sm:mx-6 lg:mx-0">El torneo está cerrado; sus resultados ya no se modifican.</p>
      ) : !manual ? (
        <>
          {/* Marcador: dos mitades de mesa separadas por la línea central */}
          <section className="table-band relative grid grid-cols-2 lg:rounded-xl" aria-label="Marcador">
            {sides.map((side) => {
              const name = side === 'a' ? nameA : nameB;
              const winnerHere = decided === side;
              return (
                <div key={side} className="flex flex-col items-center gap-2 px-3 pt-4 pb-5 text-center sm:px-6">
                  <p className="condensed line-clamp-2 min-h-[2.6rem] text-[1.25rem] leading-tight font-bold sm:text-[1.6rem]">{name}</p>
                  <p className="flex items-center gap-1.5" aria-label={`${setsWon(side)} sets ganados`}>
                    {Array.from({ length: setsToWin(rules) }, (_, i) => (
                      <span key={i} className={cn('size-3.5 rounded-full border-2 border-white/70', i < setsWon(side) && 'border-lime bg-lime')} />
                    ))}
                  </p>
                  <output
                    aria-live="polite"
                    aria-label={`Puntos de ${name} en el set actual`}
                    className={cn('numeral block text-[clamp(5.5rem,24vw,10rem)] leading-[0.9] tabular-nums', winnerHere && 'text-lime')}
                  >
                    {decided ? setsWon(side) : cur[side]}
                  </output>
                  {!decided && (
                    <div className="mt-1 flex w-full max-w-[15rem] items-center gap-2">
                      <Button
                        variant="ghost"
                        className="size-14 shrink-0 rounded-full border border-white/40 text-white hover:bg-white/10 hover:text-white"
                        aria-label={`Restar un punto a ${name}`}
                        onClick={() => point(side, -1)}
                        disabled={busy || cur[side] === 0}
                      >
                        <Minus className="size-6" />
                      </Button>
                      <Button
                        className="h-16 flex-1 rounded-2xl text-lg active:scale-[0.97]"
                        aria-label={`Sumar un punto a ${name}`}
                        onClick={() => point(side, 1)}
                        disabled={busy}
                      >
                        <Plus className="size-7" /> Punto
                      </Button>
                    </div>
                  )}
                  {winnerHere && <p className="mt-1 font-semibold text-lime">Gana el partido</p>}
                </div>
              );
            })}
          </section>

          <div className="flex flex-col gap-4 px-4 pt-4 sm:px-6 lg:px-0">
            <div className="flex flex-wrap items-center gap-2" aria-label="Sets jugados">
              <span className="text-sm text-muted-foreground">Sets:</span>
              {sets.length === 0 && <span className="text-sm text-muted-foreground">ninguno todavía</span>}
              {sets.map((s, i) => {
                const [x, y] = swapped ? [s.b, s.a] : [s.a, s.b];
                return (
                  <span key={i} className="numeral rounded-md bg-muted px-2.5 py-1 text-[1.1rem]">
                    {x}-{y}
                  </span>
                );
              })}
            </div>
            {decided ? (
              <div className="flex flex-col gap-2 rounded-xl border-2 border-ball/60 p-4">
                <p className="text-[1.1rem]">
                  <span className="font-semibold">{decided === 'a' ? nameA : nameB}</span> gana {setsWon(decided)}-{setsWon(decided === 'a' ? 'b' : 'a')}.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="lg" onClick={confirmFinal} disabled={busy}>
                    {busy && <Loader2 className="animate-spin" />}
                    Confirmar resultado
                  </Button>
                  <Button size="lg" variant="outline" onClick={undo} disabled={busy}>
                    <Undo2 /> Deshacer último set
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={undo} disabled={busy || (!sets.length && !cur.a && !cur.b)}>
                  <Undo2 /> Deshacer
                </Button>
                <Button variant="outline" onClick={() => setSwapped((s) => !s)}>
                  <ArrowLeftRight /> Cambiar lados
                </Button>
                <Button variant="outline" onClick={() => { setManualSets((sets.length ? sets : [{ a: 0, b: 0 }]).map((s) => ({ a: String(s.a), b: String(s.b) }))); setManual(true); }}>
                  <Keyboard /> Ingresar sets a mano
                </Button>
              </div>
            )}
            <WalkoverRow nameA={nameA} nameB={nameB} onPick={(w) => walkover(w === 'a' ? match.player_a! : match.player_b!)} busy={busy} />
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-4 px-4 sm:px-6 lg:px-0">
          <h1 className="text-[1.8rem]">
            {nameA} vs {nameB}
          </h1>
          {isCorrection && <p className="text-sm text-muted-foreground">Corrección de un resultado ya guardado: queda registrada con su motivo y se recalculan tablas y cuadro.</p>}
          <table className="w-full max-w-md">
            <thead>
              <tr className="text-left text-sm text-muted-foreground">
                <th className="pb-2 font-medium">Set</th>
                <th className="pb-2 font-medium">{nameA}</th>
                <th className="pb-2 font-medium">{nameB}</th>
              </tr>
            </thead>
            <tbody>
              {manualSets.map((s, i) => {
                const parsed = { a: Number(s.a), b: Number(s.b) };
                const filled = s.a !== '' && s.b !== '';
                const c = filled ? checkSet(parsed, rules) : null;
                return (
                  <tr key={i}>
                    <td className="numeral py-1 pr-3 text-[1.2rem]">{i + 1}</td>
                    <td className="py-1 pr-2">
                      <Input inputMode="numeric" aria-label={`Set ${i + 1}, puntos de ${nameA}`} value={s.a} onChange={(e) => setManualSets((x) => x.map((y, j) => (j === i ? { ...y, a: e.target.value.replace(/\D/g, '') } : y)))} className="numeral text-[1.3rem]" />
                    </td>
                    <td className="py-1 pr-2">
                      <Input inputMode="numeric" aria-label={`Set ${i + 1}, puntos de ${nameB}`} value={s.b} onChange={(e) => setManualSets((x) => x.map((y, j) => (j === i ? { ...y, b: e.target.value.replace(/\D/g, '') } : y)))} className="numeral text-[1.3rem]" />
                    </td>
                    <td className="py-1 text-xs">{c && !c.ok ? <span className="text-destructive">{c.error}</span> : null}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setManualSets((x) => (x.length < rules.bestOf ? [...x, { a: '', b: '' }] : x))} disabled={manualSets.length >= rules.bestOf}>
              <Plus /> Agregar set
            </Button>
            {manualSets.length > 1 && (
              <Button variant="ghost" onClick={() => setManualSets((x) => x.slice(0, -1))}>
                Quitar último set
              </Button>
            )}
          </div>
          {isCorrection && (
            <Field label="Motivo de la corrección" htmlFor="sb-r" required className="max-w-md">
              <Input id="sb-r" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej.: error al anotar el tercer set" />
            </Field>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="lg" onClick={saveManual} disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              {isCorrection ? 'Guardar corrección' : 'Guardar resultado'}
            </Button>
            {!isCorrection && (
              <Button size="lg" variant="outline" onClick={() => setManual(false)}>
                Volver al marcador
              </Button>
            )}
          </div>
          <WalkoverRow nameA={nameA} nameB={nameB} onPick={(w) => walkover(w === 'a' ? match.player_a! : match.player_b!)} busy={busy} />
        </div>
      )}
    </div>
  );
}

function WalkoverRow({ nameA, nameB, onPick, busy }: { nameA: string; nameB: string; onPick: (w: 'a' | 'b') => void; busy: boolean }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <Button variant="link" className="h-auto self-start px-0 text-sm" onClick={() => setOpen(true)}>
        Registrar W.O. (un jugador no se presentó)
      </Button>
    );
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border p-3">
      <span className="text-sm">Gana por W.O.:</span>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => onPick('a')}>
        {nameA}
      </Button>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => onPick('b')}>
        {nameB}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
        Cancelar
      </Button>
    </div>
  );
}
