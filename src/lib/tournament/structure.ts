export interface StructureSuggestion {
  groupCount: number;
  advancePerGroup: number;
  /** Tamaños de grupo resultantes, p. ej. [4,4,3]. */
  groupSizes: number[];
  /** true si conviene un solo grupo todos contra todos sin eliminatoria. */
  singleRoundRobin: boolean;
  knockoutSize: number;
  rationale: string;
}

/**
 * Sugiere una estructura según inscritos. Busca grupos de 3 a 5 (ideal 4),
 * evita grupos de 2 y, con 5 o menos jugadores, propone un solo grupo.
 * La sugerencia es editable por el entrenador.
 */
export function suggestStructure(participants: number): StructureSuggestion {
  if (participants < 2) {
    return {
      groupCount: 1,
      advancePerGroup: 0,
      groupSizes: [participants],
      singleRoundRobin: true,
      knockoutSize: 0,
      rationale: 'Se necesitan al menos 2 participantes.',
    };
  }
  if (participants <= 5) {
    return {
      groupCount: 1,
      advancePerGroup: 0,
      groupSizes: [participants],
      singleRoundRobin: true,
      knockoutSize: 0,
      rationale: 'Con pocos inscritos, un solo grupo de todos contra todos da más partidos a cada jugador.',
    };
  }
  // Grupos de ~4: número de grupos = round(n/4), con mínimo 3 por grupo.
  let groupCount = Math.max(2, Math.round(participants / 4));
  while (groupCount > 1 && Math.floor(participants / groupCount) < 3) groupCount--;
  const groupSizes = splitSizes(participants, groupCount);
  const advancePerGroup = 2;
  const knockoutSize = groupCount * advancePerGroup;
  return {
    groupCount,
    advancePerGroup,
    groupSizes,
    singleRoundRobin: false,
    knockoutSize,
    rationale: `${groupCount} grupos (${groupSizes.join(', ')} jugadores); avanzan ${advancePerGroup} por grupo a una eliminatoria de ${knockoutSize}.`,
  };
}

export function splitSizes(total: number, groups: number): number[] {
  const base = Math.floor(total / groups);
  const extra = total % groups;
  return Array.from({ length: groups }, (_, i) => base + (i < extra ? 1 : 0));
}

export function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}
