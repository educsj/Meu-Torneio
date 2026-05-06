import type {
  Match,
  MatchStage,
  TournamentStatus,
  TournamentType,
} from '@/types/tournament';
import { GRAND_FINAL_LABEL, THIRD_PLACE_LABEL } from './bracket';

/** Subset of Match needed to compute status — keeps callers DB-agnostic. */
export interface StatusInputMatch {
  stage: MatchStage;
  scoreA: number | null;
  scoreB: number | null;
  winnerId: number | null;
  nextMatchId: number | null;
  /** Used to skip the 3rd-place match when locating the bracket's final. */
  groupLabel: string | null;
  /** DE bracket-reset logic needs to know which slot won GF1: slot A is
   * the WB Champion (no rematch needed), slot B is the LB Champion (GF2
   * decides). Optional for non-DE inputs. */
  round?: number;
  participantAId?: number | null;
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

  // The 3rd-place match also has nextMatchId=null but it's NOT the bracket's
  // final — exclude it from the "find the final" lookup.
  const isThirdPlace = (m: StatusInputMatch) =>
    m.groupLabel === THIRD_PLACE_LABEL;

  if (type === 'single_elimination') {
    const final = matches.find(
      (m) => m.nextMatchId == null && !isThirdPlace(m)
    );
    if (final && final.winnerId != null) return 'finished';
    return anyPlayed ? 'ongoing' : 'draft';
  }

  if (type === 'double_elimination') {
    // GF1 is the grand final (round=1). GF2 (round=2) only exists when
    // bracket reset is enabled — it's the rematch played when the LB
    // Champion won GF1, since both finalists then have one loss each.
    const gfs = matches
      .filter((m) => m.groupLabel === GRAND_FINAL_LABEL)
      .sort((a, b) => (a.round ?? 1) - (b.round ?? 1));
    const gf1 = gfs[0];
    const gf2 = gfs[1];
    if (gf1 && gf1.winnerId != null) {
      if (!gf2) return 'finished'; // no reset configured
      // Slot A = WB Champion (set up at generation time). If they won GF1
      // there's no rematch — they'd need to lose 2x and they haven't.
      if (gf1.winnerId === gf1.participantAId) return 'finished';
      // Otherwise the LB Champion won — GF2 is the actual decider.
      if (gf2.winnerId != null) return 'finished';
      return 'ongoing';
    }
    return anyPlayed ? 'ongoing' : 'draft';
  }

  if (type === 'groups_knockout') {
    const knockout = matches.filter((m) => m.stage === 'knockout');
    const final = knockout.find(
      (m) => m.nextMatchId == null && !isThirdPlace(m)
    );
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
