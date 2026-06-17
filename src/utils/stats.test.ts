import { describe, expect, it } from 'vitest';

import type { Match, Participant } from '@/types/tournament';

import {
  aggregateParticipantStats,
  championParticipantId,
  type TournamentBundle,
} from './stats';

function part(id: number, name: string): Participant {
  return { id, tournamentId: 1, name, seed: null, icon: null, iconColor: null };
}

function match(
  id: number,
  a: number,
  b: number,
  scoreA: number | null,
  scoreB: number | null,
  extra: Partial<Match> = {}
): Match {
  const winnerId =
    scoreA == null || scoreB == null
      ? null
      : scoreA > scoreB
        ? a
        : scoreA < scoreB
          ? b
          : null;
  return {
    id,
    tournamentId: 1,
    round: 1,
    participantAId: a,
    participantBId: b,
    scoreA,
    scoreB,
    winnerId,
    nextMatchId: null,
    loserNextMatchId: null,
    nextSlot: null,
    loserNextSlot: null,
    scheduledAt: null,
    location: null,
    groupLabel: null,
    stage: 'main',
    phaseId: null,
    walkover: false,
    ...extra,
  };
}

describe('championParticipantId', () => {
  it('single elimination → winner of the final (nextMatchId null)', () => {
    const b: TournamentBundle = {
      type: 'single_elimination',
      status: 'finished',
      participants: [part(1, 'A'), part(2, 'B')],
      matches: [match(1, 1, 2, 2, 1)],
    };
    expect(championParticipantId(b)).toBe(1);
  });

  it('round robin → top of standings', () => {
    const b: TournamentBundle = {
      type: 'round_robin',
      status: 'finished',
      participants: [part(1, 'A'), part(2, 'B')],
      matches: [match(1, 1, 2, 3, 0)],
    };
    expect(championParticipantId(b)).toBe(1);
  });

  it('returns null while the tournament is unfinished', () => {
    const b: TournamentBundle = {
      type: 'single_elimination',
      status: 'ongoing',
      participants: [part(1, 'A'), part(2, 'B')],
      matches: [match(1, 1, 2, 2, 1)],
    };
    expect(championParticipantId(b)).toBeNull();
  });
});

describe('aggregateParticipantStats', () => {
  it('merges the same name across tournaments and counts titles', () => {
    const t1: TournamentBundle = {
      type: 'single_elimination',
      status: 'finished',
      participants: [part(1, 'A'), part(2, 'B')],
      matches: [match(1, 1, 2, 2, 1)], // A beats B → A champion
    };
    const t2: TournamentBundle = {
      type: 'round_robin',
      status: 'finished',
      participants: [part(10, 'A'), part(11, 'C')],
      matches: [match(1, 10, 11, 3, 0)], // A beats C → A champion
    };

    const rows = aggregateParticipantStats([t1, t2], 'titles');
    const a = rows.find((r) => r.name === 'A');
    expect(a).toBeDefined();
    expect(a!.titles).toBe(2);
    expect(a!.tournaments).toBe(2);
    expect(a!.played).toBe(2);
    expect(a!.wins).toBe(2);
    expect(a!.goalsFor).toBe(5);
    expect(a!.goalsAgainst).toBe(1);
    expect(a!.goalDiff).toBe(4);
    // Sorted by titles desc → A (2 titles) is first.
    expect(rows[0].name).toBe('A');
  });

  it('ignores matches with missing scores or participants', () => {
    const b: TournamentBundle = {
      type: 'round_robin',
      status: 'ongoing',
      participants: [part(1, 'A'), part(2, 'B')],
      matches: [match(1, 1, 2, null, null)],
    };
    const rows = aggregateParticipantStats([b]);
    expect(rows.every((r) => r.played === 0)).toBe(true);
  });
});
