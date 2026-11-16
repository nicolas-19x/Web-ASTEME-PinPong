/**
 * Tipos del motor de torneos. Este módulo es TypeScript puro: no depende de
 * React ni de Supabase, para poder probarlo y mejorarlo de forma aislada.
 */

export type PlayerId = string;

export interface Entrant {
  id: PlayerId;
  name: string;
  /** Puntos de ranking interno. `null` = sin ranking (nunca se inventa). */
  ranking: number | null;
  categoryId?: string | null;
  level?: string | null;
}

export interface MatchRules {
  /** Puntos para ganar un set (por defecto 11). */
  pointsPerSet: number;
  /** Diferencia mínima para cerrar un set (por defecto 2). */
  minLead: number;
  /** Mejor de N sets (3, 5, 7…). Siempre impar. */
  bestOf: number;
}

export const DEFAULT_RULES: MatchRules = { pointsPerSet: 11, minLead: 2, bestOf: 3 };

export type TiebreakCriterion =
  | 'wins' // 1) partidos ganados
  | 'head_to_head' // 2) resultado directo entre empatados
  | 'set_diff' // 3) diferencia de sets
  | 'point_diff' // 4) diferencia de puntos totales
  | 'manual'; // 5) criterio adicional del entrenador (orden manual / sorteo)

export const DEFAULT_TIEBREAKERS: TiebreakCriterion[] = [
  'wins',
  'head_to_head',
  'set_diff',
  'point_diff',
  'manual',
];

/** Cómo resolver empates de ranking o jugadores sin ranking al sembrar. */
export type SeedTieMode = 'random' | 'manual';

export interface SetScore {
  a: number;
  b: number;
}

export interface GroupMatch {
  /** Clave estable dentro del torneo, p. ej. "G1-R2-M1". */
  key: string;
  groupIndex: number;
  round: number; // 1..n (jornada)
  a: PlayerId;
  b: PlayerId;
  table?: number | null;
  slot?: number | null; // turno global en que se juega
}

export interface MatchResultInput {
  a: PlayerId;
  b: PlayerId;
  sets: SetScore[];
  /** Si existe, el partido está decidido (incluye walkover). */
  winner?: PlayerId | null;
  walkover?: boolean;
}

export interface StandingRow {
  playerId: PlayerId;
  position: number;
  played: number;
  won: number;
  lost: number;
  setsFor: number;
  setsAgainst: number;
  setDiff: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
  /** Puntos de clasificación (victoria = 2, derrota = 1, W.O. perdido = 0). */
  classificationPoints: number;
  /** true cuando el empate no se pudo romper con los criterios automáticos. */
  unresolvedTie: boolean;
  /** Criterio que decidió la posición respecto al siguiente. */
  decidedBy?: TiebreakCriterion | 'seed' | null;
}

export type BracketSlot =
  | { kind: 'player'; playerId: PlayerId }
  | { kind: 'bye' }
  | { kind: 'winner'; matchKey: string }
  | { kind: 'loser'; matchKey: string }
  | { kind: 'empty' };

export interface BracketMatch {
  key: string; // "KO-R1-M1", "KO-3P"
  round: number; // 1 = primera ronda del cuadro
  position: number; // 1..n dentro de la ronda
  a: BracketSlot;
  b: BracketSlot;
  winner: PlayerId | null;
  isThirdPlace?: boolean;
  /** Etiqueta legible: Octavos, Cuartos, Semifinal, Final, Tercer lugar. */
  label: string;
}

export interface Qualifier {
  playerId: PlayerId;
  groupIndex: number;
  groupPosition: number; // 1 = primero del grupo
  ranking: number | null;
}
