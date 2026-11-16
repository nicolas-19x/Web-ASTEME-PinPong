import type { GroupMatch, PlayerId } from './types';

export interface RoundRobinRound {
  round: number;
  pairs: [PlayerId, PlayerId][];
  /** Jugador que descansa en esta jornada (grupos impares). */
  bye: PlayerId | null;
}

/**
 * Todos contra todos por el método del círculo. Con n par hay n-1 jornadas y
 * n/2 partidos por jornada; con n impar se añade un BYE y cada jugador
 * descansa exactamente una jornada. Cada pareja se enfrenta una sola vez.
 */
export function roundRobin(players: PlayerId[]): RoundRobinRound[] {
  if (new Set(players).size !== players.length) throw new Error('Jugadores duplicados en el grupo');
  if (players.length < 2) return [];
  const list: (PlayerId | null)[] = players.slice();
  if (list.length % 2 === 1) list.push(null);
  const n = list.length;
  const rounds: RoundRobinRound[] = [];
  let rotation = list.slice();
  for (let r = 0; r < n - 1; r++) {
    const pairs: [PlayerId, PlayerId][] = [];
    let bye: PlayerId | null = null;
    for (let i = 0; i < n / 2; i++) {
      const x = rotation[i];
      const y = rotation[n - 1 - i];
      if (x === null) bye = y;
      else if (y === null) bye = x;
      // Alterna el orden para equilibrar quién figura como "A".
      else pairs.push(r % 2 === 0 ? [x, y] : [y, x]);
    }
    rounds.push({ round: r + 1, pairs, bye });
    // Fija el primero y rota el resto en sentido horario.
    rotation = [rotation[0], rotation[n - 1], ...rotation.slice(1, n - 1)];
  }
  return rounds;
}

export function groupMatches(groups: PlayerId[][]): GroupMatch[] {
  const out: GroupMatch[] = [];
  groups.forEach((g, gi) => {
    for (const rr of roundRobin(g)) {
      rr.pairs.forEach(([a, b], mi) => {
        out.push({ key: `G${gi + 1}-R${rr.round}-M${mi + 1}`, groupIndex: gi, round: rr.round, a, b });
      });
    }
  });
  return out;
}

/**
 * Asigna mesa y turno. En un mismo turno nadie juega dos partidos y no se usan
 * más mesas de las disponibles. Respeta el orden de jornadas de cada jugador.
 */
export function scheduleOnTables(matches: GroupMatch[], tables: number): GroupMatch[] {
  if (tables < 1) throw new Error('Debe haber al menos una mesa disponible');
  const pending = matches
    .slice()
    .sort((x, y) => x.round - y.round || x.groupIndex - y.groupIndex || x.key.localeCompare(y.key));
  const result: GroupMatch[] = [];
  let slot = 1;
  while (pending.length) {
    const busy = new Set<PlayerId>();
    // Primer partido aún pendiente de cada jugador (para no adelantar jornadas).
    const nextFor = new Map<PlayerId, string>();
    for (const m of pending) {
      if (!nextFor.has(m.a)) nextFor.set(m.a, m.key);
      if (!nextFor.has(m.b)) nextFor.set(m.b, m.key);
    }
    let table = 1;
    for (let i = 0; i < pending.length && table <= tables; ) {
      const m = pending[i];
      const ready = nextFor.get(m.a) === m.key && nextFor.get(m.b) === m.key;
      if (ready && !busy.has(m.a) && !busy.has(m.b)) {
        busy.add(m.a);
        busy.add(m.b);
        result.push({ ...m, table, slot });
        pending.splice(i, 1);
        table++;
      } else {
        i++;
      }
    }
    if (table === 1) throw new Error('No se pudo programar ningún partido en el turno'); // salvaguarda
    slot++;
  }
  return result;
}
