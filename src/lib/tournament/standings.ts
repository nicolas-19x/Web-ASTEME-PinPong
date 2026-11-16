import type { MatchResultInput, PlayerId, StandingRow, TiebreakCriterion } from './types';
import { DEFAULT_TIEBREAKERS } from './types';

export interface StandingsOptions {
  criteria?: TiebreakCriterion[];
  /** Orden manual documentado por el entrenador (criterio `manual`). */
  manualOrder?: PlayerId[];
  /** Orden de siembra: último recurso cuando el empate no se resuelve. */
  seedOrder?: PlayerId[];
  points?: { win: number; loss: number; walkoverLoss: number };
}

interface Acc {
  played: number;
  won: number;
  lost: number;
  setsFor: number;
  setsAgainst: number;
  pointsFor: number;
  pointsAgainst: number;
  cp: number;
}

/**
 * Tabla de posiciones de un grupo. Solo cuenta partidos con ganador.
 * Desempate jerárquico: cuando un criterio separa a un bloque empatado, cada
 * sub-bloque vuelve a evaluarse desde el inicio (el "resultado directo" se
 * recalcula solo entre quienes siguen empatados).
 * Las diferencias de sets y puntos se calculan sobre todos los partidos del grupo.
 */
export function computeStandings(
  players: PlayerId[],
  results: MatchResultInput[],
  opts: StandingsOptions = {},
): StandingRow[] {
  const criteria = opts.criteria?.length ? opts.criteria : DEFAULT_TIEBREAKERS;
  const pts = opts.points ?? { win: 2, loss: 1, walkoverLoss: 0 };
  const seedIdx = new Map((opts.seedOrder ?? players).map((id, i) => [id, i]));
  const manualIdx = new Map((opts.manualOrder ?? []).map((id, i) => [id, i]));
  const inGroup = new Set(players);
  const decided = results.filter((r) => r.winner && inGroup.has(r.a) && inGroup.has(r.b));

  const acc = new Map<PlayerId, Acc>(
    players.map((p) => [p, { played: 0, won: 0, lost: 0, setsFor: 0, setsAgainst: 0, pointsFor: 0, pointsAgainst: 0, cp: 0 }]),
  );
  for (const r of decided) {
    const loser = r.winner === r.a ? r.b : r.a;
    const w = acc.get(r.winner!)!;
    const l = acc.get(loser)!;
    w.played++;
    l.played++;
    w.won++;
    l.lost++;
    w.cp += pts.win;
    l.cp += r.walkover ? pts.walkoverLoss : pts.loss;
    for (const s of r.sets) {
      const [pa, pb] = [s.a, s.b];
      const A = acc.get(r.a)!;
      const B = acc.get(r.b)!;
      A.pointsFor += pa;
      A.pointsAgainst += pb;
      B.pointsFor += pb;
      B.pointsAgainst += pa;
      if (pa > pb) {
        A.setsFor++;
        B.setsAgainst++;
      } else if (pb > pa) {
        B.setsFor++;
        A.setsAgainst++;
      }
    }
  }

  const value = (id: PlayerId, c: TiebreakCriterion, subset: Set<PlayerId>): number => {
    const a = acc.get(id)!;
    switch (c) {
      case 'wins':
        return a.won;
      case 'head_to_head':
        return decided.filter((r) => r.winner === id && subset.has(r.a) && subset.has(r.b)).length;
      case 'set_diff':
        return a.setsFor - a.setsAgainst;
      case 'point_diff':
        return a.pointsFor - a.pointsAgainst;
      case 'manual':
        return -(manualIdx.get(id) ?? Number.MAX_SAFE_INTEGER);
    }
  };

  const decidedBy = new Map<PlayerId, StandingRow['decidedBy']>();
  const unresolved = new Set<PlayerId>();
  const bySeed = (x: PlayerId, y: PlayerId) => (seedIdx.get(x) ?? 1e9) - (seedIdx.get(y) ?? 1e9);

  const rank = (ids: PlayerId[], from: number): PlayerId[] => {
    if (ids.length <= 1) return ids;
    for (let ci = from; ci < criteria.length; ci++) {
      const c = criteria[ci];
      if (c === 'manual' && !ids.every((id) => manualIdx.has(id))) continue;
      const subset = new Set(ids);
      const vals = new Map(ids.map((id) => [id, value(id, c, subset)]));
      const distinct = [...new Set(vals.values())].sort((x, y) => y - x);
      if (distinct.length === 1) continue;
      const out: PlayerId[] = [];
      for (const v of distinct) {
        const part = ids.filter((id) => vals.get(id) === v);
        part.forEach((id) => decidedBy.set(id, c));
        out.push(...rank(part, 0));
      }
      return out;
    }
    // Ningún criterio separa: se marca para decisión manual y se usa la siembra.
    ids.forEach((id) => {
      unresolved.add(id);
      decidedBy.set(id, 'seed');
    });
    return ids.slice().sort(bySeed);
  };

  const ordered = rank(players.slice().sort(bySeed), 0);
  return ordered.map((id, i) => {
    const a = acc.get(id)!;
    return {
      playerId: id,
      position: i + 1,
      played: a.played,
      won: a.won,
      lost: a.lost,
      setsFor: a.setsFor,
      setsAgainst: a.setsAgainst,
      setDiff: a.setsFor - a.setsAgainst,
      pointsFor: a.pointsFor,
      pointsAgainst: a.pointsAgainst,
      pointDiff: a.pointsFor - a.pointsAgainst,
      classificationPoints: a.cp,
      unresolvedTie: unresolved.has(id),
      decidedBy: decidedBy.get(id) ?? null,
    };
  });
}
