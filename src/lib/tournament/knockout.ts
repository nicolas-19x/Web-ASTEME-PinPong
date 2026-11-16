import { nextPowerOfTwo } from './structure';
import type { BracketMatch, BracketSlot, PlayerId, Qualifier } from './types';

/** Posiciones estándar de siembra: con 8 → [1,8,4,5,2,7,3,6]. */
export function seedPositions(size: number): number[] {
  if (size < 2 || (size & (size - 1)) !== 0) throw new Error('El cuadro debe ser potencia de 2');
  let pos = [1, 2];
  while (pos.length < size) {
    const n = pos.length * 2;
    pos = pos.flatMap((s) => [s, n + 1 - s]);
  }
  return pos;
}

export function roundLabel(playersInRound: number): string {
  switch (playersInRound) {
    case 2:
      return 'Final';
    case 4:
      return 'Semifinal';
    case 8:
      return 'Cuartos de final';
    case 16:
      return 'Octavos de final';
    default:
      return `Ronda de ${playersInRound}`;
  }
}

/**
 * Orden de siembra de clasificados: primero todos los primeros de grupo,
 * luego los segundos, etc.; dentro de cada nivel, por ranking (sin ranking al final)
 * y luego por grupo.
 */
export function orderQualifiers(qualifiers: Qualifier[]): Qualifier[] {
  return qualifiers
    .slice()
    .sort(
      (x, y) =>
        x.groupPosition - y.groupPosition ||
        (y.ranking ?? -Infinity) - (x.ranking ?? -Infinity) ||
        x.groupIndex - y.groupIndex,
    );
}

export interface KnockoutOptions {
  thirdPlace: boolean;
}

export interface KnockoutBuild {
  size: number;
  matches: BracketMatch[];
  /** Cruces de primera ronda entre jugadores del mismo grupo que no se pudieron evitar. */
  sameGroupConflicts: number;
}

/**
 * Genera el cuadro. Los BYE ocupan las últimas posiciones de siembra, por lo que
 * benefician a los mejores sembrados. Después intenta evitar que dos jugadores
 * del mismo grupo se crucen en la primera ronda intercambiando jugadores del
 * mismo nivel (misma posición de grupo), sin mover a los cabezas de serie.
 */
export function buildKnockout(qualifiersIn: Qualifier[], opts: KnockoutOptions): KnockoutBuild {
  const ids = qualifiersIn.map((q) => q.playerId);
  if (new Set(ids).size !== ids.length) throw new Error('Clasificado duplicado');
  if (qualifiersIn.length < 2) throw new Error('Se necesitan al menos 2 clasificados');
  const qualifiers = orderQualifiers(qualifiersIn);
  const size = nextPowerOfTwo(qualifiers.length);
  const positions = seedPositions(size);
  // slots[i] = qualifier o null (BYE)
  const slots: (Qualifier | null)[] = positions.map((seed) => qualifiers[seed - 1] ?? null);

  const conflictAt = (m: number) => {
    const a = slots[2 * m];
    const b = slots[2 * m + 1];
    return !!a && !!b && a.groupIndex === b.groupIndex;
  };
  const matchCount = size / 2;
  for (let m = 0; m < matchCount; m++) {
    if (!conflictAt(m)) continue;
    // Mueve al de peor siembra del cruce (posición impar dentro del par) y solo
    // lo intercambia con alguien de su mismo nivel, para no alterar cabezas de serie.
    const i = 2 * m + 1;
    const mover = slots[i]!;
    let fixed = false;
    for (let j = 0; j < size && !fixed; j++) {
      const other = slots[j];
      if (j === i || !other || other.groupPosition !== mover.groupPosition) continue;
      const mj = Math.floor(j / 2);
      if (mj === m) continue;
      [slots[i], slots[j]] = [slots[j], slots[i]];
      if (!conflictAt(m) && !conflictAt(mj)) fixed = true;
      else [slots[i], slots[j]] = [slots[j], slots[i]];
    }
  }
  let sameGroupConflicts = 0;
  for (let m = 0; m < matchCount; m++) if (conflictAt(m)) sameGroupConflicts++;

  const rounds = Math.log2(size);
  const matches: BracketMatch[] = [];
  const toSlot = (q: Qualifier | null): BracketSlot => (q ? { kind: 'player', playerId: q.playerId } : { kind: 'bye' });
  for (let r = 1; r <= rounds; r++) {
    const count = size / 2 ** r;
    const label = roundLabel(count * 2);
    for (let p = 1; p <= count; p++) {
      const key = `KO-R${r}-M${p}`;
      if (r === 1) {
        matches.push({ key, round: r, position: p, a: toSlot(slots[2 * (p - 1)]), b: toSlot(slots[2 * (p - 1) + 1]), winner: null, label });
      } else {
        matches.push({
          key,
          round: r,
          position: p,
          a: { kind: 'winner', matchKey: `KO-R${r - 1}-M${2 * p - 1}` },
          b: { kind: 'winner', matchKey: `KO-R${r - 1}-M${2 * p}` },
          winner: null,
          label,
        });
      }
    }
  }
  if (opts.thirdPlace && size >= 4) {
    const sf = rounds - 1;
    matches.push({
      key: 'KO-3P',
      round: rounds,
      position: 2,
      a: { kind: 'loser', matchKey: `KO-R${sf}-M1` },
      b: { kind: 'loser', matchKey: `KO-R${sf}-M2` },
      winner: null,
      isThirdPlace: true,
      label: 'Tercer lugar',
    });
  }
  return { size, matches, sameGroupConflicts };
}

export interface ResolvedBracketMatch extends BracketMatch {
  playerA: PlayerId | null;
  playerB: PlayerId | null;
  /** Se juega solo cuando ambos jugadores están definidos y ninguno es BYE. */
  playable: boolean;
  /** Avance automático por BYE. */
  byeAdvance: boolean;
  /** El ganador guardado ya no coincide con los participantes (tras una corrección). */
  stale: boolean;
  loser: PlayerId | null;
}

/**
 * Resuelve el cuadro a partir de los ganadores guardados (`winners[key]`).
 * Los BYE avanzan solos; si se corrige un resultado anterior, los resultados
 * posteriores que ya no corresponden quedan marcados como `stale` y se ignoran.
 */
export function resolveBracket(matches: BracketMatch[], winners: Record<string, PlayerId | null | undefined>): ResolvedBracketMatch[] {
  const byKey = new Map<string, ResolvedBracketMatch>();
  const ordered = matches.slice().sort((x, y) => x.round - y.round || Number(!!x.isThirdPlace) - Number(!!y.isThirdPlace) || x.position - y.position);
  const pick = (s: BracketSlot): { id: PlayerId | null; bye: boolean } => {
    switch (s.kind) {
      case 'player':
        return { id: s.playerId, bye: false };
      case 'bye':
        return { id: null, bye: true };
      case 'empty':
        return { id: null, bye: false };
      case 'winner': {
        const src = byKey.get(s.matchKey);
        return { id: src?.winner ?? null, bye: false };
      }
      case 'loser': {
        const src = byKey.get(s.matchKey);
        return { id: src?.loser ?? null, bye: false };
      }
    }
  };
  for (const m of ordered) {
    const A = pick(m.a);
    const B = pick(m.b);
    let winner: PlayerId | null = null;
    let byeAdvance = false;
    let stale = false;
    if (A.bye && B.id) {
      winner = B.id;
      byeAdvance = true;
    } else if (B.bye && A.id) {
      winner = A.id;
      byeAdvance = true;
    } else {
      const saved = winners[m.key] ?? null;
      if (saved && (saved === A.id || saved === B.id) && A.id && B.id) winner = saved;
      else if (saved) stale = true;
    }
    const loser = winner && !byeAdvance ? (winner === A.id ? B.id : A.id) : null;
    byKey.set(m.key, {
      ...m,
      playerA: A.id,
      playerB: B.id,
      playable: !!A.id && !!B.id,
      byeAdvance,
      stale,
      winner,
      loser,
    });
  }
  return matches.map((m) => byKey.get(m.key)!);
}

export interface Podium {
  champion: PlayerId | null;
  runnerUp: PlayerId | null;
  third: PlayerId[];
}

export function podium(resolved: ResolvedBracketMatch[]): Podium {
  const finalRound = Math.max(...resolved.filter((m) => !m.isThirdPlace).map((m) => m.round));
  const final = resolved.find((m) => m.round === finalRound && !m.isThirdPlace);
  const third = resolved.find((m) => m.isThirdPlace);
  const semis = resolved.filter((m) => m.round === finalRound - 1 && !m.isThirdPlace);
  return {
    champion: final?.winner ?? null,
    runnerUp: final?.loser ?? null,
    third: third
      ? third.winner
        ? [third.winner]
        : []
      : semis.map((s) => s.loser).filter((x): x is PlayerId => !!x),
  };
}
