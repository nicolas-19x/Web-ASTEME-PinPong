import { useQuery } from '@tanstack/react-query';
import {
  buildKnockout,
  computeStandings,
  DEFAULT_RULES,
  podium,
  qualifiersFromStandings,
  resolveBracket,
  type BracketMatch,
  type BracketSlot,
  type MatchResultInput,
  type MatchRules,
  type StandingRow,
  type TiebreakCriterion,
} from '@/lib/tournament';
import { supabase, unwrap, type Json, type Updates } from '@/lib/supabase';

export const tKey = (id: string) => ['tournament', id] as const;

export async function loadTournament(id: string) {
  const [t, parts, groups, gps, matches] = await Promise.all([
    supabase.from('tournaments').select('*').eq('id', id).single(),
    supabase
      .from('tournament_participants')
      .select('*, players(id, first_name, last_names, photo_path, photo_authorized, category_id, level_id, categories(name))')
      .eq('tournament_id', id)
      .order('seed_position'),
    supabase.from('tournament_groups').select('*').eq('tournament_id', id).order('idx'),
    supabase.from('tournament_group_players').select('*').eq('tournament_id', id).order('seed_in_group'),
    supabase.from('matches').select('*, match_sets(set_no, points_a, points_b)').eq('tournament_id', id).order('stage').order('round').order('slot', { nullsFirst: false }).order('position'),
  ]);
  const tournament = unwrap(t);
  const participants = unwrap(parts);
  const groupRows = unwrap(groups);
  const groupPlayers = unwrap(gps);
  const matchRows = unwrap(matches).map((m) => ({ ...m, match_sets: [...m.match_sets].sort((a, b) => a.set_no - b.set_no) }));
  const names = new Map(participants.map((p) => [p.player_id, p.players ? [p.players.first_name, p.players.last_names].filter(Boolean).join(' ') : '¿?']));
  const ranking = new Map(participants.map((p) => [p.player_id, p.ranking_at_entry == null ? null : Number(p.ranking_at_entry)]));
  const groupsWithPlayers = groupRows.map((g) => ({
    ...g,
    players: groupPlayers.filter((gp) => gp.group_id === g.id).map((gp) => gp.player_id),
  }));
  return { tournament, participants, groups: groupsWithPlayers, matches: matchRows, names, ranking };
}

export type TournamentData = Awaited<ReturnType<typeof loadTournament>>;
export type MatchRow = TournamentData['matches'][number];

export function useTournament(id: string, live = false) {
  return useQuery({ queryKey: tKey(id), queryFn: () => loadTournament(id), refetchInterval: live ? 10_000 : false });
}

export function rulesOf(t: TournamentData['tournament'], stage: 'group' | 'knockout'): MatchRules {
  const raw = (stage === 'knockout' ? (t.knockout_rules ?? t.rules) : t.rules) as Partial<MatchRules> | null;
  return { ...DEFAULT_RULES, ...(raw ?? {}) };
}

export function toResult(m: MatchRow): MatchResultInput {
  return {
    a: m.player_a!,
    b: m.player_b!,
    sets: m.match_sets.map((s) => ({ a: s.points_a, b: s.points_b })),
    winner: m.status === 'finished' ? m.winner_id : null,
    walkover: m.walkover,
  };
}

export function groupStandings(d: TournamentData): StandingRow[][] {
  return d.groups.map((g) => {
    const results = d.matches.filter((m) => m.stage === 'group' && m.group_id === g.id && m.status === 'finished').map(toResult);
    return computeStandings(g.players, results, {
      criteria: d.tournament.tiebreakers as TiebreakCriterion[],
      manualOrder: g.manual_order ?? undefined,
      seedOrder: g.players,
    });
  });
}

export function groupStageComplete(d: TournamentData): boolean {
  const gm = d.matches.filter((m) => m.stage === 'group');
  return gm.length > 0 && gm.every((m) => m.status === 'finished');
}

export function bracketMatches(d: TournamentData): BracketMatch[] {
  return d.matches
    .filter((m) => m.stage === 'knockout')
    .map((m) => ({
      key: m.key,
      round: m.round,
      position: m.position ?? 1,
      a: (m.a_source as unknown as BracketSlot) ?? { kind: 'empty' },
      b: (m.b_source as unknown as BracketSlot) ?? { kind: 'empty' },
      winner: m.winner_id,
      isThirdPlace: m.is_third_place,
      label: m.label ?? '',
    }));
}

/** Guarda la tabla de posiciones de cada grupo y genera el cuadro eliminatorio. */
export async function closeGroupsAndBuildBracket(d: TournamentData) {
  const standings = groupStandings(d);
  const unresolved = standings.some((rows) => rows.some((r) => r.unresolvedTie));
  if (unresolved) throw new Error('Hay empates sin resolver en algún grupo. Define el orden manual antes de continuar.');
  const rows = standings.flatMap((g, gi) =>
    g.map((r) => ({
      tournament_id: d.tournament.id,
      group_id: d.groups[gi].id,
      player_id: r.playerId,
      position: r.position,
      played: r.played,
      won: r.won,
      lost: r.lost,
      sets_for: r.setsFor,
      sets_against: r.setsAgainst,
      points_for: r.pointsFor,
      points_against: r.pointsAgainst,
      classification_points: r.classificationPoints,
      decided_by: r.decidedBy ?? null,
    })),
  );
  unwrap(await supabase.from('tournament_standings').delete().eq('tournament_id', d.tournament.id));
  unwrap(await supabase.from('tournament_standings').insert(rows));

  const advance = d.tournament.advance_per_group;
  if (advance < 1 || d.tournament.format === 'round_robin') return { knockout: false };
  const qualifiers = qualifiersFromStandings(standings, advance, (id) => d.ranking.get(id) ?? null);
  if (qualifiers.length < 2) return { knockout: false };
  const ko = buildKnockout(qualifiers, { thirdPlace: d.tournament.third_place });
  unwrap(await supabase.from('matches').delete().eq('tournament_id', d.tournament.id).eq('stage', 'knockout'));
  const resolved = resolveBracket(ko.matches, {});
  unwrap(
    await supabase.from('matches').insert(
      resolved.map((m) => ({
        tournament_id: d.tournament.id,
        stage: 'knockout',
        key: m.key,
        round: m.round,
        position: m.position,
        label: m.label,
        is_third_place: !!m.isThirdPlace,
        a_source: m.a as unknown as Json,
        b_source: m.b as unknown as Json,
        player_a: m.playerA,
        player_b: m.playerB,
        winner_id: m.byeAdvance ? m.winner : null,
        status: m.byeAdvance ? 'finished' : 'pending',
      })),
    ),
  );
  unwrap(
    await supabase
      .from('tournament_bracket')
      .upsert({ tournament_id: d.tournament.id, size: ko.size, same_group_conflicts: ko.sameGroupConflicts, generated_at: new Date().toISOString() }),
  );
  unwrap(await supabase.from('tournaments').update({ status: 'knockout' }).eq('id', d.tournament.id));
  await syncBracket(d.tournament.id);
  return { knockout: true, conflicts: ko.sameGroupConflicts };
}

/**
 * Avanza automáticamente a los ganadores: recalcula el cuadro desde los
 * resultados guardados y actualiza jugadores de rondas siguientes. Si una
 * corrección cambia a un clasificado, los resultados posteriores que ya no
 * corresponden se vacían (quedan pendientes).
 */
export async function syncBracket(tournamentId: string) {
  const d = await loadTournament(tournamentId);
  const ko = d.matches.filter((m) => m.stage === 'knockout');
  if (!ko.length) return;
  const winners = Object.fromEntries(ko.map((m) => [m.key, m.winner_id]));
  // Itera hasta estabilizar (cada pasada puede liberar la siguiente ronda).
  let resolved = resolveBracket(bracketMatches(d), winners);
  for (let i = 0; i < 8; i++) {
    const next = resolveBracket(bracketMatches(d), Object.fromEntries(resolved.map((m) => [m.key, m.winner])));
    if (JSON.stringify(next.map((m) => [m.playerA, m.playerB, m.winner])) === JSON.stringify(resolved.map((m) => [m.playerA, m.playerB, m.winner]))) break;
    resolved = next;
  }
  for (const r of resolved) {
    const row = ko.find((m) => m.key === r.key)!;
    const playersChanged = row.player_a !== r.playerA || row.player_b !== r.playerB;
    const winnerChanged = (row.winner_id ?? null) !== (r.winner ?? null);
    if (!playersChanged && !winnerChanged) continue;
    const patch: Updates<'matches'> = { player_a: r.playerA, player_b: r.playerB };
    if (r.byeAdvance) {
      Object.assign(patch, { winner_id: r.winner, status: 'finished', sets_a: 0, sets_b: 0, points_a: 0, points_b: 0, walkover: false });
    } else if (playersChanged || r.stale || (row.winner_id && !r.winner)) {
      Object.assign(patch, { winner_id: null, status: 'pending', sets_a: 0, sets_b: 0, points_a: 0, points_b: 0, walkover: false });
      if (row.match_sets.length) unwrap(await supabase.from('match_sets').delete().eq('match_id', row.id));
    }
    unwrap(await supabase.from('matches').update(patch).eq('id', row.id));
  }
}

export async function saveResult(matchId: string, sets: { a: number; b: number }[], opts: { walkoverWinner?: string | null; reason?: string | null; tournamentId: string; stage: string }) {
  const { error } = await supabase.rpc('save_match_result', {
    p_match_id: matchId,
    p_sets: sets as unknown as Json,
    p_walkover_winner: opts.walkoverWinner ?? undefined,
    p_reason: opts.reason ?? undefined,
  });
  if (error) throw new Error(error.message);
  if (opts.stage === 'knockout') await syncBracket(opts.tournamentId);
}

export interface FinalPosition {
  playerId: string;
  position: number;
  medal: 'gold' | 'silver' | 'bronze' | null;
}

/** Posiciones finales sugeridas (editables por el entrenador antes de cerrar). */
export function computeFinalPositions(d: TournamentData): FinalPosition[] {
  const standings = groupStandings(d);
  const ko = d.matches.filter((m) => m.stage === 'knockout');
  const out: FinalPosition[] = [];
  const placed = new Set<string>();
  const push = (id: string | null | undefined, position: number, medal: FinalPosition['medal']) => {
    if (!id || placed.has(id)) return;
    placed.add(id);
    out.push({ playerId: id, position, medal });
  };
  if (ko.length) {
    const resolved = resolveBracket(bracketMatches(d), Object.fromEntries(ko.map((m) => [m.key, m.winner_id])));
    const p = podium(resolved);
    push(p.champion, 1, 'gold');
    push(p.runnerUp, 2, 'silver');
    const third = resolved.find((m) => m.isThirdPlace);
    if (third?.winner) {
      push(third.winner, 3, 'bronze');
      push(third.loser, 4, null);
    } else p.third.forEach((id) => push(id, 3, 'bronze'));
    // Eliminados en rondas anteriores comparten posición por ronda.
    const maxRound = Math.max(...resolved.filter((m) => !m.isThirdPlace).map((m) => m.round));
    for (let r = maxRound - 2; r >= 1; r--) {
      const losers = resolved.filter((m) => m.round === r && !m.isThirdPlace && m.loser).map((m) => m.loser!);
      const pos = placed.size + 1;
      losers.forEach((id) => push(id, pos, null));
    }
    const rest = standings
      .flatMap((rows) => rows)
      .filter((r) => !placed.has(r.playerId))
      .sort((a, b) => a.position - b.position || b.won - a.won || b.setDiff - a.setDiff || b.pointDiff - a.pointDiff);
    rest.forEach((r) => push(r.playerId, placed.size + 1, null));
  } else {
    const merged =
      standings.length === 1
        ? standings[0]
        : standings.flat().sort((a, b) => a.position - b.position || b.won - a.won || b.setDiff - a.setDiff || b.pointDiff - a.pointDiff);
    merged.forEach((r, i) => push(r.playerId, i + 1, standings.length === 1 && i < 3 ? (['gold', 'silver', 'bronze'] as const)[i] : null));
  }
  return out;
}

export const STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador',
  group_stage: 'Fase de grupos',
  knockout: 'Eliminatoria',
  finished: 'Finalizado',
};
