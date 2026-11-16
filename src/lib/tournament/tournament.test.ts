import { describe, expect, it } from 'vitest';
import {
  buildKnockout,
  checkSet,
  computeStandings,
  evaluateMatch,
  groupMatches,
  orderForSeeding,
  planTournament,
  podium,
  qualifiersFromStandings,
  resolveBracket,
  roundRobin,
  scheduleOnTables,
  seedPositions,
  snakeDistribute,
  suggestStructure,
  DEFAULT_RULES,
  type Entrant,
  type GroupMatch,
  type MatchResultInput,
} from './index';

// Datos ficticios SOLO para pruebas: nunca se mezclan con expedientes reales.
const fake = (n: number, ranking: (i: number) => number | null = (i) => 1000 - i * 10): Entrant[] =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, name: `Prueba ${i + 1}`, ranking: ranking(i) }));

function assertGroupStageInvariants(groups: string[][], matches: GroupMatch[], tables: number) {
  // 1) Cada pareja del grupo juega exactamente una vez; sin partidos de más.
  groups.forEach((g, gi) => {
    const gm = matches.filter((m) => m.groupIndex === gi);
    expect(gm.length).toBe((g.length * (g.length - 1)) / 2);
    const seen = new Set<string>();
    for (const m of gm) {
      expect(m.a).not.toBe(m.b);
      expect(g).toContain(m.a);
      expect(g).toContain(m.b);
      const k = [m.a, m.b].sort().join('|');
      expect(seen.has(k)).toBe(false);
      seen.add(k);
    }
    // 2) Nadie juega dos veces en la misma jornada.
    const rounds = new Map<number, string[]>();
    gm.forEach((m) => rounds.set(m.round, [...(rounds.get(m.round) ?? []), m.a, m.b]));
    rounds.forEach((ps) => expect(new Set(ps).size).toBe(ps.length));
  });
  // 3) Nadie omitido.
  const everyone = groups.flat();
  for (const p of everyone) {
    if (groups.find((g) => g.includes(p))!.length > 1) expect(matches.some((m) => m.a === p || m.b === p)).toBe(true);
  }
  // 4) Turnos: sin solapamiento de jugador y sin exceder mesas.
  const slots = new Map<number, GroupMatch[]>();
  matches.forEach((m) => slots.set(m.slot!, [...(slots.get(m.slot!) ?? []), m]));
  slots.forEach((ms) => {
    expect(ms.length).toBeLessThanOrEqual(tables);
    const ps = ms.flatMap((m) => [m.a, m.b]);
    expect(new Set(ps).size).toBe(ps.length);
    expect(new Set(ms.map((m) => m.table)).size).toBe(ms.length);
  });
}

describe('round robin', () => {
  it('grupo de 4: 6 partidos en 3 jornadas', () => {
    const rr = roundRobin(['a', 'b', 'c', 'd']);
    expect(rr).toHaveLength(3);
    expect(rr.flatMap((r) => r.pairs)).toHaveLength(6);
    rr.forEach((r) => expect(r.bye).toBeNull());
  });
  it('grupo impar: cada jugador descansa (BYE) exactamente una vez', () => {
    const rr = roundRobin(['a', 'b', 'c', 'd', 'e']);
    expect(rr).toHaveLength(5);
    expect(rr.flatMap((r) => r.pairs)).toHaveLength(10);
    expect(rr.map((r) => r.bye).sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
  it('rechaza jugadores duplicados', () => {
    expect(() => roundRobin(['a', 'a', 'b'])).toThrow();
  });
  for (const n of [2, 3, 4, 5, 6, 7, 8]) {
    it(`todas las parejas una sola vez con ${n} jugadores`, () => {
      const ids = Array.from({ length: n }, (_, i) => `x${i}`);
      const pairs = roundRobin(ids).flatMap((r) => r.pairs.map((p) => p.slice().sort().join('|')));
      expect(new Set(pairs).size).toBe((n * (n - 1)) / 2);
      expect(pairs.length).toBe((n * (n - 1)) / 2);
    });
  }
});

describe('siembra y serpentina', () => {
  it('4 grupos: A-B-C-D, D-C-B-A, A-B-C-D', () => {
    const g = snakeDistribute([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 4);
    expect(g).toEqual([
      [1, 8, 9],
      [2, 7, 10],
      [3, 6, 11],
      [4, 5, 12],
    ]);
  });
  it('ordena por ranking descendente y deja sin ranking al final sin inventar puntos', () => {
    const e = fake(6, (i) => (i % 2 === 0 ? 100 + i : null));
    const r = orderForSeeding(e, { tieMode: 'random', seed: 7 });
    expect(r.unranked.map((x) => x.id).sort()).toEqual(['p2', 'p4', 'p6']);
    expect(r.ordered.slice(0, 3).map((x) => x.ranking)).toEqual([104, 102, 100]);
    expect(r.ordered.slice(3).every((x) => x.ranking === null)).toBe(true);
  });
  it('empates de ranking: sorteo reproducible con la misma semilla', () => {
    const e = fake(8, () => 500);
    const a = orderForSeeding(e, { tieMode: 'random', seed: 42 }).ordered.map((x) => x.id);
    const b = orderForSeeding(e, { tieMode: 'random', seed: 42 }).ordered.map((x) => x.id);
    expect(a).toEqual(b);
    expect(orderForSeeding(e, { tieMode: 'random', seed: 42 }).rankingTies).toHaveLength(1);
  });
  it('empates en modo manual respetan el orden del entrenador', () => {
    const e = fake(3, () => null);
    const r = orderForSeeding(e, { tieMode: 'manual', seed: 1, manualOrder: ['p3', 'p1', 'p2'] });
    expect(r.ordered.map((x) => x.id)).toEqual(['p3', 'p1', 'p2']);
  });
  it('todos sin ranking (estado inicial real): funciona por sorteo', () => {
    const plan = planTournament({ entrants: fake(12, () => null), groupCount: 3, tables: 3, tieMode: 'random', seed: 9 });
    expect(plan.unranked).toHaveLength(12);
    expect(plan.groups.flat()).toHaveLength(12);
  });
  it('rechaza inscripciones duplicadas', () => {
    const e = fake(3);
    expect(() => orderForSeeding([...e, e[0]], { tieMode: 'random', seed: 1 })).toThrow(/duplicado/);
  });
});

describe('estructura sugerida', () => {
  it.each([
    [4, 1],
    [5, 1],
    [8, 2],
    [12, 3],
    [16, 4],
  ])('%i participantes → %i grupos', (n, g) => {
    const s = suggestStructure(n);
    expect(s.groupCount).toBe(g);
    expect(s.groupSizes.reduce((a, b) => a + b, 0)).toBe(n);
    expect(Math.min(...s.groupSizes)).toBeGreaterThanOrEqual(n <= 5 ? n : 3);
  });
  it('nunca sugiere grupos de 2', () => {
    for (let n = 6; n <= 30; n++) expect(Math.min(...suggestStructure(n).groupSizes)).toBeGreaterThanOrEqual(3);
  });
});

describe('torneos completos con 4, 5, 8, 12 y 16 participantes', () => {
  const cases: [number, number, number][] = [
    [4, 1, 2],
    [5, 1, 2],
    [8, 2, 2],
    [12, 3, 3],
    [12, 4, 2], // grupos de 3 (impares)
    [16, 4, 4],
    [16, 3, 4], // grupos 6-5-5: pares e impares
  ];
  for (const [n, groups, tables] of cases) {
    it(`${n} jugadores, ${groups} grupo(s), ${tables} mesas`, () => {
      const plan = planTournament({ entrants: fake(n), groupCount: groups, tables, tieMode: 'random', seed: n });
      const ids = plan.groups.map((g) => g.map((e) => e.id));
      expect(ids.flat().sort()).toEqual(fake(n).map((e) => e.id).sort());
      assertGroupStageInvariants(ids, plan.matches, tables);
      // Cabezas de serie: los mejores rankings encabezan grupos distintos.
      const heads = plan.groups.map((g) => g[0].id).sort();
      expect(heads).toEqual(plan.seedOrder.slice(0, groups).map((e) => e.id).sort());
    });
  }
});

describe('marcador', () => {
  it('valida sets a 11 con diferencia de 2', () => {
    expect(checkSet({ a: 11, b: 9 }, DEFAULT_RULES).ok).toBe(true);
    expect(checkSet({ a: 11, b: 10 }, DEFAULT_RULES).ok).toBe(false);
    expect(checkSet({ a: 12, b: 10 }, DEFAULT_RULES).ok).toBe(true);
    expect(checkSet({ a: 13, b: 10 }, DEFAULT_RULES).ok).toBe(false);
    expect(checkSet({ a: 10, b: 8 }, DEFAULT_RULES).ok).toBe(false);
    expect(checkSet({ a: 3, b: 11 }, DEFAULT_RULES)).toEqual({ ok: true, winner: 'b' });
    expect(checkSet({ a: -1, b: 11 }, DEFAULT_RULES).ok).toBe(false);
  });
  it('mejor de 3: decide con 2 sets', () => {
    const r = evaluateMatch([{ a: 11, b: 5 }, { a: 9, b: 11 }, { a: 11, b: 7 }], DEFAULT_RULES);
    expect(r).toMatchObject({ valid: true, winner: 'a', setsA: 2, setsB: 1, status: 'complete' });
  });
  it('detecta sets sobrantes', () => {
    const r = evaluateMatch([{ a: 11, b: 5 }, { a: 11, b: 3 }, { a: 11, b: 7 }], DEFAULT_RULES);
    expect(r.valid).toBe(false);
  });
  it('mejor de 5', () => {
    const rules = { ...DEFAULT_RULES, bestOf: 5 };
    const r = evaluateMatch([{ a: 11, b: 5 }, { a: 11, b: 3 }], rules);
    expect(r.status).toBe('in_progress');
    const done = evaluateMatch([{ a: 11, b: 5 }, { a: 11, b: 3 }, { a: 14, b: 12 }], rules);
    expect(done.winner).toBe('a');
  });
  it('sets a 21 configurables', () => {
    expect(checkSet({ a: 21, b: 19 }, { pointsPerSet: 21, minLead: 2, bestOf: 3 }).ok).toBe(true);
  });
});

const res = (a: string, b: string, sets: [number, number][]): MatchResultInput => {
  const e = evaluateMatch(sets.map(([x, y]) => ({ a: x, b: y })), DEFAULT_RULES);
  return { a, b, sets: sets.map(([x, y]) => ({ a: x, b: y })), winner: e.winner === 'a' ? a : b };
};

describe('clasificación y desempates', () => {
  it('ordena por partidos ganados', () => {
    const t = computeStandings(['a', 'b', 'c'], [
      res('a', 'b', [[11, 5], [11, 5]]),
      res('a', 'c', [[11, 5], [11, 5]]),
      res('b', 'c', [[11, 5], [11, 5]]),
    ]);
    expect(t.map((r) => r.playerId)).toEqual(['a', 'b', 'c']);
    expect(t[0]).toMatchObject({ played: 2, won: 2, lost: 0, setsFor: 4, setsAgainst: 0, classificationPoints: 4 });
    expect(t[2].classificationPoints).toBe(2);
  });
  it('empate de dos: decide el resultado directo', () => {
    // a y b con 2 victorias; b ganó a a pese a peor diferencia de sets.
    const t = computeStandings(['a', 'b', 'c', 'd'], [
      res('a', 'b', [[5, 11], [9, 11]]),
      res('a', 'c', [[11, 0], [11, 0]]),
      res('a', 'd', [[11, 0], [11, 0]]),
      res('b', 'c', [[11, 9], [9, 11], [11, 9]]),
      res('b', 'd', [[5, 11], [5, 11]]),
      res('c', 'd', [[11, 5], [11, 5]]),
    ]);
    // a=2V, b=2V, c=1V, d=1V
    expect(t[0].playerId).toBe('b');
    expect(t[0].decidedBy).toBe('head_to_head');
    expect(t[1].playerId).toBe('a');
  });
  it('triple empate circular: se resuelve por diferencia de sets', () => {
    const t = computeStandings(['a', 'b', 'c'], [
      res('a', 'b', [[11, 5], [11, 5]]), // a 2-0
      res('b', 'c', [[11, 5], [5, 11], [11, 5]]), // b 2-1
      res('c', 'a', [[11, 5], [5, 11], [11, 5]]), // c 2-1
    ]);
    // sets: a 3-2 (+1), b 2-3 (-1), c 3-3... calculado: c: vs b 1-2, vs a 2-1 → 3-3 (0)
    expect(t.map((r) => r.playerId)).toEqual(['a', 'c', 'b']);
    expect(t.every((r) => !r.unresolvedTie)).toBe(true);
  });
  it('triple empate idéntico: usa criterio manual del entrenador', () => {
    const results = [
      res('a', 'b', [[11, 5], [5, 11], [11, 5]]),
      res('b', 'c', [[11, 5], [5, 11], [11, 5]]),
      res('c', 'a', [[11, 5], [5, 11], [11, 5]]),
    ];
    const auto = computeStandings(['a', 'b', 'c'], results);
    expect(auto.every((r) => r.unresolvedTie)).toBe(true);
    const manual = computeStandings(['a', 'b', 'c'], results, { manualOrder: ['c', 'a', 'b'] });
    expect(manual.map((r) => r.playerId)).toEqual(['c', 'a', 'b']);
    expect(manual.every((r) => !r.unresolvedTie)).toBe(true);
  });
  it('walkover: el perdedor no suma punto de clasificación', () => {
    const t = computeStandings(['a', 'b'], [{ a: 'a', b: 'b', sets: [], winner: 'a', walkover: true }]);
    expect(t[1]).toMatchObject({ playerId: 'b', lost: 1, classificationPoints: 0 });
  });
  it('corrección de resultado: la tabla se recalcula', () => {
    const before = computeStandings(['a', 'b'], [res('a', 'b', [[11, 5], [11, 5]])]);
    const after = computeStandings(['a', 'b'], [res('a', 'b', [[5, 11], [5, 11]])]);
    expect(before[0].playerId).toBe('a');
    expect(after[0].playerId).toBe('b');
  });
});

describe('eliminación directa', () => {
  it('posiciones de siembra estándar', () => {
    expect(seedPositions(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });
  it('6 clasificados: BYE para los 2 primeros cabezas de serie', () => {
    const q = Array.from({ length: 6 }, (_, i) => ({ playerId: `q${i + 1}`, groupIndex: i % 3, groupPosition: i < 3 ? 1 : 2, ranking: 100 - i }));
    const ko = buildKnockout(q, { thirdPlace: true });
    expect(ko.size).toBe(8);
    const r1 = ko.matches.filter((m) => m.round === 1);
    const byes = r1.filter((m) => m.a.kind === 'bye' || m.b.kind === 'bye');
    expect(byes).toHaveLength(2);
    const byeBeneficiaries = byes.map((m) => (m.a.kind === 'player' ? m.a.playerId : m.b.kind === 'player' ? m.b.playerId : null));
    expect(byeBeneficiaries.sort()).toEqual(['q1', 'q2']);
    const resolved = resolveBracket(ko.matches, {});
    expect(resolved.filter((m) => m.byeAdvance).map((m) => m.winner).sort()).toEqual(['q1', 'q2']);
  });
  it('evita cruces del mismo grupo en primera ronda', () => {
    // 4 grupos, 2 por grupo; ranking pensado para provocar conflicto inicial.
    const q = [0, 1, 2, 3].flatMap((g) => [
      { playerId: `w${g}`, groupIndex: g, groupPosition: 1, ranking: 100 - g },
      { playerId: `r${g}`, groupIndex: g, groupPosition: 2, ranking: 100 - (3 - g) },
    ]);
    const ko = buildKnockout(q, { thirdPlace: false });
    expect(ko.sameGroupConflicts).toBe(0);
    const group = new Map(q.map((x) => [x.playerId, x.groupIndex]));
    for (const m of ko.matches.filter((m) => m.round === 1)) {
      if (m.a.kind === 'player' && m.b.kind === 'player') expect(group.get(m.a.playerId)).not.toBe(group.get(m.b.playerId));
    }
  });
  it('avanza ganadores automáticamente, partido por tercer lugar y podio', () => {
    const q = Array.from({ length: 4 }, (_, i) => ({ playerId: `q${i + 1}`, groupIndex: i, groupPosition: 1, ranking: 10 - i }));
    const ko = buildKnockout(q, { thirdPlace: true });
    let r = resolveBracket(ko.matches, {});
    const sf = r.filter((m) => m.round === 1);
    const winners: Record<string, string> = {};
    sf.forEach((m) => (winners[m.key] = m.playerA!));
    r = resolveBracket(ko.matches, winners);
    const final = r.find((m) => m.label === 'Final')!;
    expect(final.playerA).toBe(sf[0].playerA);
    expect(final.playerB).toBe(sf[1].playerA);
    const third = r.find((m) => m.isThirdPlace)!;
    expect([third.playerA, third.playerB].sort()).toEqual([sf[0].playerB, sf[1].playerB].sort());
    winners[final.key] = final.playerB!;
    winners[third.key] = third.playerA!;
    const p = podium(resolveBracket(ko.matches, winners));
    expect(p.champion).toBe(final.playerB);
    expect(p.runnerUp).toBe(final.playerA);
    expect(p.third).toEqual([third.playerA]);
  });
  it('corregir una semifinal invalida la final guardada (stale)', () => {
    const q = Array.from({ length: 4 }, (_, i) => ({ playerId: `q${i + 1}`, groupIndex: i, groupPosition: 1, ranking: 10 - i }));
    const ko = buildKnockout(q, { thirdPlace: false });
    const r0 = resolveBracket(ko.matches, {});
    const [s1, s2] = r0.filter((m) => m.round === 1);
    const w: Record<string, string> = { [s1.key]: s1.playerA!, [s2.key]: s2.playerA! };
    const fin = resolveBracket(ko.matches, w).find((m) => m.label === 'Final')!;
    w[fin.key] = fin.playerA!;
    w[s1.key] = s1.playerB!; // corrección
    const after = resolveBracket(ko.matches, w).find((m) => m.label === 'Final')!;
    expect(after.playerA).toBe(s1.playerB);
    expect(after.stale).toBe(true);
    expect(after.winner).toBeNull();
  });
  it.each([2, 3, 5, 7, 8, 12, 16])('%i clasificados: cuadro válido y cada jugador aparece una vez', (n) => {
    const q = Array.from({ length: n }, (_, i) => ({ playerId: `q${i}`, groupIndex: i % 4, groupPosition: Math.floor(i / 4) + 1, ranking: null }));
    const ko = buildKnockout(q, { thirdPlace: true });
    const r1 = ko.matches.filter((m) => m.round === 1);
    const ps = r1.flatMap((m) => [m.a, m.b]).filter((s) => s.kind === 'player').map((s) => (s.kind === 'player' ? s.playerId : ''));
    expect(ps.sort()).toEqual(q.map((x) => x.playerId).sort());
    // Nunca BYE contra BYE.
    r1.forEach((m) => expect(m.a.kind === 'bye' && m.b.kind === 'bye').toBe(false));
  });
});

describe('integración grupos → eliminatoria', () => {
  it('12 jugadores, 3 grupos, avanzan 2: simula todo y obtiene campeón', () => {
    const entrants = fake(12);
    const plan = planTournament({ entrants, groupCount: 3, tables: 4, tieMode: 'random', seed: 5 });
    const rank = new Map(entrants.map((e) => [e.id, e.ranking]));
    // Gana siempre el de mejor ranking.
    const results = plan.matches.map((m) => (rank.get(m.a)! > rank.get(m.b)! ? res(m.a, m.b, [[11, 6], [11, 6]]) : res(m.a, m.b, [[6, 11], [6, 11]])));
    const standings = plan.groups.map((g) => computeStandings(g.map((e) => e.id), results));
    standings.forEach((t, gi) => expect(t[0].playerId).toBe(plan.groups[gi][0].id));
    const q = qualifiersFromStandings(standings, 2, (id) => rank.get(id) ?? null);
    const ko = buildKnockout(q, { thirdPlace: true });
    const w: Record<string, string> = {};
    for (let i = 0; i < 6; i++) {
      for (const m of resolveBracket(ko.matches, w)) {
        if (m.playable && !m.winner) w[m.key] = rank.get(m.playerA!)! > rank.get(m.playerB!)! ? m.playerA! : m.playerB!;
      }
    }
    expect(podium(resolveBracket(ko.matches, w)).champion).toBe('p1');
  });
  it('mover jugadores manualmente reprograma sin duplicados', () => {
    const g = groupMatches([['a', 'b', 'c'], ['d', 'e', 'f', 'g']]);
    const s = scheduleOnTables(g, 2);
    expect(s).toHaveLength(3 + 6);
    assertGroupStageInvariants([['a', 'b', 'c'], ['d', 'e', 'f', 'g']], s, 2);
  });
});
