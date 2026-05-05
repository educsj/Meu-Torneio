import { describe, expect, it } from 'vitest';

import type { Match, Participant } from '@/types/tournament';

import {
  computeGroupsKnockoutSeeding,
  computeLeaguePlayoffSeeding,
  computeSingleLeagueBracketSeeding,
} from './playoffSeeding';

function p(id: number, name: string): Participant {
  return { id, tournamentId: 1, name, seed: null };
}

function m(
  id: number,
  a: number,
  b: number,
  scoreA: number | null,
  scoreB: number | null,
  options?: { stage?: Match['stage']; groupLabel?: string | null }
): Match {
  return {
    id,
    tournamentId: 1,
    round: 1,
    participantAId: a,
    participantBId: b,
    scoreA,
    scoreB,
    winnerId:
      scoreA == null || scoreB == null
        ? null
        : scoreA > scoreB
          ? a
          : scoreA < scoreB
            ? b
            : null,
    nextMatchId: null,
    scheduledAt: null,
    location: null,
    groupLabel: options?.groupLabel ?? null,
    stage: options?.stage ?? 'group',
    phaseId: null,
  };
}

describe('computeLeaguePlayoffSeeding', () => {
  const A = p(1, 'A');
  const B = p(2, 'B');
  const C = p(3, 'C');
  const D = p(4, 'D');

  it('returns null when there are fewer than 4 participants', () => {
    expect(computeLeaguePlayoffSeeding([], [A, B])).toBeNull();
    expect(computeLeaguePlayoffSeeding([], [A, B, C])).toBeNull();
  });

  it('pairs 1v2 (final) and 3v4 (3rd-place) by standings order', () => {
    // A beats everyone (3 wins), B wins twice (excluding loss to A),
    // C wins once, D loses all.
    const matches: Match[] = [
      m(1, A.id, B.id, 3, 1), // A>B
      m(2, A.id, C.id, 3, 0), // A>C
      m(3, A.id, D.id, 3, 0), // A>D
      m(4, B.id, C.id, 3, 1), // B>C
      m(5, B.id, D.id, 3, 0), // B>D
      m(6, C.id, D.id, 3, 1), // C>D
    ];
    const seeding = computeLeaguePlayoffSeeding(matches, [A, B, C, D]);
    expect(seeding).toEqual([
      { participantAId: A.id, participantBId: B.id }, // final: 1st vs 2nd
      { participantAId: C.id, participantBId: D.id }, // 3rd-place
    ]);
  });

  it('with 5+ participants takes the top 4 only', () => {
    const E = p(5, 'E');
    // Build standings where E is dead last by losing all 4 games.
    const matches: Match[] = [
      m(1, A.id, B.id, 3, 1),
      m(2, A.id, C.id, 3, 1),
      m(3, A.id, D.id, 3, 1),
      m(4, A.id, E.id, 3, 0),
      m(5, B.id, C.id, 3, 1),
      m(6, B.id, D.id, 3, 1),
      m(7, B.id, E.id, 3, 0),
      m(8, C.id, D.id, 3, 1),
      m(9, C.id, E.id, 3, 0),
      m(10, D.id, E.id, 3, 0),
    ];
    const seeding = computeLeaguePlayoffSeeding(matches, [A, B, C, D, E]);
    expect(seeding).not.toBeNull();
    expect(seeding!).toHaveLength(2);
    // E (dead last) shouldn't appear in any slot.
    const ids = seeding!.flatMap((s) => [s.participantAId, s.participantBId]);
    expect(ids).not.toContain(E.id);
  });

  it('falls back to standings tiebreakers when teams tie on points', () => {
    // All-draws scenario: every team has 3 points (one win, one draw, one loss
    // when teams are 4 — actually with 4 teams and all draws, everyone has 3
    // draws = 3 points). Tiebreaker chain ends at name asc → A, B, C, D.
    const matches: Match[] = [
      m(1, A.id, B.id, 1, 1),
      m(2, A.id, C.id, 1, 1),
      m(3, A.id, D.id, 1, 1),
      m(4, B.id, C.id, 1, 1),
      m(5, B.id, D.id, 1, 1),
      m(6, C.id, D.id, 1, 1),
    ];
    const seeding = computeLeaguePlayoffSeeding(matches, [A, B, C, D]);
    expect(seeding).toEqual([
      { participantAId: A.id, participantBId: B.id },
      { participantAId: C.id, participantBId: D.id },
    ]);
  });
});

describe('computeSingleLeagueBracketSeeding', () => {
  // Build a clean ranking A > B > C > D > E > F > G > H by giving each
  // team progressively more wins via a star pattern of fake matches.
  const players = Array.from({ length: 8 }, (_, i) =>
    p(i + 1, String.fromCharCode(65 + i))
  );

  function leagueWithStanding(order: number[]): Match[] {
    // Quick way to seed deterministic standings: give each i-th team in
    // `order` (i+1) wins by beating one synthetic opponent per win.
    // Implementation detail doesn't matter — we test the seeder's output.
    const ms: Match[] = [];
    let id = 1000;
    for (let i = 0; i < order.length; i++) {
      const winsNeeded = order.length - i; // top team most wins
      for (let w = 0; w < winsNeeded; w++) {
        const opponent = order[(i + 1 + w) % order.length];
        ms.push(m(id++, order[i], opponent, 1, 0));
      }
    }
    return ms;
  }

  it('rejects qualifiers that aren’t power-of-two ≥ 2', () => {
    expect(
      computeSingleLeagueBracketSeeding([], players, 0)
    ).toBeNull();
    expect(
      computeSingleLeagueBracketSeeding([], players, 3)
    ).toBeNull();
    expect(
      computeSingleLeagueBracketSeeding([], players, 6)
    ).toBeNull();
  });

  it('returns null when standings have fewer entries than qualifiers', () => {
    expect(
      computeSingleLeagueBracketSeeding([], players.slice(0, 3), 4)
    ).toBeNull();
  });

  it('K=4: pairs 1v4 and 2v3 (NCAA-style)', () => {
    const matches = leagueWithStanding([1, 2, 3, 4]);
    const seeding = computeSingleLeagueBracketSeeding(
      matches,
      players.slice(0, 4),
      4
    );
    expect(seeding).toEqual([
      { participantAId: 1, participantBId: 4 },
      { participantAId: 2, participantBId: 3 },
    ]);
  });

  it('K=8: positions are 1v8, 4v5, 2v7, 3v6', () => {
    const matches = leagueWithStanding([1, 2, 3, 4, 5, 6, 7, 8]);
    const seeding = computeSingleLeagueBracketSeeding(
      matches,
      players,
      8
    );
    expect(seeding).toEqual([
      { participantAId: 1, participantBId: 8 },
      { participantAId: 4, participantBId: 5 },
      { participantAId: 2, participantBId: 7 },
      { participantAId: 3, participantBId: 6 },
    ]);
  });
});

describe('computeGroupsKnockoutSeeding', () => {
  // 2 groups of 3 — A, B, C in group A; D, E, F in group B.
  const A = p(1, 'A');
  const B = p(2, 'B');
  const C = p(3, 'C');
  const D = p(4, 'D');
  const E = p(5, 'E');
  const F = p(6, 'F');

  const allParticipants = [A, B, C, D, E, F];

  it('returns null with no group matches at all', () => {
    expect(computeGroupsKnockoutSeeding([], allParticipants)).toBeNull();
  });

  it('returns null when there is only one group with finished matches', () => {
    const matches: Match[] = [
      m(1, A.id, B.id, 3, 1, { groupLabel: 'A' }),
      m(2, A.id, C.id, 3, 1, { groupLabel: 'A' }),
      m(3, B.id, C.id, 3, 1, { groupLabel: 'A' }),
    ];
    expect(computeGroupsKnockoutSeeding(matches, allParticipants)).toBeNull();
  });

  it('produces cross-pairings 1A-2B and 1B-2A', () => {
    // Group A finishing order: A (1st) > B (2nd) > C (3rd)
    // Group B finishing order: D (1st) > E (2nd) > F (3rd)
    const matches: Match[] = [
      // Group A
      m(1, A.id, B.id, 3, 1, { groupLabel: 'A' }),
      m(2, A.id, C.id, 3, 1, { groupLabel: 'A' }),
      m(3, B.id, C.id, 3, 1, { groupLabel: 'A' }),
      // Group B
      m(4, D.id, E.id, 3, 1, { groupLabel: 'B' }),
      m(5, D.id, F.id, 3, 1, { groupLabel: 'B' }),
      m(6, E.id, F.id, 3, 1, { groupLabel: 'B' }),
    ];
    const seeding = computeGroupsKnockoutSeeding(matches, allParticipants);
    expect(seeding).toEqual([
      // Semi 1: 1A vs 2B → A vs E
      { participantAId: A.id, participantBId: E.id },
      // Semi 2: 1B vs 2A → D vs B
      { participantAId: D.id, participantBId: B.id },
    ]);
  });

  it('cross-pairing prevents 1A vs 1B and 2A vs 2B head-to-heads', () => {
    const matches: Match[] = [
      m(1, A.id, B.id, 3, 1, { groupLabel: 'A' }),
      m(2, A.id, C.id, 3, 1, { groupLabel: 'A' }),
      m(3, B.id, C.id, 3, 1, { groupLabel: 'A' }),
      m(4, D.id, E.id, 3, 1, { groupLabel: 'B' }),
      m(5, D.id, F.id, 3, 1, { groupLabel: 'B' }),
      m(6, E.id, F.id, 3, 1, { groupLabel: 'B' }),
    ];
    const seeding = computeGroupsKnockoutSeeding(matches, allParticipants)!;
    // No semi pits the two 1st-placed teams against each other.
    for (const slot of seeding) {
      const pair = new Set([slot.participantAId, slot.participantBId]);
      expect(pair).not.toEqual(new Set([A.id, D.id])); // 1A vs 1B forbidden
      expect(pair).not.toEqual(new Set([B.id, E.id])); // 2A vs 2B forbidden
    }
  });

  it('uses first two groups (alphabetical) when there are 3+ groups', () => {
    const G = p(7, 'G');
    const H = p(8, 'H');
    // Add a 3rd group "C" with two participants. Should be ignored.
    const matches: Match[] = [
      // Group A
      m(1, A.id, B.id, 3, 1, { groupLabel: 'A' }),
      m(2, A.id, C.id, 3, 1, { groupLabel: 'A' }),
      m(3, B.id, C.id, 3, 1, { groupLabel: 'A' }),
      // Group B
      m(4, D.id, E.id, 3, 1, { groupLabel: 'B' }),
      m(5, D.id, F.id, 3, 1, { groupLabel: 'B' }),
      m(6, E.id, F.id, 3, 1, { groupLabel: 'B' }),
      // Group C — exists but should NOT be used for seeding
      m(7, G.id, H.id, 3, 1, { groupLabel: 'C' }),
    ];
    const seeding = computeGroupsKnockoutSeeding(matches, [
      ...allParticipants,
      G,
      H,
    ])!;
    const ids = seeding.flatMap((s) => [s.participantAId, s.participantBId]);
    expect(ids).not.toContain(G.id);
    expect(ids).not.toContain(H.id);
  });

  it("ignores participants who didn't play in their group", () => {
    // Verify the per-group participant restriction: a group's standings
    // should not be polluted by participants from other groups (who would
    // otherwise show up with 0 played and tie at 0 points).
    const matches: Match[] = [
      m(1, A.id, B.id, 3, 1, { groupLabel: 'A' }),
      m(2, A.id, C.id, 3, 1, { groupLabel: 'A' }),
      m(3, B.id, C.id, 3, 1, { groupLabel: 'A' }),
      m(4, D.id, E.id, 3, 1, { groupLabel: 'B' }),
      m(5, D.id, F.id, 3, 1, { groupLabel: 'B' }),
      m(6, E.id, F.id, 3, 1, { groupLabel: 'B' }),
    ];
    const seeding = computeGroupsKnockoutSeeding(matches, allParticipants)!;
    // 1A is A; 2A is B. 1B is D; 2B is E. Confirm those exact slots.
    expect(seeding[0]).toEqual({ participantAId: A.id, participantBId: E.id });
    expect(seeding[1]).toEqual({ participantAId: D.id, participantBId: B.id });
  });
});
