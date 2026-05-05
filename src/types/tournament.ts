export type TournamentType =
  | 'single_elimination'
  | 'round_robin'
  | 'groups_knockout';

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
  scheduledAt: string | null;
  location: string | null;
  groupLabel: string | null;
  stage: MatchStage;
  /**
   * Phase this match belongs to. Nullable on legacy rows that predate the
   * phase model; the migration backfills it from `stage`+tournament type.
   */
  phaseId: number | null;
}

/**
 * Phase model — a tournament is an ordered list of phases, each with its own
 * format. Existing presets (single_elim / round_robin / groups+knockout) all
 * map onto 1 or 2 phases of these formats. New formats (e.g. placement
 * playoff) plug in here without growing TournamentType.
 */
export type PhaseFormat = 'single_elimination' | 'round_robin';

export type PhaseStatus = 'pending' | 'ongoing' | 'finished';

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
}
