import { createRng, shuffle } from './rng';
import type { Entrant, PlayerId, SeedTieMode } from './types';

export interface SeedOrderOptions {
  /** Cómo ordenar empates de ranking y jugadores sin ranking. */
  tieMode: SeedTieMode;
  /** Semilla del sorteo (modo `random`). */
  seed: number;
  /**
   * Orden manual definido por el entrenador (ids). Se usa en modo `manual`
   * para desempatar y para ubicar a quienes no tienen ranking.
   */
  manualOrder?: PlayerId[];
}

export interface SeedOrderResult {
  ordered: Entrant[];
  /** Jugadores sin ranking: se identifican, nunca se les asigna un valor. */
  unranked: Entrant[];
  /** Grupos de ids que compartían el mismo ranking. */
  rankingTies: PlayerId[][];
}

/**
 * Ordena por ranking descendente. Los empates y los jugadores sin ranking se
 * resuelven por sorteo (con semilla) u orden manual; los sin ranking van al final.
 */
export function orderForSeeding(entrants: Entrant[], opts: SeedOrderOptions): SeedOrderResult {
  assertUnique(entrants);
  const rng = createRng(opts.seed);
  const manualIndex = new Map((opts.manualOrder ?? []).map((id, i) => [id, i]));
  const byManual = (x: Entrant, y: Entrant) =>
    (manualIndex.get(x.id) ?? Number.MAX_SAFE_INTEGER) - (manualIndex.get(y.id) ?? Number.MAX_SAFE_INTEGER) ||
    x.name.localeCompare(y.name, 'es');

  const resolve = (bucket: Entrant[]): Entrant[] =>
    opts.tieMode === 'manual' ? bucket.slice().sort(byManual) : shuffle(bucket, rng);

  const ranked = entrants.filter((e) => e.ranking !== null);
  const unranked = entrants.filter((e) => e.ranking === null);

  const buckets = new Map<number, Entrant[]>();
  for (const e of ranked) {
    const k = e.ranking as number;
    buckets.set(k, [...(buckets.get(k) ?? []), e]);
  }
  const values = [...buckets.keys()].sort((a, b) => b - a);
  const rankingTies: PlayerId[][] = [];
  const ordered: Entrant[] = [];
  for (const v of values) {
    const bucket = buckets.get(v)!;
    if (bucket.length > 1) rankingTies.push(bucket.map((e) => e.id));
    ordered.push(...resolve(bucket));
  }
  ordered.push(...resolve(unranked));
  return { ordered, unranked, rankingTies };
}

/**
 * Reparto en serpentina: el primero de cada grupo es cabeza de serie y luego
 * se alterna el sentido. Con 4 grupos: A-B-C-D, D-C-B-A, A-B-C-D…
 */
export function snakeDistribute<T>(ordered: T[], groupCount: number): T[][] {
  if (groupCount < 1) throw new Error('Debe haber al menos un grupo');
  const groups: T[][] = Array.from({ length: groupCount }, () => []);
  ordered.forEach((item, i) => {
    const pass = Math.floor(i / groupCount);
    const offset = i % groupCount;
    const g = pass % 2 === 0 ? offset : groupCount - 1 - offset;
    groups[g].push(item);
  });
  return groups;
}

export function groupLetter(index: number): string {
  let s = '';
  let n = index;
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

export function rankingSum(group: Entrant[]): number {
  return group.reduce((acc, e) => acc + (e.ranking ?? 0), 0);
}

function assertUnique(entrants: Entrant[]) {
  const seen = new Set<string>();
  for (const e of entrants) {
    if (seen.has(e.id)) throw new Error(`Jugador duplicado en la inscripción: ${e.name}`);
    seen.add(e.id);
  }
}
