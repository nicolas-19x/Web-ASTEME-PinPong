import type { MatchRules, PlayerId, SetScore } from './types';

export type SetCheck = { ok: true; winner: 'a' | 'b' } | { ok: false; error: string };

/** Valida un set: llegar a 11 (o lo configurado) con 2 de diferencia; en deuce se gana por exactamente 2. */
export function checkSet(set: SetScore, rules: MatchRules): SetCheck {
  const { a, b } = set;
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0)
    return { ok: false, error: 'Los puntos deben ser números enteros positivos' };
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  if (hi < rules.pointsPerSet) return { ok: false, error: `Un set se gana con ${rules.pointsPerSet} puntos` };
  if (hi - lo < rules.minLead) return { ok: false, error: `Se necesita una diferencia mínima de ${rules.minLead}` };
  if (hi > rules.pointsPerSet && hi - lo !== rules.minLead)
    return { ok: false, error: `Después de ${rules.pointsPerSet - 1} iguales se gana por ${rules.minLead} exactos` };
  return { ok: true, winner: a > b ? 'a' : 'b' };
}

export interface MatchEvaluation {
  valid: boolean;
  errors: string[];
  setsA: number;
  setsB: number;
  pointsA: number;
  pointsB: number;
  /** `complete` cuando alguien alcanzó los sets necesarios. */
  status: 'pending' | 'in_progress' | 'complete';
  winner: 'a' | 'b' | null;
}

export function setsToWin(rules: MatchRules): number {
  return Math.floor(rules.bestOf / 2) + 1;
}

/** Calcula ganador de cada set y del partido; detecta sets sobrantes tras decidir. */
export function evaluateMatch(sets: SetScore[], rules: MatchRules): MatchEvaluation {
  const need = setsToWin(rules);
  const errors: string[] = [];
  let setsA = 0;
  let setsB = 0;
  let pointsA = 0;
  let pointsB = 0;
  let winner: 'a' | 'b' | null = null;
  sets.forEach((s, i) => {
    pointsA += s.a;
    pointsB += s.b;
    if (winner) {
      errors.push(`El set ${i + 1} sobra: el partido ya estaba decidido`);
      return;
    }
    const c = checkSet(s, rules);
    if (!c.ok) {
      errors.push(`Set ${i + 1}: ${c.error}`);
      return;
    }
    if (c.winner === 'a') setsA++;
    else setsB++;
    if (setsA === need) winner = 'a';
    if (setsB === need) winner = 'b';
  });
  if (sets.length > rules.bestOf) errors.push(`Máximo ${rules.bestOf} sets`);
  const status = winner ? 'complete' : sets.length ? 'in_progress' : 'pending';
  return { valid: errors.length === 0, errors, setsA, setsB, pointsA, pointsB, status, winner };
}

export function winnerId(a: PlayerId, b: PlayerId, side: 'a' | 'b' | null): PlayerId | null {
  return side === 'a' ? a : side === 'b' ? b : null;
}
