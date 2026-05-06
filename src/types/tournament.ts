export type TournamentType =
  | 'single_elimination'
  | 'double_elimination'
  | 'round_robin'
  | 'groups_knockout'
  | 'league_playoff'
  | 'custom';

export type TournamentStatus = 'draft' | 'ongoing' | 'finished';

export interface Tournament {
  id: number;
  name: string;
  type: TournamentType;
  status: TournamentStatus;
  createdAt: string;
}

export interface Participant {
  id: number;
  tournamentId: number;
  name: string;
  seed: number | null;
  /**
   * Identifier into the curated icon registry (see `src/utils/icons.ts`).
   * Null means "no icon" — the UI falls back to plain initials.
   */
  icon: string | null;
  /**
   * Hex color (e.g. '#ef4444') used as the icon background. Null is treated
   * as the default brand-blue when an icon is set but no color was picked.
   */
  iconColor: string | null;
}

export type MatchStage = 'main' | 'group' | 'knockout';

export interface Match {
  id: number;
  tournamentId: number;
  round: number;
  participantAId: number | null;
  participantBId: number | null;
  scoreA: number | null;
  scoreB: number | null;
  winnerId: number | null;
  nextMatchId: number | null;
  /**
   * Double-elimination only: where the LOSER of this match drops to.
   * Null for any non-DE match (and for terminal DE matches like the
   * grand final where the loser is simply eliminated).
   */
  loserNextMatchId: number | null;
  /**
   * Double-elimination only: explicit 'A' / 'B' slot the winner / loser
   * fills in the downstream match. Null falls back to the legacy
   * "siblings sorted by id → smaller-id is slot A" rule used by single
   * elim. Cross-bracket DE propagation needs explicit slots because
   * winner-from-LB and loser-from-WB land in the same downstream match.
   */
  nextSlot: 'A' | 'B' | null;
  loserNextSlot: 'A' | 'B' | null;
  scheduledAt: string | null;
  location: string | null;
  groupLabel: string | null;
  stage: MatchStage;
  /**
   * Phase this match belongs to. Nullable on legacy rows that predate the
   * phase model; the migration backfills it from `stage`+tournament type.
   */
  phaseId: number | null;
  /**
   * True when the result was decided by walkover (W.O. — one side didn't
   * show up). The scoreA/scoreB and winnerId still reflect the official
   * forfeit margin; this flag is purely informational for the UI badge.
   */
  walkover: boolean;
}

/**
 * Phase model — a tournament is an ordered list of phases, each with its own
 * format. Existing presets (single_elim / round_robin / groups+knockout) all
 * map onto 1 or 2 phases of these formats. New formats (e.g. placement
 * playoff) plug in here without growing TournamentType.
 */
export type PhaseFormat =
  | 'single_elimination'
  /**
   * Double elimination: every team has to lose twice. Winners bracket (WB)
   * plays single-elim; each WB loser drops into the losers bracket (LB);
   * the WB and LB champions meet in a single grand final. Initial release
   * supports 4/8/16-team brackets without a bracket-reset rematch.
   */
  | 'double_elimination'
  | 'round_robin'
  /**
   * Parallel placement matches: top-K seeds (K even) play head-to-head.
   * Pos 1 vs 2 → 1st place final; 3 vs 4 → 3rd place; etc. No bracket tree.
   */
  | 'placement_playoff';

export type PhaseStatus = 'pending' | 'ongoing' | 'finished';

/**
 * How a match's score translates to standings points.
 *
 *   'fifa'       → win 3, draw 1, loss 0 (football-style; default)
 *   'volleyball' → win 3-0/3-1: 3-0; win 3-2: 2-1 (FIVB sets)
 *
 * Only meaningful for phases that produce standings (round_robin).
 */
export type ScoringRule = 'fifa' | 'volleyball';

export interface Phase {
  id: number;
  tournamentId: number;
  /** 0-based position; phases are played in ordinal order. */
  ordinal: number;
  name: string;
  format: PhaseFormat;
  /** 1 = single round; 2 = home-and-away. Only meaningful for round_robin. */
  legs: 1 | 2;
  /** 1 = single league/bracket; 2+ = group stage. */
  groupCount: number;
  /** Number of participants advancing to next phase (null on the last). */
  qualifiers: number | null;
  status: PhaseStatus;
  /** Scoring system for standings. Only used for round_robin phases. */
  scoring: ScoringRule;
  /**
   * single_elimination only: when true, an extra match between the two
   * semifinal losers is generated alongside the final. Requires a bracket
   * with at least 4 qualifiers (so semifinals exist).
   */
  thirdPlace: boolean;
  /**
   * double_elimination only: when true, generate a 2nd grand final
   * placeholder. If the LB Champion wins GF1, GF2 ("bracket reset") is
   * the actual deciding match — the WB Champion now has 1 loss too,
   * matching the LB Champion's record.
   */
  bracketReset: boolean;
}

/** Phase configuration provided by the user when creating a custom tournament. */
export interface CustomPhaseInput {
  name: string;
  format: PhaseFormat;
  legs: 1 | 2;
  groupCount: number;
  qualifiers: number | null;
  scoring: ScoringRule;
  thirdPlace: boolean;
  bracketReset: boolean;
}
