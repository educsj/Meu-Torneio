import type {
  Match,
  MatchStage,
  TournamentStatus,
  TournamentType,
} from '@/types/tournament';

/** Subset of Match needed to compute status — keeps callers DB-agnostic. */
export interface StatusInputMatch {
  stage: MatchStage;
  scoreA: number | null;
  scoreB: number | null;
  winnerId: number | null;
  nextMatchId: number | null;
}

/**
 * Decide the tournament status from its current set of matches and its type.
 *
 * Rules per format:
 *  - single_elimination: finished when the bracket's final (next_match_id null)
 *    has a winner; ongoing when any match has a score; otherwise draft.
 *  - round_robin: finished when EVERY match has a recorded score.
 *  - groups_knockout: finished when the knockout final (the only knockout
 *    match with next_match_id=null) has a winner.
 *  - league_playoff: finished only when EVERY placement match (stage=knockout)
 *    has a winner — they're parallel, no single "final".
 *
 * Returns null for empty match sets so callers can leave status untouched
 * (matches the legacy matches.ts behavior).
 */
export function computeTournamentStatus(
  type: TournamentType,
  matches: StatusInputMatch[]
): TournamentStatus | null {
  if (matches.length === 0) return null;

  const isPlayed = (m: StatusInputMatch) =>
    m.scoreA != null && m.scoreB != null;
  const anyPlayed = matches.some(isPlayed);

  if (type === 'single_elimination') {
    const final = matches.find((m) => m.nextMatchId == null);
    if (final && final.winnerId != null) return 'finished';
    return anyPlayed ? 'ongoing' : 'draft';
  }

  if (type === 'groups_knockout') {
    const knockout = matches.filter((m) => m.stage === 'knockout');
    const final = knockout.find((m) => m.nextMatchId == null);
    if (final && final.winnerId != null) return 'finished';
    return anyPlayed ? 'ongoing' : 'draft';
  }

  if (type === 'league_playoff') {
    const playoff = matches.filter((m) => m.stage === 'knockout');
    const allPlayoffDecided =
      playoff.length > 0 && playoff.every((m) => m.winnerId != null);
    if (allPlayoffDecided) return 'finished';
    return anyPlayed ? 'ongoing' : 'draft';
  }

  // round_robin
  const allPlayed = matches.every(isPlayed);
  if (allPlayed) return 'finished';
  return anyPlayed ? 'ongoing' : 'draft';
}
