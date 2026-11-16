import { useQuery } from '@tanstack/react-query';
import { ArrowDownUp, LayoutGrid, Plus, Rows3, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Chip, EmptyState, ErrorState, Loading, PageHeader, PlayerAvatar, StatusChip } from '@/components/app/common';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { addDays, fmtDate, fullName, playerAge, todayISO } from '@/lib/format';
import { useCategories, useLevels, usePlayers, type PlayerListItem } from '@/lib/queries';
import { supabase, unwrap } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { PlayerFormDialog } from './PlayerForm';

const ALL = 'all';
type SortKey = 'name' | 'age' | 'category' | 'ranking' | 'join';
const VIEW_KEY = 'atm-players-view';

const SPECIAL: Record<string, string> = {
  incompletas: 'Fichas incompletas',
  'sin-ranking': 'Sin ranking',
  'sin-evaluacion': 'Sin evaluación reciente',
};

export default function PlayersList() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { data: players, isLoading, error, refetch } = usePlayers();
  const { data: categories = [] } = useCategories();
  const { data: levels = [] } = useLevels();
  const { data: recentEvals = [] } = useQuery({
    queryKey: ['evaluations', 'recent-ids'],
    queryFn: async () =>
      unwrap(await supabase.from('evaluations').select('player_id').gte('evaluated_on', addDays(todayISO(), -90))),
  });
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<SortKey>('name');
  const [view, setView] = useState<'table' | 'cards'>(() => {
    try {
      return (localStorage.getItem(VIEW_KEY) as 'table' | 'cards') || 'table';
    } catch {
      return 'table';
    }
  });
  const searchRef = useRef<HTMLInputElement>(null);
  const category = params.get('categoria') ?? ALL;
  const level = params.get('nivel') ?? ALL;
  const status = params.get('estado') ?? 'active';
  const special = params.get('filtro');
  const creating = params.get('nuevo') === '1';
  const evaluating = params.get('evaluar') === '1';

  useEffect(() => {
    if (params.get('buscar') === '1') searchRef.current?.focus();
  }, [params]);

  const setParam = (k: string, v: string | null) => {
    const next = new URLSearchParams(params);
    if (v === null || v === ALL) next.delete(k);
    else next.set(k, v);
    setParams(next, { replace: true });
  };

  const filtered = useMemo(() => {
    if (!players) return [];
    const evaluated = new Set(recentEvals.map((e) => e.player_id));
    const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
    const n = norm(q.trim());
    let list = players.filter(
      (p) =>
        (!n || norm(fullName(p)).includes(n)) &&
        (category === ALL || p.category_id === category) &&
        (level === ALL || (level === 'none' ? !p.level_id : p.level_id === level)) &&
        (status === ALL || p.status === status),
    );
    if (special === 'incompletas') list = list.filter((p) => !p.birth_date || !p.level_id || !p.dominant_hand || !p.join_date);
    if (special === 'sin-ranking') list = list.filter((p) => p.ranking_points == null);
    if (special === 'sin-evaluacion') list = list.filter((p) => !evaluated.has(p.id));
    const catOrder = new Map(categories.map((c, i) => [c.id, i]));
    const cmp: Record<SortKey, (a: PlayerListItem, b: PlayerListItem) => number> = {
      name: (a, b) => fullName(a).localeCompare(fullName(b), 'es'),
      age: (a, b) => (playerAge(a).value ?? 999) - (playerAge(b).value ?? 999),
      category: (a, b) => (catOrder.get(a.category_id ?? '') ?? 99) - (catOrder.get(b.category_id ?? '') ?? 99) || cmp.name(a, b),
      ranking: (a, b) => (b.ranking_points ?? -1) - (a.ranking_points ?? -1) || cmp.name(a, b),
      join: (a, b) => (a.join_date ?? '9999').localeCompare(b.join_date ?? '9999'),
    };
    return list.sort(cmp[sort]);
  }, [players, q, category, level, status, special, sort, categories, recentEvals]);

  const changeView = (v: 'table' | 'cards') => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* sin almacenamiento */
    }
  };

  const link = (p: PlayerListItem) => (evaluating ? `/jugadores/${p.id}?tab=evaluaciones&nueva=1` : `/jugadores/${p.id}`);

  return (
    <div>
      <PageHeader
        title="Jugadores"
        description={evaluating ? 'Elige al jugador que vas a evaluar.' : 'Expedientes deportivos de la academia.'}
        actions={
          <Button onClick={() => setParam('nuevo', '1')}>
            <Plus /> Registrar jugador
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            ref={searchRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre o apellido"
            aria-label="Buscar jugador"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={category} onValueChange={(v) => setParam('categoria', v)}>
            <SelectTrigger className="min-w-36" aria-label="Filtrar por categoría">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas las categorías</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={level} onValueChange={(v) => setParam('nivel', v)}>
            <SelectTrigger className="min-w-36" aria-label="Filtrar por nivel">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos los niveles</SelectItem>
              {levels.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name}
                </SelectItem>
              ))}
              <SelectItem value="none">Sin nivel</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => setParam('estado', v === 'active' ? null : v)}>
            <SelectTrigger className="min-w-32" aria-label="Filtrar por estado">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Activos</SelectItem>
              <SelectItem value="inactive">Inactivos</SelectItem>
              <SelectItem value="archived">Archivados</SelectItem>
              <SelectItem value={ALL}>Todos los estados</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="min-w-40" aria-label="Ordenar">
              <ArrowDownUp className="size-4" aria-hidden />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Nombre</SelectItem>
              <SelectItem value="age">Edad</SelectItem>
              <SelectItem value="category">Categoría</SelectItem>
              <SelectItem value="ranking">Ranking</SelectItem>
              <SelectItem value="join">Fecha de ingreso</SelectItem>
            </SelectContent>
          </Select>
          <div className="ml-auto flex rounded-lg border p-0.5" role="group" aria-label="Vista">
            <Button variant={view === 'table' ? 'secondary' : 'ghost'} size="icon-sm" aria-pressed={view === 'table'} aria-label="Vista de tabla" onClick={() => changeView('table')}>
              <Rows3 />
            </Button>
            <Button variant={view === 'cards' ? 'secondary' : 'ghost'} size="icon-sm" aria-pressed={view === 'cards'} aria-label="Vista de tarjetas" onClick={() => changeView('cards')}>
              <LayoutGrid />
            </Button>
          </div>
        </div>
        {special && SPECIAL[special] && (
          <div>
            <Chip tone="warning">
              {SPECIAL[special]}
              <button type="button" onClick={() => setParam('filtro', null)} aria-label="Quitar filtro" className="-mr-1 rounded-full p-0.5 hover:bg-black/10">
                <X className="size-3.5" />
              </button>
            </Chip>
          </div>
        )}
      </div>

      {isLoading ? (
        <Loading />
      ) : error ? (
        <ErrorState error={error} retry={() => refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={players?.length ? 'Ningún jugador coincide con los filtros' : 'Aún no hay jugadores'}
          action={
            players?.length ? (
              <Button variant="outline" onClick={() => setParams({}, { replace: true })}>
                Quitar filtros
              </Button>
            ) : (
              <Button onClick={() => setParam('nuevo', '1')}>
                <Plus /> Registrar jugador
              </Button>
            )
          }
        />
      ) : view === 'table' ? (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Jugador</TableHead>
                <TableHead>Edad</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Nivel</TableHead>
                <TableHead className="text-right">Ranking</TableHead>
                <TableHead>Ingreso</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => {
                const age = playerAge(p);
                return (
                  <TableRow key={p.id} className="cursor-pointer" onClick={() => navigate(link(p))}>
                    <TableCell>
                      <Link to={link(p)} className="flex min-h-11 items-center gap-3 font-semibold hover:underline" onClick={(e) => e.stopPropagation()}>
                        <PlayerAvatar player={p} size={34} />
                        {fullName(p)}
                      </Link>
                    </TableCell>
                    <TableCell className={cn(!age.value && 'text-muted-foreground')}>{age.label}</TableCell>
                    <TableCell>{p.categories?.name ?? '—'}</TableCell>
                    <TableCell className={cn(!p.levels && 'text-muted-foreground')}>{p.levels?.name ?? 'Sin nivel'}</TableCell>
                    <TableCell className="numeral text-right text-[1.1rem]">{p.ranking_points ?? <span className="text-sm font-normal text-muted-foreground">Sin ranking</span>}</TableCell>
                    <TableCell>{p.join_date ? fmtDate(p.join_date) : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>
                      <StatusChip status={p.status} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <li key={p.id}>
              <Link to={link(p)} className="flex items-center gap-3 rounded-xl border bg-card p-3 hover:border-table/50">
                <PlayerAvatar player={p} size={52} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{fullName(p)}</span>
                  <span className="block text-sm text-muted-foreground">
                    {p.categories?.name ?? 'Sin categoría'}, {playerAge(p).label.toLowerCase()}
                  </span>
                  <span className="mt-1 flex flex-wrap gap-1.5">
                    <Chip tone="info">{p.levels?.name ?? 'Sin nivel'}</Chip>
                    {p.status !== 'active' && <StatusChip status={p.status} />}
                  </span>
                </span>
                {p.ranking_points != null && <span className="numeral text-[1.5rem]">{p.ranking_points}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-sm text-muted-foreground">
        {filtered.length} de {players?.length ?? 0} jugadores
      </p>

      <PlayerFormDialog
        open={creating}
        onOpenChange={(o) => !o && setParam('nuevo', null)}
        onSaved={(id) => navigate(`/jugadores/${id}`)}
      />
    </div>
  );
}
