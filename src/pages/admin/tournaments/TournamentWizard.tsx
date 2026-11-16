import { useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Check, ChevronLeft, Dices, Loader2, Search, Shuffle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Chip, EmptyState, Field, Loading, PageHeader, Panel } from '@/components/app/common';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/auth';
import { fullName, todayISO } from '@/lib/format';
import { useCategories, useLevels, usePlayers } from '@/lib/queries';
import { supabase, unwrap, type Json } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import {
  DEFAULT_TIEBREAKERS,
  groupLetter,
  planTournament,
  randomSeed,
  rankingSum,
  scheduleGroups,
  suggestStructure,
  type Entrant,
  type GroupMatch,
  type TiebreakCriterion,
} from '@/lib/tournament';
import { cn } from '@/lib/utils';

const STEPS = ['Datos', 'Participantes', 'Estructura', 'Distribución', 'Confirmar'];
const TB_LABEL: Record<TiebreakCriterion, string> = {
  wins: 'Partidos ganados',
  head_to_head: 'Resultado directo entre empatados',
  set_diff: 'Diferencia de sets',
  point_diff: 'Diferencia de puntos',
  manual: 'Criterio del entrenador (orden manual)',
};

interface Info {
  name: string;
  date: string;
  location: string;
  categoryIds: string[];
  format: 'groups_knockout' | 'round_robin';
  notes: string;
}
interface Structure {
  groupCount: number;
  advance: number;
  tables: number;
  bestOf: number;
  koBestOf: number;
  pointsPerSet: number;
  minLead: number;
  thirdPlace: boolean;
  tieMode: 'random' | 'manual';
  tiebreakers: TiebreakCriterion[];
}

export default function TournamentWizard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { profile } = useAuth();
  const { settings } = useTheme();
  const { data: players, isLoading } = usePlayers();
  const { data: categories = [] } = useCategories();
  const { data: levels = [] } = useLevels();
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const defaults = (settings?.default_rules as { pointsPerSet?: number; minLead?: number; bestOf?: number } | null) ?? {};
  const [info, setInfo] = useState<Info>({ name: '', date: todayISO(), location: '', categoryIds: [], format: 'groups_knockout', notes: '' });
  const [selected, setSelected] = useState<string[]>([]);
  const [filter, setFilter] = useState({ q: '', category: 'step1', level: 'all' });
  const [st, setSt] = useState<Structure | null>(null);
  const [seed, setSeed] = useState(() => randomSeed());
  const [manualOrder, setManualOrder] = useState<string[]>([]);
  const [groups, setGroups] = useState<Entrant[][] | null>(null);

  const activePlayers = useMemo(() => (players ?? []).filter((p) => p.status === 'active'), [players]);
  const entrants: Entrant[] = useMemo(
    () =>
      selected
        .map((id) => activePlayers.find((p) => p.id === id))
        .filter((p): p is NonNullable<typeof p> => !!p)
        .map((p) => ({ id: p.id, name: fullName(p), ranking: p.ranking_points == null ? null : Number(p.ranking_points), categoryId: p.category_id, level: p.levels?.name })),
    [selected, activePlayers],
  );

  const plan = useMemo(() => {
    if (!st || step < 3) return null;
    try {
      return planTournament({ entrants, groupCount: st.groupCount, tables: st.tables, tieMode: st.tieMode, seed, manualOrder });
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  }, [st, step, entrants, seed, manualOrder]);

  const effectiveGroups = groups ?? (plan && !('error' in plan) ? plan.groups : null);
  const matches: GroupMatch[] = useMemo(() => {
    if (!effectiveGroups || !st) return [];
    try {
      return scheduleGroups(effectiveGroups, st.tables).matches;
    } catch {
      return [];
    }
  }, [effectiveGroups, st]);

  if (isLoading) return <Loading />;

  const validate = (): string[] => {
    const e: string[] = [];
    if (step === 0) {
      if (!info.name.trim()) e.push('Escribe el nombre del torneo.');
      if (!info.date) e.push('Indica la fecha.');
    }
    if (step === 1) {
      if (selected.length < 2) e.push('Selecciona al menos 2 jugadores.');
    }
    if (step === 2 && st) {
      const n = selected.length;
      if (st.groupCount < 1) e.push('Debe haber al menos un grupo.');
      if (st.groupCount > 1 && Math.floor(n / st.groupCount) < 2) e.push('Con tantos grupos quedarían grupos de menos de 2 jugadores.');
      const minSize = Math.floor(n / st.groupCount);
      if (info.format === 'groups_knockout' && st.advance > minSize) e.push(`No pueden clasificar ${st.advance} por grupo: el grupo más pequeño tiene ${minSize}.`);
      if (info.format === 'groups_knockout' && st.advance * st.groupCount === 1) e.push('La eliminatoria necesita al menos 2 clasificados.');
      if (st.tables < 1) e.push('Indica al menos una mesa.');
      if (st.bestOf % 2 === 0 || st.koBestOf % 2 === 0) e.push('El número de sets debe ser impar (mejor de 3, 5…).');
      if (st.pointsPerSet < 5) e.push('Los sets deben jugarse al menos a 5 puntos.');
    }
    if (step === 3 && plan && 'error' in plan) e.push(plan.error);
    return e;
  };

  const next = () => {
    const e = validate();
    setErrors(e);
    if (e.length) return;
    if (step === 1 && !st) {
      const s = suggestStructure(selected.length);
      setSt({
        groupCount: s.groupCount,
        advance: info.format === 'round_robin' ? 0 : s.singleRoundRobin ? 0 : s.advancePerGroup,
        tables: Math.max(1, Math.min(4, Math.floor(selected.length / 2))),
        bestOf: defaults.bestOf ?? 3,
        koBestOf: defaults.bestOf ?? 3,
        pointsPerSet: defaults.pointsPerSet ?? 11,
        minLead: defaults.minLead ?? 2,
        thirdPlace: true,
        tieMode: 'random',
        tiebreakers: ((settings?.default_tiebreakers as TiebreakCriterion[]) ?? DEFAULT_TIEBREAKERS).slice(),
      });
    }
    if (step === 2) setGroups(null);
    setStep((s) => s + 1);
  };

  const save = async () => {
    if (!st || !effectiveGroups || !plan || 'error' in plan) return;
    setSaving(true);
    let tid: string | null = null;
    try {
      const rules = { pointsPerSet: st.pointsPerSet, minLead: st.minLead, bestOf: st.bestOf };
      const t = unwrap(
        await supabase
          .from('tournaments')
          .insert({
            name: info.name.trim(),
            held_on: info.date,
            location: info.location.trim() || null,
            category_ids: info.categoryIds,
            format: info.format,
            notes: info.notes.trim() || null,
            status: 'group_stage',
            rules: rules as unknown as Record<string, Json>,
            knockout_rules: { ...rules, bestOf: st.koBestOf } as unknown as Json,
            tiebreakers: st.tiebreakers,
            group_count: st.groupCount,
            advance_per_group: info.format === 'round_robin' ? 0 : st.advance,
            tables_available: st.tables,
            third_place: st.thirdPlace,
            tie_mode: st.tieMode,
            draw_seed: seed,
            created_by: profile?.id,
          })
          .select('id')
          .single(),
      );
      tid = t.id;
      const seedIndex = new Map(plan.seedOrder.map((e, i) => [e.id, i + 1]));
      unwrap(
        await supabase
          .from('tournament_participants')
          .insert(entrants.map((e) => ({ tournament_id: t.id, player_id: e.id, ranking_at_entry: e.ranking, seed_position: seedIndex.get(e.id) ?? null }))),
      );
      const gRows = unwrap(
        await supabase
          .from('tournament_groups')
          .insert(effectiveGroups.map((_, i) => ({ tournament_id: t.id, idx: i, name: `Grupo ${groupLetter(i)}` })))
          .select('id, idx'),
      );
      const gid = new Map(gRows.map((g) => [g.idx, g.id]));
      unwrap(
        await supabase
          .from('tournament_group_players')
          .insert(effectiveGroups.flatMap((g, gi) => g.map((e, i) => ({ tournament_id: t.id, group_id: gid.get(gi)!, player_id: e.id, seed_in_group: i + 1 })))),
      );
      unwrap(
        await supabase.from('matches').insert(
          matches.map((m) => ({
            tournament_id: t.id,
            stage: 'group',
            group_id: gid.get(m.groupIndex)!,
            key: m.key,
            round: m.round,
            slot: m.slot,
            table_no: m.table,
            player_a: m.a,
            player_b: m.b,
          })),
        ),
      );
      await qc.invalidateQueries();
      toast.success('Torneo creado. Ya puedes imprimir la planilla previa.');
      navigate(`/torneos/${t.id}?tab=documentos`);
    } catch (e) {
      if (tid) await supabase.from('tournaments').delete().eq('id', tid);
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar el torneo');
    } finally {
      setSaving(false);
    }
  };

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const filterCats = filter.category === 'step1' ? info.categoryIds : filter.category === 'all' ? [] : [filter.category];
  const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const visible = activePlayers.filter(
    (p) =>
      (!filterCats.length || (p.category_id && filterCats.includes(p.category_id))) &&
      (filter.level === 'all' || p.level_id === filter.level) &&
      (!filter.q || norm(fullName(p)).includes(norm(filter.q))),
  );
  const movePlayer = (id: string, to: number) => {
    if (!effectiveGroups) return;
    const g = effectiveGroups.map((x) => x.filter((e) => e.id !== id));
    const e = effectiveGroups.flat().find((x) => x.id === id)!;
    g[to] = [...g[to], e];
    setGroups(g);
  };

  return (
    <div>
      <Link to="/torneos" className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" aria-hidden /> Torneos
      </Link>
      <PageHeader title="Generar torneo" />

      {/* Pasos: es una secuencia real, por eso se numeran */}
      <ol className="mb-6 grid grid-cols-5 gap-1.5" aria-label="Pasos del asistente">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? 'step' : undefined}>
            <span className={cn('block h-1.5 rounded-full', i < step ? 'bg-table' : i === step ? 'bg-ball' : 'bg-muted')} aria-hidden />
            <span className={cn('mt-1.5 block truncate text-xs sm:text-sm', i === step ? 'font-semibold' : 'text-muted-foreground')}>
              {i + 1}. {s}
            </span>
          </li>
        ))}
      </ol>

      {errors.length > 0 && (
        <div role="alert" className="mb-4 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {errors.map((e) => (
            <p key={e}>{e}</p>
          ))}
        </div>
      )}

      {step === 0 && (
        <Panel>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre del torneo" htmlFor="tw-n" required className="sm:col-span-2">
              <Input id="tw-n" value={info.name} onChange={(e) => setInfo({ ...info, name: e.target.value })} placeholder="Ej.: Torneo interno de noviembre" />
            </Field>
            <Field label="Fecha" htmlFor="tw-d" required>
              <Input id="tw-d" type="date" value={info.date} onChange={(e) => setInfo({ ...info, date: e.target.value })} />
            </Field>
            <Field label="Ubicación" htmlFor="tw-l">
              <Input id="tw-l" value={info.location} onChange={(e) => setInfo({ ...info, location: e.target.value })} />
            </Field>
            <Field label="Tipo de competición">
              <Select value={info.format} onValueChange={(v) => setInfo({ ...info, format: v as Info['format'] })}>
                <SelectTrigger className="w-full" aria-label="Tipo de competición">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="groups_knockout">Grupos y eliminación directa</SelectItem>
                  <SelectItem value="round_robin">Solo grupos (todos contra todos)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Modalidad">
              <Input value="Individual" disabled aria-label="Modalidad" />
            </Field>
            <fieldset className="sm:col-span-2">
              <legend className="mb-2 text-sm font-semibold">Categorías</legend>
              <div className="flex flex-wrap gap-2">
                {categories.map((c) => {
                  const on = info.categoryIds.includes(c.id);
                  return (
                    <Button
                      key={c.id}
                      type="button"
                      variant={on ? 'ink' : 'outline'}
                      aria-pressed={on}
                      onClick={() => setInfo({ ...info, categoryIds: on ? info.categoryIds.filter((x) => x !== c.id) : [...info.categoryIds, c.id] })}
                    >
                      {on && <Check />}
                      {c.name}
                    </Button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {info.categoryIds.length > 1 ? 'Estás agrupando varias categorías en un mismo torneo.' : 'Por defecto cada torneo es de una categoría; elige varias solo si quieres agruparlas.'}
              </p>
            </fieldset>
            <Field label="Observaciones" htmlFor="tw-o" className="sm:col-span-2">
              <Textarea id="tw-o" rows={2} value={info.notes} onChange={(e) => setInfo({ ...info, notes: e.target.value })} />
            </Field>
          </div>
        </Panel>
      )}

      {step === 1 && (
        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <Panel title="Elegir participantes">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input className="pl-9" placeholder="Buscar por nombre" aria-label="Buscar por nombre" value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} />
              </div>
              <Select value={filter.category} onValueChange={(v) => setFilter({ ...filter, category: v })}>
                <SelectTrigger className="sm:w-44" aria-label="Filtrar por categoría">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="step1">{info.categoryIds.length ? 'Categorías del torneo' : 'Todas las categorías'}</SelectItem>
                  <SelectItem value="all">Todas las categorías</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filter.level} onValueChange={(v) => setFilter({ ...filter, level: v })}>
                <SelectTrigger className="sm:w-40" aria-label="Filtrar por nivel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los niveles</SelectItem>
                  {levels.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="mb-2 flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelected((s) => [...new Set([...s, ...visible.map((p) => p.id)])])}>
                Seleccionar los {visible.length} visibles
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelected([])} disabled={!selected.length}>
                Quitar todos
              </Button>
            </div>
            {visible.length === 0 ? (
              <EmptyState title="Ningún jugador activo coincide">Cambia los filtros o la categoría.</EmptyState>
            ) : (
              <ul className="flex flex-col divide-y">
                {visible.map((p) => (
                  <li key={p.id}>
                    <label className="flex min-h-12 cursor-pointer items-center gap-3 py-1.5">
                      <Checkbox checked={selected.includes(p.id)} onCheckedChange={() => toggle(p.id)} className="size-5" />
                      <span className="flex-1">
                        <span className="font-medium">{fullName(p)}</span>
                        <span className="block text-xs text-muted-foreground">
                          {p.categories?.name}, {p.levels?.name ?? 'sin nivel'}
                        </span>
                      </span>
                      <span className={cn('text-sm', p.ranking_points == null ? 'text-muted-foreground' : 'numeral text-[1.1rem]')}>{p.ranking_points ?? 'Sin ranking'}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title={`Inscritos: ${selected.length}`}>
            {selected.length === 0 ? (
              <p className="text-sm text-muted-foreground">Marca jugadores en la lista. Un jugador solo puede inscribirse una vez.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {entrants.map((e) => (
                  <li key={e.id}>
                    <button type="button" onClick={() => toggle(e.id)} className="inline-flex min-h-9 items-center gap-1 rounded-full bg-secondary px-3 text-sm font-medium hover:bg-destructive/10" aria-label={`Quitar a ${e.name}`}>
                      {e.name} ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {entrants.some((e) => e.ranking == null) && (
              <p className="mt-3 text-sm text-warning">{entrants.filter((e) => e.ranking == null).length} sin ranking: se ubicarán por sorteo u orden manual, sin inventar puntos.</p>
            )}
          </Panel>
        </div>
      )}

      {step === 2 && st && (
        <Panel>
          <p className="mb-4 rounded-lg bg-muted p-3 text-sm">
            <span className="font-semibold">Sugerencia para {selected.length} inscritos: </span>
            {suggestStructure(selected.length).rationale} Puedes cambiarla.
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Cantidad de grupos" htmlFor="ts-g">
              <Input id="ts-g" type="number" min={1} value={st.groupCount} onChange={(e) => setSt({ ...st, groupCount: Math.max(1, +e.target.value || 1) })} />
            </Field>
            {info.format === 'groups_knockout' && (
              <Field label="Clasificados por grupo" htmlFor="ts-a" hint="0 = sin eliminatoria">
                <Input id="ts-a" type="number" min={0} value={st.advance} onChange={(e) => setSt({ ...st, advance: Math.max(0, +e.target.value || 0) })} />
              </Field>
            )}
            <Field label="Mesas disponibles" htmlFor="ts-t">
              <Input id="ts-t" type="number" min={1} value={st.tables} onChange={(e) => setSt({ ...st, tables: Math.max(1, +e.target.value || 1) })} />
            </Field>
            <Field label="Sets en grupos (mejor de)">
              <Select value={String(st.bestOf)} onValueChange={(v) => setSt({ ...st, bestOf: +v })}>
                <SelectTrigger className="w-full" aria-label="Sets en grupos">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 3, 5, 7].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      Mejor de {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {info.format === 'groups_knockout' && (
              <Field label="Sets en eliminatoria (mejor de)">
                <Select value={String(st.koBestOf)} onValueChange={(v) => setSt({ ...st, koBestOf: +v })}>
                  <SelectTrigger className="w-full" aria-label="Sets en eliminatoria">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 3, 5, 7].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        Mejor de {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            <Field label="Puntos por set" htmlFor="ts-p">
              <Input id="ts-p" type="number" min={5} value={st.pointsPerSet} onChange={(e) => setSt({ ...st, pointsPerSet: +e.target.value || 11 })} />
            </Field>
            <Field label="Diferencia mínima" htmlFor="ts-m">
              <Input id="ts-m" type="number" min={1} value={st.minLead} onChange={(e) => setSt({ ...st, minLead: Math.max(1, +e.target.value || 2) })} />
            </Field>
            <Field label="Empates de ranking y sin ranking">
              <Select value={st.tieMode} onValueChange={(v) => setSt({ ...st, tieMode: v as Structure['tieMode'] })}>
                <SelectTrigger className="w-full" aria-label="Resolución de empates de ranking">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="random">Sorteo</SelectItem>
                  <SelectItem value="manual">Orden manual</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {info.format === 'groups_knockout' && (
              <label className="flex items-center gap-3 self-end pb-2 text-sm font-medium">
                <Switch checked={st.thirdPlace} onCheckedChange={(c) => setSt({ ...st, thirdPlace: c })} /> Partido por el tercer lugar
              </label>
            )}
          </div>
          <div className="mt-6">
            <h3 className="mb-2 text-[1.1rem]">Criterios de desempate (en orden)</h3>
            <ol className="flex flex-col gap-1.5">
              {st.tiebreakers.map((c, i) => (
                <li key={c} className="flex min-h-11 items-center gap-2 rounded-lg border px-3">
                  <span className="numeral w-5 text-[1.1rem]">{i + 1}</span>
                  <span className="flex-1">{TB_LABEL[c]}</span>
                  <Button variant="ghost" size="icon-sm" aria-label="Subir" disabled={i === 0} onClick={() => setSt({ ...st, tiebreakers: swap(st.tiebreakers, i, i - 1) })}>
                    <ArrowUp />
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label="Bajar" disabled={i === st.tiebreakers.length - 1} onClick={() => setSt({ ...st, tiebreakers: swap(st.tiebreakers, i, i + 1) })}>
                    <ArrowDown />
                  </Button>
                </li>
              ))}
            </ol>
          </div>
        </Panel>
      )}

      {step === 3 && st && plan && !('error' in plan) && effectiveGroups && (
        <div className="flex flex-col gap-6">
          {(plan.unranked.length > 0 || plan.rankingTies.length > 0) && (
            <Panel title="Siembra">
              {plan.unranked.length > 0 && (
                <p className="mb-2 text-sm">
                  <span className="font-semibold">{plan.unranked.length} sin ranking</span> ({plan.unranked.map((e) => e.name).join(', ')}): ubicados {st.tieMode === 'random' ? 'por sorteo' : 'según tu orden manual'} después de los que tienen puntos.
                </p>
              )}
              {plan.rankingTies.length > 0 && <p className="mb-2 text-sm">Hay {plan.rankingTies.length} empate(s) de ranking, resueltos {st.tieMode === 'random' ? 'por sorteo' : 'con tu orden'}.</p>}
              {st.tieMode === 'random' ? (
                <Button variant="outline" onClick={() => { setSeed(randomSeed()); setGroups(null); }}>
                  <Dices /> Repetir sorteo
                </Button>
              ) : (
                <ManualOrder
                  order={plan.seedOrder
                    .filter((e) => e.ranking === null || plan.rankingTies.some((t) => t.includes(e.id)))
                    .map((e) => e.id)}
                  names={new Map(entrants.map((e) => [e.id, e.name]))}
                  onChange={(o) => {
                    setManualOrder(o);
                    setGroups(null);
                  }}
                />
              )}
            </Panel>
          )}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {effectiveGroups.map((g, gi) => (
              <section key={gi} className="overflow-hidden rounded-xl border bg-card">
                <header className="table-band-h flex items-baseline justify-between px-4 py-2.5">
                  <h3 className="text-[1.3rem]">Grupo {groupLetter(gi)}</h3>
                  <span className="text-sm text-white/80">Suma de ranking: {rankingSum(g)}</span>
                </header>
                <ul className="divide-y">
                  {g.map((e, i) => (
                    <li key={e.id} className="flex min-h-12 items-center gap-2 px-3 py-1.5">
                      <span className="numeral w-6 text-center text-[1.05rem] text-muted-foreground">{i + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{e.name}</span>
                        {i === 0 && <span className="text-xs font-semibold text-table dark:text-[#9cc4f2]">Cabeza de serie</span>}
                      </span>
                      <span className="text-sm text-muted-foreground">{e.ranking ?? 'Sin rk.'}</span>
                      {effectiveGroups.length > 1 && (
                        <Select value={String(gi)} onValueChange={(v) => movePlayer(e.id, +v)}>
                          <SelectTrigger size="sm" className="w-[4.5rem]" aria-label={`Mover a ${e.name} a otro grupo`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {effectiveGroups.map((_, j) => (
                              <SelectItem key={j} value={String(j)}>
                                {groupLetter(j)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="border-t px-4 py-2 text-xs text-muted-foreground">
                  {(g.length * (g.length - 1)) / 2} partidos en {g.length % 2 ? g.length : g.length - 1} jornadas{g.length % 2 ? ', con descanso (BYE)' : ''}
                </p>
              </section>
            ))}
          </div>
          {groups && (
            <Button variant="outline" className="self-start" onClick={() => setGroups(null)}>
              <Shuffle /> Volver a la distribución automática
            </Button>
          )}
          {effectiveGroups.some((g) => g.length < 2) && <p className="text-sm font-semibold text-destructive">Hay un grupo con menos de 2 jugadores.</p>}
          <p className="text-sm text-muted-foreground">
            {matches.length} partidos en {new Set(matches.map((m) => m.slot)).size} turnos con {st.tables} mesa(s). Nadie juega dos partidos en el mismo turno.
          </p>
        </div>
      )}

      {step === 4 && st && effectiveGroups && (
        <Panel title="Resumen">
          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            <div><dt className="text-sm text-muted-foreground">Torneo</dt><dd className="font-semibold">{info.name}</dd></div>
            <div><dt className="text-sm text-muted-foreground">Fecha</dt><dd>{info.date}{info.location ? `, ${info.location}` : ''}</dd></div>
            <div><dt className="text-sm text-muted-foreground">Participantes</dt><dd>{entrants.length}</dd></div>
            <div><dt className="text-sm text-muted-foreground">Grupos</dt><dd>{effectiveGroups.map((g, i) => `${groupLetter(i)} (${g.length})`).join(', ')}</dd></div>
            <div><dt className="text-sm text-muted-foreground">Partidos de grupos</dt><dd>{matches.length}, en {st.tables} mesa(s)</dd></div>
            <div><dt className="text-sm text-muted-foreground">Formato</dt><dd>Sets a {st.pointsPerSet}, diferencia de {st.minLead}, mejor de {st.bestOf}{info.format === 'groups_knockout' && st.advance > 0 ? `; avanzan ${st.advance} por grupo, eliminatoria al mejor de ${st.koBestOf}` : '; sin eliminatoria'}</dd></div>
          </dl>
          <p className="mt-4 text-sm text-muted-foreground">Al confirmar se guardan grupos, jornadas, mesas y enfrentamientos, y podrás descargar la planilla previa en PDF.</p>
        </Panel>
      )}

      <div className="mt-6 flex justify-between gap-2">
        <Button variant="outline" onClick={() => { setErrors([]); setStep((s) => Math.max(0, s - 1)); }} disabled={step === 0 || saving}>
          Atrás
        </Button>
        {step < 4 ? (
          <Button onClick={next} disabled={step === 3 && !!effectiveGroups?.some((g) => g.length < 2)}>
            Continuar
          </Button>
        ) : (
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="animate-spin" aria-hidden />}
            Confirmar y guardar torneo
          </Button>
        )}
      </div>
      {step === 1 && selected.length > 0 && (
        <p className="mt-2 text-right text-sm text-muted-foreground">
          <Chip tone="info">{selected.length} inscritos</Chip>
        </p>
      )}
    </div>
  );
}

function swap<T>(arr: T[], i: number, j: number): T[] {
  const a = arr.slice();
  [a[i], a[j]] = [a[j], a[i]];
  return a;
}

function ManualOrder({ order, names, onChange }: { order: string[]; names: Map<string, string>; onChange: (o: string[]) => void }) {
  return (
    <div>
      <p className="mb-2 text-sm text-muted-foreground">
        Orden manual para empatados y jugadores sin ranking (el resto se ordena por sus puntos). Dentro de cada empate, el primero de esta lista queda mejor sembrado.
      </p>
      <ol className="flex flex-col gap-1">
        {order.map((id, i) => (
          <li key={id} className="flex min-h-10 items-center gap-2 rounded-md border px-2">
            <span className="numeral w-6 text-center">{i + 1}</span>
            <span className="flex-1">{names.get(id)}</span>
            <Button variant="ghost" size="icon-sm" aria-label="Subir" disabled={i === 0} onClick={() => onChange(swap(order, i, i - 1))}>
              <ArrowUp />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Bajar" disabled={i === order.length - 1} onClick={() => onChange(swap(order, i, i + 1))}>
              <ArrowDown />
            </Button>
          </li>
        ))}
      </ol>
    </div>
  );
}
