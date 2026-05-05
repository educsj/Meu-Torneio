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
}
