export * from './types';
export * from './rng';
export * from './seeding';
export * from './structure';
export * from './roundRobin';
export * from './scoring';
export * from './standings';
export * from './knockout';

import { groupMatches, scheduleOnTables } from './roundRobin';
import { orderForSeeding, snakeDistribute } from './seeding';
import type { Entrant, GroupMatch, PlayerId, Qualifier, SeedTieMode, StandingRow } from './types';

export interface PlanInput {
  entrants: Entrant[];
  groupCount: number;
  tables: number;
  tieMode: SeedTieMode;
  seed: number;
  manualOrder?: PlayerId[];
}

export interface TournamentPlan {
  seedOrder: Entrant[];
  unranked: Entrant[];
  rankingTies: PlayerId[][];
  groups: Entrant[][];
  matches: GroupMatch[];
}

/** Siembra + serpentina + todos contra todos + mesas. Vista previa editable. */
export function planTournament(input: PlanInput): TournamentPlan {
  if (input.groupCount > Math.floor(input.entrants.length / 2) && input.groupCount > 1)
    throw new Error('Demasiados grupos: cada grupo necesita al menos 2 jugadores');
  const { ordered, unranked, rankingTies } = orderForSeeding(input.entrants, {
    tieMode: input.tieMode,
    seed: input.seed,
    manualOrder: input.manualOrder,
  });
  const groups = snakeDistribute(ordered, input.groupCount);
  return { seedOrder: ordered, unranked, rankingTies, groups, ...scheduleGroups(groups, input.tables) };
}

/** Recalcula partidos y mesas tras mover jugadores manualmente entre grupos. */
export function scheduleGroups(groups: Entrant[][], tables: number): { matches: GroupMatch[] } {
  const all = groups.flat().map((e) => e.id);
  if (new Set(all).size !== all.length) throw new Error('Un jugador aparece en más de un grupo');
  const matches = scheduleOnTables(groupMatches(groups.map((g) => g.map((e) => e.id))), tables);
  return { matches };
}

/** Toma los N primeros de cada tabla como clasificados a la eliminatoria. */
export function qualifiersFromStandings(
  standings: StandingRow[][],
  advancePerGroup: number,
  rankingOf: (id: PlayerId) => number | null,
): Qualifier[] {
  return standings.flatMap((rows, gi) =>
    rows.slice(0, advancePerGroup).map((r) => ({
      playerId: r.playerId,
      groupIndex: gi,
      groupPosition: r.position,
      ranking: rankingOf(r.playerId),
    })),
  );
}
